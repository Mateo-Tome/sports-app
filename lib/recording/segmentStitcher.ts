// lib/recording/segmentStitcher.ts
import * as FileSystem from 'expo-file-system';

const SEG_DIR = FileSystem.cacheDirectory + 'segments/';

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

const q = (p: string) => `"${String(p).replace(/"/g, '\\"')}"`;

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

async function concatSegmentsInternal(
  segments: string[],
  outPath: string,
): Promise<{ ok: boolean; error?: any }> {
  if (!segments.length) return { ok: false };

  await ensureDir(SEG_DIR);

  for (const seg of segments) {
    const info = await FileSystem.getInfoAsync(seg);
    if (!info.exists) return { ok: false, error: new Error(`Missing segment: ${seg}`) };
  }

  const listTxt = segments
    .map((p) => `file '${String(p).replace(/'/g, "'\\''")}'`)
    .join('\n');

  const listPath = SEG_DIR + `list_${tsStamp()}.txt`;
  await FileSystem.writeAsStringAsync(listPath, listTxt);

  try {
    // 1) FAST: concat stream copy
    const copyCmd = `-y -f concat -safe 0 -i ${q(listPath)} -c copy ${q(outPath)}`;
    const copyRes = await runFFmpeg(copyCmd);

    const looksUnsafe =
      /Unknown:\s*none/i.test(copyRes.logs) ||
      /Could not find codec parameters/i.test(copyRes.logs) ||
      /Non-monotonous DTS/i.test(copyRes.logs);

    if (copyRes.ok && !looksUnsafe) return { ok: true };

    console.log('[segmentStitcher] copy-concat unsafe/failed, retrying with iOS-safe re-encode');

    // 2) SAFE: re-encode using VideoToolbox (works on iOS builds without libx264)
    // Also: map only V:0 and A:0 to DROP the weird "stream 2: Unknown"
    const safeCmd =
      `-y -f concat -safe 0 -i ${q(listPath)} ` +
      `-map 0:v:0 -map 0:a:0? ` +
      `-fflags +genpts -avoid_negative_ts make_zero ` +
      `-c:v h264_videotoolbox -b:v 6000k ` + // adjust bitrate if you want
      `-c:a aac -b:a 128k -ar 44100 ` +
      `${q(outPath)}`;

    const safeRes = await runFFmpeg(safeCmd);
    if (!safeRes.ok) {
      console.log('[segmentStitcher] videotoolbox re-encode failed logs:\n', safeRes.logs);
    }

    return { ok: safeRes.ok };
  } catch (e) {
    return { ok: false, error: e };
  } finally {
    try {
      await FileSystem.deleteAsync(listPath, { idempotent: true });
    } catch {}
  }
}

export async function stitchSegmentsWithFallback(
  segments: string[],
): Promise<{ ok: boolean; finalPath: string | null; usedFallback?: boolean }> {
  if (!segments.length) return { ok: false, finalPath: null };

  if (segments.length === 1) return { ok: true, finalPath: segments[0], usedFallback: false };

  const stitchedPath = SEG_DIR + `final_${tsStamp()}.mp4`;
  const res = await concatSegmentsInternal(segments, stitchedPath);

  if (res.ok) return { ok: true, finalPath: stitchedPath, usedFallback: false };

  console.warn('[segmentStitcher] concat failed, falling back to first segment');
  return { ok: true, finalPath: segments[0], usedFallback: true };
}