// lib/recording/videoStorage.ts
// Handles saving full videos + building highlight clips and sidecars.
//
// Goals:
// ✅ Stop/save should be FAST (move when possible, do not block on Photos / highlights)
// ✅ No startup crash: ffmpeg-kit is always lazy-loaded
// ✅ Post-processing never crashes the app: fully guarded fire-and-forget

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, InteractionManager } from 'react-native';

const VIDEOS_DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = VIDEOS_DIR + 'index.json';
const HIGHLIGHTS_SPORT = 'highlights';

// ---------- small utils (local to this module) ----------

const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // ignore
  }
};

const slug = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown';

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

// ---------- index & album helpers ----------

type VideoMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  createdAt: number;
  assetId?: string;
};

async function readIndex(): Promise<VideoMeta[]> {
  try {
    const info = (await FileSystem.getInfoAsync(INDEX_PATH)) as any;
    if (!info?.exists) return [];
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeIndexAtomic(list: VideoMeta[]) {
  const tmp = INDEX_PATH + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(list));
  try {
    await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true });
  } catch {}
  await FileSystem.moveAsync({ from: tmp, to: INDEX_PATH });
}

async function appendVideoIndex(entry: VideoMeta) {
  await ensureDir(VIDEOS_DIR);
  const list = await readIndex();
  list.unshift(entry);
  await writeIndexAtomic(list);
}

// Exported so finalizeRecording can defer Photos import without blocking Stop.
export async function importToPhotosAndAlbums(fileUri: string, athlete: string, sport: string) {
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) return undefined;

    const asset = await MediaLibrary.createAssetAsync(fileUri);
    const athleteAlbum = athlete?.trim() || 'Unassigned';
    const sportAlbum = `${athleteAlbum} - ${sport?.trim() || 'unknown'}`;

    let a = await MediaLibrary.getAlbumAsync(athleteAlbum);
    if (!a) {
      a = await MediaLibrary.createAlbumAsync(athleteAlbum, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], a, false);
    }

    let s = await MediaLibrary.getAlbumAsync(sportAlbum);
    if (!s) {
      s = await MediaLibrary.createAlbumAsync(sportAlbum, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], s, false);
    }

    return asset.id;
  } catch {
    return undefined;
  }
}

// ---------- exported: save full match video (FAST) ----------

export const saveToAppStorage = async (
  srcUri?: string | null,
  athleteRaw?: string,
  sportRaw?: string,
  opts?: {
    // default: false (so Stop is fast). You can flip true in some flows if you want.
    importToPhotos?: boolean;
  }
) => {
  if (!srcUri) {
    Alert.alert('No video URI', 'Recording did not return a file path.');
    return { appUri: null as string | null, assetId: undefined as string | undefined };
  }

  const athlete = (athleteRaw || '').trim() || 'Unassigned';
  const sport = (sportRaw || '').trim() || 'unknown';
  const dir = `${VIDEOS_DIR}${slug(athlete)}/${slug(sport)}/`;
  await ensureDir(dir);

  const ext = srcUri.split('.').pop()?.split('?')[0] || 'mp4';
  const filename = `match_${tsStamp()}.${ext}`;
  const destUri = dir + filename;

  // ✅ FAST PATH: move first (instant if same volume), copy fallback.
  try {
    await FileSystem.moveAsync({ from: srcUri, to: destUri });
  } catch {
    await FileSystem.copyAsync({ from: srcUri, to: destUri });
    try {
      await FileSystem.deleteAsync(srcUri, { idempotent: true });
    } catch {}
  }

  const displayName = `${athlete} - ${sport} - ${new Date().toLocaleString()}`;

  // Write index immediately (fast) so the match appears right away.
  await appendVideoIndex({
    uri: destUri,
    displayName,
    athlete,
    sport,
    createdAt: Date.now(),
    assetId: undefined,
  });

  let assetId: string | undefined;

  // Optional: Photos import. Default OFF so Stop is fast.
  if (opts?.importToPhotos) {
    assetId = await importToPhotosAndAlbums(destUri, athlete, sport);

    // Update index entry with assetId if we got it (best-effort).
    if (assetId) {
      try {
        const list = await readIndex();
        const idx = list.findIndex((x) => x.uri === destUri);
        if (idx >= 0) {
          list[idx] = { ...list[idx], assetId };
          await writeIndexAtomic(list);
        }
      } catch {}
    }
  }

  return { appUri: destUri, assetId };
};

