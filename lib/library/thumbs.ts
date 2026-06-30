import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { readIndex } from './indexStore';

const BASE_DIR = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
const THUMBS_DIR = `${BASE_DIR}thumbs/`;

const failedThumbs = new Map<string, number>();
const FAILED_RETRY_AFTER_MS = 60 * 1000;

let thumbQueue: Promise<any> = Promise.resolve();

function enqueueThumb<T>(fn: () => Promise<T>): Promise<T> {
  const task = thumbQueue.then(fn, fn);
  thumbQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

const ensureDir = async (dir: string) => {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
};

const baseNameNoExt = (p: string) => {
  const name = p.split('/').pop() || '';
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name || 'video';
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export const thumbNameFor = (videoUri: string) =>
  `${baseNameNoExt(videoUri)}_${hash(videoUri)}.jpg`;

export const thumbPathFor = (videoUri: string) =>
  `${THUMBS_DIR}${thumbNameFor(videoUri)}`;

const normalizeVideoUri = (uri: string) => {
  const clean = String(uri ?? '').trim();

  if (
    clean.startsWith('file://') ||
    clean.startsWith('ph://') ||
    clean.startsWith('assets-library://') ||
    clean.startsWith('http://') ||
    clean.startsWith('https://')
  ) {
    return clean;
  }

  return `file://${clean}`;
};

async function fileExists(uri: string) {
  try {
    const info: any = await FileSystem.getInfoAsync(uri, { size: false as any });
    return !!info?.exists;
  } catch {
    return false;
  }
}

async function fileExistsWithRetry(uri: string) {
  if (await fileExists(uri)) return true;
  await sleep(250);
  if (await fileExists(uri)) return true;
  await sleep(500);
  return await fileExists(uri);
}

async function getExistingThumb(dest: string) {
  try {
    const info: any = await FileSystem.getInfoAsync(dest);
    return info?.exists ? dest : null;
  } catch {
    return null;
  }
}

async function tryMakeThumbFromExpo(uri: string, dest: string, time: number) {
  const generated = await VideoThumbnails.getThumbnailAsync(uri, {
    time,
    quality: 0.65,
  });

  if (!generated?.uri) {
    throw new Error(`Thumbnail generation returned no uri at ${time}ms`);
  }

  await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
  await FileSystem.copyAsync({ from: generated.uri, to: dest });

  const exists = await getExistingThumb(dest);
  if (!exists) {
    throw new Error(`Thumbnail copy failed at ${time}ms`);
  }

  return exists;
}

async function makeThumbFromUri(rawVideoUri: string, dest: string) {
  const uri = normalizeVideoUri(rawVideoUri);

  if (!uri) {
    throw new Error('Missing video uri');
  }

  if (!uri.startsWith('ph://') && !uri.startsWith('assets-library://')) {
    const exists = await fileExistsWithRetry(uri);
    if (!exists) {
      throw new Error(`Video file missing or not ready: ${uri}`);
    }
  }

  const times = [900, 300, 0];

  let lastError: any = null;

  for (const time of times) {
    try {
      return await tryMakeThumbFromExpo(uri, dest, time);
    } catch (e) {
      lastError = e;
      await sleep(120);
    }
  }

  throw lastError ?? new Error('Thumbnail generation failed');
}

async function getPhotosLocalUri(assetId: string) {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync();
    const accessPrivs = (perm as any)?.accessPrivileges;

    const canReadFromPhotos =
      perm.granted &&
      accessPrivs !== 'addOnly' &&
      accessPrivs !== 'none';

    if (!canReadFromPhotos) return null;

    const asset = await MediaLibrary.getAssetInfoAsync(assetId);
    return asset?.localUri || asset?.uri || null;
  } catch {
    return null;
  }
}

function isTemporarilyFailed(videoUri: string) {
  const failedAt = failedThumbs.get(videoUri);
  if (!failedAt) return false;

  if (Date.now() - failedAt > FAILED_RETRY_AFTER_MS) {
    failedThumbs.delete(videoUri);
    return false;
  }

  return true;
}

export async function getOrCreateThumb(
  videoUri: string,
  assetId?: string | null,
): Promise<string | null> {
  const cleanUri = String(videoUri ?? '').trim();
  if (!cleanUri) return null;

  return enqueueThumb(async () => {
    try {
      await ensureDir(THUMBS_DIR);

      const dest = thumbPathFor(cleanUri);

      const existing = await getExistingThumb(dest);
      if (existing) return existing;

      if (isTemporarilyFailed(cleanUri)) {
        return null;
      }

      try {
        const thumb = await makeThumbFromUri(cleanUri, dest);
        failedThumbs.delete(cleanUri);
        return thumb;
      } catch (e) {
        console.log('[thumbs] app-file thumbnail failed:', cleanUri, e);
      }

      if (assetId) {
        const photosUri = await getPhotosLocalUri(assetId);

        if (photosUri) {
          try {
            const thumb = await makeThumbFromUri(photosUri, dest);
            failedThumbs.delete(cleanUri);
            return thumb;
          } catch (e) {
            console.log('[thumbs] photos thumbnail failed:', cleanUri, e);
          }
        }
      }

      failedThumbs.set(cleanUri, Date.now());
      return null;
    } catch (e) {
      console.log('[thumbs] getOrCreateThumb failed:', cleanUri, e);
      failedThumbs.set(cleanUri, Date.now());
      return null;
    }
  });
}

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

        try {
          results[idx] = await worker(items[idx], idx);
        } catch {
          results[idx] = null as R;
        }
      }
    });

  await Promise.all(workers);
  return results;
}

export async function sweepOrphanThumbs(indexUris?: string[]) {
  try {
    await ensureDir(THUMBS_DIR);

    const files: string[] = await (FileSystem as any).readDirectoryAsync(THUMBS_DIR);
    if (!files?.length) return 0;

    const indexList = indexUris ?? (await readIndex()).map((m) => m.uri);

    const allowed = new Set(
      indexList.map((u) => thumbNameFor(u).replace(/\.jpg$/i, '').toLowerCase()),
    );

    let removed = 0;

    await mapLimit(
      files.filter((f) => f.toLowerCase().endsWith('.jpg')),
      2,
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