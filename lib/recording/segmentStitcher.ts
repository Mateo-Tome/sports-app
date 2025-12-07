// lib/recording/segmentStitcher.ts
// Handles stitching multiple video segments together,
// with a safe Android fallback so we don't lose recordings.

import * as FileSystem from 'expo-file-system';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { Platform } from 'react-native';

const SEG_DIR = FileSystem.cacheDirectory + 'segments/';

const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // ignore "already exists" and similar
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

// Low-level concat using FFmpeg
async function concatSegmentsInternal(
  segments: string[],
  outPath: string,
): Promise<boolean> {
  if (!segments.length) return false;

  await ensureDir(SEG_DIR);

  const listTxt = segments
    .map((p) => `file '${String(p).replace(/'/g, "'\\''")}'`)
    .join('\n');
  const listPath = SEG_DIR + `list_${tsStamp()}.txt`;

  await FileSystem.writeAsStringAsync(listPath, listTxt);

  const cmd = `-y -f concat -safe 0 -i ${q(listPath)} -c copy ${q(outPath)}`;
  const sess = await FFmpegKit.execute(cmd);
  const ok = ReturnCode.isSuccess(await sess.getReturnCode());

  if (!ok) {
    console.log(
      '[segmentStitcher] concat failed, logs:\n',
      await sess.getAllLogsAsString(),
    );
  }

  return ok;
}

/**
 * High-level stitcher with platform-aware fallback.
 *
 * - 0 segments  → { ok: false, finalPath: null }
 * - 1 segment   → { ok: true,  finalPath: that segment }
 * - ≥2 segments → try FFmpeg concat
 *      - success → stitched file path
 *      - fail on ANDROID → fall back to first segment (ok: true)
 *      - fail on iOS/other → ok: false, finalPath: null
 */
export async function stitchSegmentsWithFallback(
  segments: string[],
): Promise<{ ok: boolean; finalPath: string | null }> {
  if (!segments.length) {
    return { ok: false, finalPath: null };
  }

  if (segments.length === 1) {
    return { ok: true, finalPath: segments[0] };
  }

  const stitchedPath = SEG_DIR + `final_${tsStamp()}.mp4`;
  const ok = await concatSegmentsInternal(segments, stitchedPath);

  if (ok) {
    return { ok: true, finalPath: stitchedPath };
  }

  if (Platform.OS === 'android') {
    console.warn(
      '[segmentStitcher] concat failed on Android, falling back to first segment',
    );
    return { ok: true, finalPath: segments[0] };
  }

  // iOS + other platforms: report failure so caller can show an error
  return { ok: false, finalPath: null };
}