// ---------- exported: highlights & sidecars ----------

async function writeHighlightSidecar(clipUri: string, athlete: string, fromT: number, duration: number) {
  try {
    const jsonUri = clipUri.replace(/\.[^/.]+$/, '') + '.json';
    await FileSystem.writeAsStringAsync(
      jsonUri,
      JSON.stringify({
        athlete,
        sport: HIGHLIGHTS_SPORT,
        createdAt: Date.now(),
        source: 'auto-clip',
        window: { t: fromT, duration },
      }),
    );
  } catch {}
}

async function addClipToIndexAndAlbums(clipUri: string, athlete: string, importToPhotos: boolean) {
  const displayName = `${athlete} - ${HIGHLIGHTS_SPORT} - ${new Date().toLocaleString()}`;

  let assetId: string | undefined;
  if (importToPhotos) {
    assetId = await importToPhotosAndAlbums(clipUri, athlete, HIGHLIGHTS_SPORT);
  }

  await appendVideoIndex({
    uri: clipUri,
    displayName,
    athlete,
    sport: HIGHLIGHTS_SPORT,
    createdAt: Date.now(),
    assetId,
  });
}

async function destForHighlight(athlete: string) {
  const base = `${VIDEOS_DIR}${slug(athlete)}/${slug(HIGHLIGHTS_SPORT)}/`;
  await ensureDir(base);
  return base;
}

export const processHighlights = async (
  videoUri: string,
  markers: number[],
  durationSec: number,
  athleteName: string,
  opts?: {
    // default: false so Stop doesn’t block on Photos
    importHighlightsToPhotos?: boolean;
    // optional: cap highlight work to avoid huge stalls if someone taps 30 times
    maxClips?: number;
  }
) => {
  if (!markers.length) return [];

  const importToPhotos = Boolean(opts?.importHighlightsToPhotos);
  const maxClips = typeof opts?.maxClips === 'number' ? opts!.maxClips! : markers.length;

  // If ffmpeg isn't linked correctly, this is where it will fail.
  // We'll just skip highlights instead of crashing the whole save.
  let FFmpegKit: any;
  let ReturnCode: any;
  try {
    const m = await getFFmpeg();
    FFmpegKit = m.FFmpegKit;
    ReturnCode = m.ReturnCode;
  } catch (e) {
    console.log('[highlights] ffmpeg unavailable, skipping highlights', e);
    return [];
  }

  const destDir = await destForHighlight(athleteName);
  const results: { url: string; markerTime: number }[] = [];

  const markersToProcess = markers.slice(0, Math.max(0, maxClips));

  for (let i = 0; i < markersToProcess.length; i++) {
    const start = Math.max(0, markersToProcess[i]);
    const outPath = `${destDir}clip_${i + 1}_${tsStamp()}.mp4`;

    // first attempt: stream copy (fast)
    let cmd = `-y -ss ${start} -t ${durationSec} -i ${q(videoUri)} -c copy ${q(outPath)}`;
    let s = await FFmpegKit.execute(cmd);

    if (ReturnCode.isSuccess(await s.getReturnCode())) {
      await addClipToIndexAndAlbums(outPath, athleteName, importToPhotos);
      await writeHighlightSidecar(outPath, athleteName, start, durationSec);
      results.push({ url: outPath, markerTime: start });
      continue;
    }

    // fallback: re-encode (still guarded)
    cmd = `-y -ss ${start} -t ${durationSec} -i ${q(videoUri)} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k ${q(outPath)}`;
    s = await FFmpegKit.execute(cmd);

    if (ReturnCode.isSuccess(await s.getReturnCode())) {
      await addClipToIndexAndAlbums(outPath, athleteName, importToPhotos);
      await writeHighlightSidecar(outPath, athleteName, start, durationSec);
      results.push({ url: outPath, markerTime: start });
    }
  }

  return results;
};

// ---------- exported: safe fire-and-forget post processing ----------

export function runPostSaveTasksSafe(tasks: Array<() => Promise<void>>) {
  // run after nav/animations so we don't compete with UI thread
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      for (const t of tasks) {
        // fire and forget, never throw
        Promise.resolve()
          .then(() => t())
          .catch((e) => console.log('[postSaveTask error]', e));
      }
    }, 0);
  });
}