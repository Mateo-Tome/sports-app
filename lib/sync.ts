// lib/sync.ts
// LOCAL-ONLY VERSION
// -------------------------
// Previously this handled Firebase Storage uploads.
// For the local-only branch, we disable real uploads
// but keep the same function names so callers don't break.

import * as FileSystem from 'expo-file-system';

// ---------- utils (still useful for generating keys) ----------
const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
function yyyymmdd_hhmmss(d = new Date()) {
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    '-' +
    pad(d.getMinutes()) +
    '-' +
    pad(d.getSeconds())
  );
}
function baseName(p: string) {
  const n = p.split('/').pop() || 'file';
  return n.replace(/\s+/g, '_');
}

// We keep uriToBlob/contentType helpers in case you
// want to re-enable real uploads later.
async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  // @ts-ignore - RN fetch polyfill in Expo supports blob()
  const blob = await res.blob();
  return blob as Blob;
}
function contentTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

// ---------- LOCAL-ONLY UPLOAD SHIMS ----------

// Pretend to "upload" a video, but really just:
// - verifies the file exists locally
// - returns a fake key and the original URI as the "url"
export async function uploadFileOnTap(
  localUri: string
): Promise<{ key: string; url: string }> {
  console.log('[uploadFileOnTap] Firebase disabled — local-only mode.');

  const info = await FileSystem.getInfoAsync(localUri);
  // @ts-ignore
  if (!(info as any)?.exists) {
    throw new Error(`File not found: ${localUri}`);
  }

  const name = baseName(localUri);
  const stamp = yyyymmdd_hhmmss();
  const key = `local-videos/${stamp}_${name}`;

  // No real upload – just return local URI
  return {
    key,
    url: localUri,
  };
}

// Pretend to "upload" JSON sidecar, but return a fake key/url
export async function uploadJSONOnTap(
  jsonData: unknown,
  prefix = 'local-sidecars/'
): Promise<{ key: string; url: string }> {
  console.log('[uploadJSONOnTap] Firebase disabled — local-only mode.');
  const stamp = yyyymmdd_hhmmss();
  const key = `${prefix}${stamp}.json`;

  // No real upload – url is just a placeholder
  return {
    key,
    url: 'about:blank',
  };
}
