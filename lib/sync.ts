// lib/sync.ts
// Firebase Storage uploads for Expo (no native modules)
// Exports: uploadFileOnTap(fileUri), uploadJSONOnTap(data, prefix?)

import * as FileSystem from 'expo-file-system';

// Firebase Storage helpers
import {
  getDownloadURL,
  ref,
  type StorageReference,
  uploadBytes,
} from 'firebase/storage';

// ✅ Reuse our shared Firebase setup (auth + storage)
import { ensureAnonymous, storage } from './firebase';

// ---------- utils ----------
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

// ---------- auth helper ----------
async function ensureAnonAuth() {
  // Delegate to shared Firebase helper (with RN persistence)
  await ensureAnonymous();
}

// ---------- uploads ----------
export async function uploadFileOnTap(
  localUri: string,
): Promise<{ key: string; url: string }> {
  await ensureAnonAuth();

  const info = await FileSystem.getInfoAsync(localUri);
  // @ts-ignore
  if (!(info as any)?.exists) {
    throw new Error(`File not found: ${localUri}`);
  }

  const name = baseName(localUri);
  const stamp = yyyymmdd_hhmmss();
  const key = `videos/${stamp}_${name}`;
  const storageRef: StorageReference = ref(storage, key);

  const blob = await uriToBlob(localUri);
  const ct = contentTypeFromName(name);

  await uploadBytes(storageRef, blob, { contentType: ct });
  const url = await getDownloadURL(storageRef);

  console.log('[uploadFileOnTap]', {
    bucket: storage.app.options['storageBucket'],
    key,
    url,
  });

  return { key, url };
}

export async function uploadJSONOnTap(
  jsonData: unknown,
  prefix = 'sidecars/',
): Promise<{ key: string; url: string }> {
  await ensureAnonAuth();

  const stamp = yyyymmdd_hhmmss();
  const key = `${prefix}${stamp}.json`;
  const storageRef: StorageReference = ref(storage, key);

  const blob = new Blob([JSON.stringify(jsonData ?? {}, null, 2)], {
    type: 'application/json',
  });

  await uploadBytes(storageRef, blob, { contentType: 'application/json' });
  const url = await getDownloadURL(storageRef);

  console.log('[uploadJSONOnTap]', {
    bucket: storage.app.options['storageBucket'],
    key,
    url,
  });

  return { key, url };
}
