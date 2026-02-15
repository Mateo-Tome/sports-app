// lib/recording/segmentStitcher.ts
// Handles stitching multiple video segments together,
// with a safe fallback so we don't lose recordings.
//
// IMPORTANT:
// - We lazy-load ffmpeg-kit so importing this module won't crash iOS at startup.
// - If FFmpeg is not available or concat fails, we fall back to the first segment.
//   (You still keep the recording, but you may lose the "paused" segments merge.)

import * as FileSystem from 'expo-file-system';

const SEG_DIR = FileSystem.cacheDirectory + 'segments/';

const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // ignore
  }
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

// Lazy loader to avoid iOS NativeEventEmitter crash on import
async function getFFmpeg() {
  const mod = await import('ffmpeg-kit-react-native');
  return { FFmpegKit: mod.FFmpegKit, ReturnCode: mod.ReturnCode };
}

// Low-level concat using FFmpeg
async function concatSegmentsInternal(
  segments: string[],
  outPath: string,
): Promise<{ ok: boolean; error?: any }> {
  if (!segments.length) return { ok: false };

  await ensureDir(SEG_DIR);

  const listTxt = segments
    .map((p) => `file '${String(p).replace(/'/g, "'\\''")}'`)
    .join('\n');

  const listPath = SEG_DIR + `list_${tsStamp()}.txt`;
  await FileSystem.writeAsStringAsync(listPath, listTxt);

  try {
    const { FFmpegKit, ReturnCode } = await getFFmpeg();

    const cmd = `-y -f concat -safe 0 -i ${q(listPath)} -c copy ${q(outPath)}`;
    const sess = await FFmpegKit.execute(cmd);
    const ok = ReturnCode.isSuccess(await sess.getReturnCode());

    if (!ok) {
      console.log(
        '[segmentStitcher] concat failed, logs:\n',
        await sess.getAllLogsAsString(),
      );
    }

    return { ok };
  } catch (e) {
    console.log('[segmentStitcher] ffmpeg not available / failed to execute', e);
    return { ok: false, error: e };
  }
}

/**
 * High-level stitcher with safe fallback.
 *
 * - 0 segments  → { ok: false, finalPath: null }
 * - 1 segment   → { ok: true,  finalPath: that segment }
 * - ≥2 segments → try FFmpeg concat
 *      - success → stitched file path
 *      - fail     → fall back to first segment (ok: true)
 *
 * NOTE: fallback means you keep the recording, but you lose merged pauses.
 */
export async function stitchSegmentsWithFallback(
  segments: string[],
): Promise<{ ok: boolean; finalPath: string | null; usedFallback?: boolean }> {
  if (!segments.length) return { ok: false, finalPath: null };

  if (segments.length === 1) return { ok: true, finalPath: segments[0] };

  const stitchedPath = SEG_DIR + `final_${tsStamp()}.mp4`;
  const res = await concatSegmentsInternal(segments, stitchedPath);

  if (res.ok) {
    return { ok: true, finalPath: stitchedPath, usedFallback: false };
  }

  // ✅ Safe fallback on ALL platforms to avoid losing recordings
  console.warn('[segmentStitcher] concat failed, falling back to first segment');
  return { ok: true, finalPath: segments[0], usedFallback: true };
}
