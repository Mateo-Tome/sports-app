// lib/sync.ts
// Firebase Storage uploads for Expo (no native modules)
// Exports: uploadFileOnTap(fileUri), uploadJSONOnTap(data, prefix?)

import * as FileSystem from 'expo-file-system';

// Firebase web SDK (works in Expo)
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
    getDownloadURL,
    getStorage,
    ref,
    StorageReference,
    uploadBytes,
} from 'firebase/storage';

// ---- YOUR PROJECT CONFIG ----
// Double-check these in Firebase Console → Project settings → General → "Your apps" (Web)
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'sports-app-9efb3.firebaseapp.com',
  projectId: 'sports-app-9efb3',
  storageBucket: 'sports-app-9efb3.firebasestorage.app', // ← matches your screenshot
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Initialize app once
let app: FirebaseApp;
if (!getApps().length) app = initializeApp(firebaseConfig);
else app = getApps()[0];

// Auth (anonymous) so rules can require auth
const auth = getAuth(app);
let signedInOnce = false;
async function ensureAnonAuth() {
  if (!signedInOnce && !auth.currentUser) {
    await signInAnonymously(auth);
    signedInOnce = true;
    console.log('[sync] signed in anonymously:', !!auth.currentUser);
  }
}

// Storage
const storage = getStorage(app);

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

// ---------- uploads ----------
export async function uploadFileOnTap(localUri: string): Promise<{ key: string; url: string }> {
  await ensureAnonAuth();

  const info = await FileSystem.getInfoAsync(localUri);
  // @ts-ignore
  if (!(info as any)?.exists) throw new Error(`File not found: ${localUri}`);

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
  prefix = 'sidecars/'
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
