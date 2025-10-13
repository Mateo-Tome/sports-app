// lib/sync.ts
// Zero-native dependency sync helpers used by Library.
// - No expo-network / NetInfo imports
// - Simple online probe with fetch + timeout
// - Stubbed upload functions that you can wire to your backend later

import * as FileSystem from 'expo-file-system';

const ONLINE_PROBE_URL = 'https://clients3.google.com/generate_204';

// Tiny timeout helper
function withTimeout<T>(p: Promise<T>, ms: number, err: Error) {
  let t: any;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(err), ms);
    }),
  ]);
}

export async function isOnline(timeoutMs = 2500): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(ONLINE_PROBE_URL, { method: 'GET' }),
      timeoutMs,
      new Error('timeout')
    );
    // Treat 204/200 as online
    return !!res && (res.status === 204 || res.status === 200);
  } catch {
    return false;
  }
}

// ---- Upload helpers ----
// NOTE: These are basic stubs so your app compiles and the UI works.
// Replace the inside with your real upload to S3, Supabase, etc.

export async function uploadFileOnTap(localUri: string): Promise<{ key: string; url: string }> {
  const online = await isOnline();
  if (!online) {
    throw new Error('You appear to be offline. Connect to the internet and try again.');
  }

  // TODO: replace with your real upload logic (presigned URL, multipart, etc.)
  // For now, we "pretend" the upload succeeded and return a stable key + a file:// fallback url.
  const filename = (localUri.split('/').pop() || `video_${Date.now()}`).replace(/\s+/g, '_');
  const key = `uploads/${filename}`;
  // If you have a CDN/base URL, compose it here; for stub we return the local URI
  const url = localUri;

  // If you want to at least ensure the file exists before pretending:
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    // @ts-ignore
    if (!info?.exists) throw new Error('File not found on device.');
  } catch (e: any) {
    throw new Error(e?.message ?? 'File missing.');
  }

  return { key, url };
}

export async function uploadJSONOnTap(
  data: unknown,
  prefix = 'sidecars/'
): Promise<{ key: string; url: string }> {
  const online = await isOnline();
  if (!online) {
    throw new Error('You appear to be offline. Connect to the internet and try again.');
  }
  // In a real backend, POST this JSON somewhere. For now we just return a pretend key+url.
  const key = `${prefix}${Date.now()}.json`;
  const url = `data:application/json,${encodeURIComponent(JSON.stringify(data ?? {}, null, 2))}`;
  return { key, url };
}
