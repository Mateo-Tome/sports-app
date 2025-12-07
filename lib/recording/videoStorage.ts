// lib/recording/videoStorage.ts
// Handles saving full videos + building highlight clips and sidecars.

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { Alert } from 'react-native';

const VIDEOS_DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = VIDEOS_DIR + 'index.json';
const HIGHLIGHTS_SPORT = 'highlights';

// ---------- small utils (local to this module) ----------

const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // ignore "already exists" and similar
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

async function importToPhotosAndAlbums(
  fileUri: string,
  athlete: string,
  sport: string,
) {
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

// ---------- exported: save full match video ----------

export const saveToAppStorage = async (
  srcUri?: string | null,
  athleteRaw?: string,
  sportRaw?: string,
) => {
  if (!srcUri) {
    Alert.alert('No video URI', 'Recording did not return a file path.');
    return {
      appUri: null as string | null,
      assetId: undefined as string | undefined,
    };
  }

  const athlete = (athleteRaw || '').trim() || 'Unassigned';
  const sport = (sportRaw || '').trim() || 'unknown';
  const dir = `${VIDEOS_DIR}${slug(athlete)}/${slug(sport)}/`;
  await ensureDir(dir);

  const ext = srcUri.split('.').pop()?.split('?')[0] || 'mp4';
  const filename = `match_${tsStamp()}.${ext}`;
  const destUri = dir + filename;

  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  try {
    await FileSystem.deleteAsync(srcUri, { idempotent: true });
  } catch {}

  const displayName = `${athlete} - ${sport} - ${new Date().toLocaleString()}`;
  const assetId = await importToPhotosAndAlbums(destUri, athlete, sport);

  await appendVideoIndex({
    uri: destUri,
    displayName,
    athlete,
    sport,
    createdAt: Date.now(),
    assetId,
  });

  return { appUri: destUri, assetId };
};

// ---------- exported: highlights & sidecars ----------

async function writeHighlightSidecar(
  clipUri: string,
  athlete: string,
  fromT: number,
  duration: number,
) {
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

async function addClipToIndexAndAlbums(clipUri: string, athlete: string) {
  const displayName = `${athlete} - ${HIGHLIGHTS_SPORT} - ${new Date().toLocaleString()}`;
  const assetId = await importToPhotosAndAlbums(
    clipUri,
    athlete,
    HIGHLIGHTS_SPORT,
  );

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
) => {
  if (!markers.length) return [];

  const destDir = await destForHighlight(athleteName);
  const results: { url: string; markerTime: number }[] = [];

  for (let i = 0; i < markers.length; i++) {
    const start = Math.max(0, markers[i]);
    const outPath = `${destDir}clip_${i + 1}_${tsStamp()}.mp4`;

    // first attempt: stream copy
    let cmd = `-y -ss ${start} -t ${durationSec} -i ${q(
      videoUri,
    )} -c copy ${q(outPath)}`;
    let s = await FFmpegKit.execute(cmd);

    if (ReturnCode.isSuccess(await s.getReturnCode())) {
      await addClipToIndexAndAlbums(outPath, athleteName);
      await writeHighlightSidecar(outPath, athleteName, start, durationSec);
      results.push({ url: outPath, markerTime: start });
      continue;
    }

    // fallback: re-encode
    cmd = `-y -ss ${start} -t ${durationSec} -i ${q(
      videoUri,
    )} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k ${q(
      outPath,
    )}`;
    s = await FFmpegKit.execute(cmd);

    if (ReturnCode.isSuccess(await s.getReturnCode())) {
      await addClipToIndexAndAlbums(outPath, athleteName);
      await writeHighlightSidecar(outPath, athleteName, start, durationSec);
      results.push({ url: outPath, markerTime: start });
    }
  }

  return results;
};
