// lib/library/thumbs.ts
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { readIndex } from './indexStore';

const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';

// local ensureDir just for thumbs
const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {}
};

const baseNameNoExt = (p: string) => {
  const name = p.split('/').pop() || '';
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
};

// hash for unique thumb names even if basenames collide
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export const thumbNameFor = (videoUri: string) =>
  `${baseNameNoExt(videoUri)}_${hash(videoUri)}.jpg`;

export const thumbPathFor = (videoUri: string) =>
  `${THUMBS_DIR}${thumbNameFor(videoUri)}`;

async function fileExists(uri: string) {
  try {
    const info: any = await FileSystem.getInfoAsync(uri, {
      size: false as any,
    });
    return !!info?.exists;
  } catch {
    return false;
  }
}

async function tryMakeThumbFrom(uri: string, dest: string, t: number) {
  const { uri: tmp } = await VideoThumbnails.getThumbnailAsync(uri, {
    time: t,
    quality: 0.6,
  });
  await FileSystem.copyAsync({ from: tmp, to: dest });
}

async function safeThumbFromFileUri(
  videoUri: string,
  dest: string,
  atMs = 900,
) {
  if (!(await fileExists(videoUri))) {
    await new Promise((r) => setTimeout(r, 200));
    if (!(await fileExists(videoUri))) {
      throw new Error('File missing or not yet written: ' + videoUri);
    }
  }
  try {
    await tryMakeThumbFrom(videoUri, dest, atMs);
  } catch {
    await tryMakeThumbFrom(videoUri, dest, 0);
  }
}

// small local mapLimit just for thumbs
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) break;
        results[idx] = await worker(items[idx], idx);
      }
    });
  await Promise.all(workers);
  return results;
}

// PUBLIC: generate or reuse a thumbnail for a given video
export async function getOrCreateThumb(
  videoUri: string,
  assetId?: string | null,
): Promise<string | null> {
  try {
    await ensureDir(THUMBS_DIR);
    const dest = thumbPathFor(videoUri);

    // already cached?
    const info: any = await FileSystem.getInfoAsync(dest);
    if (info?.exists) return dest;

    // 1) Try the actual file path first (works for file:// in app storage)
    try {
      await safeThumbFromFileUri(videoUri, dest, 900);
      const ok: any = await FileSystem.getInfoAsync(dest);
      if (ok?.exists) return dest;
    } catch (e) {
      console.log('[thumbs] primary failed for', videoUri, e);
    }

    // 2) Fallback: use Photos asset localUri (best-effort; permission request is platform-safe)
    if (assetId) {
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.granted) {
          const asset = await MediaLibrary.getAssetInfoAsync(assetId);
          const local = asset?.localUri || asset?.uri;
          if (local) {
            await safeThumbFromFileUri(local, dest, 900);
            const ok2: any = await FileSystem.getInfoAsync(dest);
            if (ok2?.exists) return dest;
          }
        }
      } catch (e2) {
        console.log('[thumbs] asset fallback failed', assetId, e2);
      }
    }

    return null;
  } catch (e) {
    console.log('[thumbs] error', e);
    return null;
  }
}

// PUBLIC: sweep orphaned thumbs (no corresponding video in current index)
export async function sweepOrphanThumbs(indexUris?: string[]) {
  try {
    await ensureDir(THUMBS_DIR);
    // @ts-ignore
    const files: string[] = await (FileSystem as any).readDirectoryAsync(
      THUMBS_DIR,
    );
    if (!files?.length) return 0;

    const allowed = new Set(
      (indexUris ?? (await readIndex()).map((m) => m.uri)).map((u) =>
        thumbNameFor(u).replace(/\.jpg$/i, '').toLowerCase(),
      ),
    );

    let removed = 0;
    await mapLimit(
      files.filter((f) => f.toLowerCase().endsWith('.jpg')),
      4,
      async (f) => {
        const base = f.replace(/\.jpg$/i, '').toLowerCase();
        if (!allowed.has(base)) {
          try {
            await FileSystem.deleteAsync(`${THUMBS_DIR}${f}`, {
              idempotent: true,
            });
            removed++;
          } catch {}
        }
      },
    );
    return removed;
  } catch {
    return 0;
  }
}
