// lib/recording/segmentStitcher.ts
import * as FileSystem from 'expo-file-system';

const SEG_DIR = (FileSystem.cacheDirectory || 'file:///tmp/') + 'segments/';
const FAILSAFE_DIR = (FileSystem.documentDirectory || 'file:///tmp/') + 'failed_stitches/';

const MIN_SEG_BYTES = 1024;
const MIN_OUT_BYTES = 50 * 1024;

const ensureDir = async (dir: string) => {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {}
};

const tsStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
};

function uriToPosixPath(input: string) {
  const s = String(input || '').trim();
  const stripped =
    (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))
      ? s.slice(1, -1)
      : s;
  return stripped.startsWith('file://') ? stripped.replace(/^file:\/\//, '') : stripped;
}

const q = (p: string) => `"${String(p).replace(/"/g, '\\"')}"`;
const escSingleForConcat = (p: string) => String(p).replace(/'/g, "'\\''");

async function getFFmpeg() {
  const mod = await import('ffmpeg-kit-react-native');
  return { FFmpegKit: mod.FFmpegKit, ReturnCode: mod.ReturnCode };
}

async function runFFmpeg(cmd: string) {
  const { FFmpegKit, ReturnCode } = await getFFmpeg();
  const sess = await FFmpegKit.execute(cmd);
  const rc = await sess.getReturnCode();
  const ok = ReturnCode.isSuccess(rc);
  const logs = await sess.getAllLogsAsString();
  return { ok, logs };
}

async function fileLooksValid(uri: string, minBytes: number) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const size = (info as any)?.size ?? 0;
    return Boolean(info.exists && size >= minBytes);
  } catch {
    return false;
  }
}

async function writeStringAtomic(uri: string, content: string) {
  const tmp = uri + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, content);
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
  await FileSystem.moveAsync({ from: tmp, to: uri });
}

// In practice: don’t bail from copy unless we see “real” failure / corruption signals.
function looksUnsafeForCopy(logs: string) {
  return (
    /Non-monotonous DTS/i.test(logs) ||
    /Invalid data found/i.test(logs) ||
    /moov atom not found/i.test(logs) ||
    /Impossible to open/i.test(logs) ||
    /Conversion failed/i.test(logs)
  );
}

function looksHardFailedForSafe(logs: string) {
  return (
    /Impossible to open/i.test(logs) ||
    /No such file or directory/i.test(logs) ||
    /Invalid data found/i.test(logs) ||
    /moov atom not found/i.test(logs) ||
    /Conversion failed/i.test(logs)
  );
}

async function preserveAllSegments(segments: string[]) {
  await ensureDir(FAILSAFE_DIR);
  const destDir = FAILSAFE_DIR + `segments_${tsStamp()}/`;
  await ensureDir(destDir);

  const copied: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const src = segments[i];
    const ext = src.split('.').pop()?.split('?')[0] || 'mp4';
    const dest = `${destDir}seg_${String(i + 1).padStart(3, '0')}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: src, to: dest });
      copied.push(dest);
    } catch {}
  }
  return { destDir, copied };
}

async function concatSegmentsInternal(
  segments: string[],
  outUri: string,
  opts?: { forceReencode?: boolean },
): Promise<{ ok: boolean; stage?: 'copy' | 'safe'; logs: string; error?: any }> {
  await ensureDir(SEG_DIR);

  for (const segUri of segments) {
    const info = await FileSystem.getInfoAsync(segUri);
    const size = (info as any)?.size ?? 0;
    if (!info.exists || size < MIN_SEG_BYTES) {
      return { ok: false, logs: '', error: new Error(`Missing/empty segment: ${segUri}`) };
    }
  }

  const listTxt = segments
    .map((segUri) => `file '${escSingleForConcat(uriToPosixPath(segUri))}'`)
    .join('\n');

  const listUri = SEG_DIR + `list_${tsStamp()}.txt`;
  await writeStringAtomic(listUri, listTxt);

  const listPath = uriToPosixPath(listUri);
  const outPath = uriToPosixPath(outUri);

  try {
    if (!opts?.forceReencode) {
      // 1) FAST: stream copy
      // IMPORTANT: map v/a only to drop weird extra streams that trigger warnings.
      const copyCmd =
        `-y -f concat -safe 0 -i ${q(listPath)} ` +
        `-map 0:v:0 -map 0:a:0? -c copy ${q(outPath)}`;

      const copyRes = await runFFmpeg(copyCmd);

      // Accept if:
      // - ReturnCode success
      // - output looks real
      // - no strong corruption signals
      if (
        copyRes.ok &&
        !looksUnsafeForCopy(copyRes.logs) &&
        (await fileLooksValid(outUri, MIN_OUT_BYTES))
      ) {
        return { ok: true, stage: 'copy', logs: copyRes.logs };
      }

      try { await FileSystem.deleteAsync(outUri, { idempotent: true }); } catch {}
    }

    // 2) SAFE: re-encode using VideoToolbox
    const safeCmd =
      `-y -f concat -safe 0 -i ${q(listPath)} ` +
      `-map 0:v:0 -map 0:a:0? ` +
      `-fflags +genpts -avoid_negative_ts make_zero ` +
      `-c:v h264_videotoolbox -b:v 6000k ` +
      `-c:a aac -b:a 128k -ar 44100 ` +
      `${q(outPath)}`;

    const safeRes = await runFFmpeg(safeCmd);

    if (
      safeRes.ok &&
      !looksHardFailedForSafe(safeRes.logs) &&
      (await fileLooksValid(outUri, MIN_OUT_BYTES))
    ) {
      return { ok: true, stage: 'safe', logs: safeRes.logs };
    }

    try { await FileSystem.deleteAsync(outUri, { idempotent: true }); } catch {}
    return { ok: false, stage: 'safe', logs: safeRes.logs };
  } catch (e) {
    return { ok: false, logs: '', error: e };
  } finally {
    try { await FileSystem.deleteAsync(listUri, { idempotent: true }); } catch {}
  }
}

export async function stitchSegmentsWithFallback(
  segments: string[],
  opts?: {
    preserveSegmentsOnFailure?: boolean;
    forceReencode?: boolean;
  },
): Promise<{
  ok: boolean;
  finalPath: string | null;
  usedFallback?: boolean;
  stitchStage?: 'copy' | 'safe';
  segmentPaths?: string[];
  preservedDir?: string;
  preservedCopies?: string[];
  logs?: string;
}> {
  const segs = (segments || []).filter(Boolean).map(String);

  if (!segs.length) return { ok: false, finalPath: null };

  if (segs.length === 1) {
    return { ok: true, finalPath: segs[0], usedFallback: false };
  }

  const stitchedUri = SEG_DIR + `final_${tsStamp()}.mp4`;
  const res = await concatSegmentsInternal(segs, stitchedUri, { forceReencode: opts?.forceReencode });

  if (res.ok) {
    return {
      ok: true,
      finalPath: stitchedUri,
      usedFallback: false,
      stitchStage: res.stage,
      logs: res.logs,
    };
  }

  let preservedDir: string | undefined;
  let preservedCopies: string[] | undefined;

  if (opts?.preserveSegmentsOnFailure) {
    const preserved = await preserveAllSegments(segs);
    preservedDir = preserved.destDir;
    preservedCopies = preserved.copied;
  }

  // Keep old behavior: return first segment so caller doesn't break
  return {
    ok: true,
    finalPath: segs[0],
    usedFallback: true,
    segmentPaths: segs,
    preservedDir,
    preservedCopies,
    logs: res.logs,
  };
}