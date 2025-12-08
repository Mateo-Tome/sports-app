// lib/library/thumbs.ts
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { readIndex } from './indexStore';

const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';

// Track URIs that have consistently failed so we don't spam retries
const failedThumbs = new Set<string>();

// local ensureDir just for thumbs
const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // directory already exists or cannot be created – ignore
  }
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

// Normalize file URIs a bit for safety
const normalizeVideoUri = (uri: string) => {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  return `file://${uri}`;
};

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

async function tryMakeThumbFromExpo(uri: string, dest: string, t: number) {
  const { uri: tmp } = await VideoThumbnails.getThumbnailAsync(uri, {
    time: t,
    quality: 0.6,
  });
  await FileSystem.copyAsync({ from: tmp, to: dest });
}

/**
 * Try to generate a thumbnail from a local file/URI using expo-video-thumbnails.
 * - Handles file://, ph:// and assets-library://.
 * - Tries a later frame first, then falls back to 0ms.
 */
async function safeThumbFromFileUri(
  rawVideoUri: string,
  dest: string,
  atMs = 900,
) {
  const uri = normalizeVideoUri(rawVideoUri);

  // For real files on disk, make sure they exist first.
  if (!uri.startsWith('ph://') && !uri.startsWith('assets-library://')) {
    if (!(await fileExists(uri))) {
      // Tiny grace delay in case it's still being written
      await new Promise((r) => setTimeout(r, 200));
      if (!(await fileExists(uri))) {
        throw new Error('File missing or not yet written: ' + uri);
      }
    }
  }

  // 1) Try at the requested time
  try {
    await tryMakeThumbFromExpo(uri, dest, atMs);
    return;
  } catch {
    // 2) Fallback to 0ms for very short clips
    await tryMakeThumbFromExpo(uri, dest, 0);
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

    // Already cached?
    const info: any = await FileSystem.getInfoAsync(dest);
    if (info?.exists) return dest;

    // If we've already proven this URI is hopeless, don't hammer it.
    if (failedThumbs.has(videoUri)) {
      return null;
    }

    // 1) Try the actual file path first (works for file:// in app storage)
    try {
      await safeThumbFromFileUri(videoUri, dest, 900);
      const ok: any = await FileSystem.getInfoAsync(dest);
      if (ok?.exists) return dest;
    } catch {
      // swallow – we'll try fallbacks below
    }

    // 2) Fallback: use Photos asset localUri (best-effort; only if we truly have read access)
    if (assetId) {
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        const accessPrivs = (perm as any)?.accessPrivileges;

        // On iOS, accessPrivileges can be 'all' | 'limited' | 'none' | 'addOnly'
        const canReadFromPhotos =
          perm.granted &&
          accessPrivs &&
          accessPrivs !== 'addOnly' &&
          accessPrivs !== 'none';

        if (canReadFromPhotos) {
          const asset = await MediaLibrary.getAssetInfoAsync(assetId);
          const local = asset?.localUri || asset?.uri;
          if (local) {
            await safeThumbFromFileUri(local, dest, 900);
            const ok2: any = await FileSystem.getInfoAsync(dest);
            if (ok2?.exists) return dest;
          }
        }
      } catch {
        // If Photos refuses to serve the asset, just treat as no-thumb.
      }
    }

    // Mark as failed so we don't keep retrying this URI
    failedThumbs.add(videoUri);
    return null;
  } catch {
    failedThumbs.add(videoUri);
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
          } catch {
            // ignore individual delete failures
          }
        }
      },
    );
    return removed;
  } catch {
    return 0;
  }
}
