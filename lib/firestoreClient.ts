// lib/firestoreClient.ts
// Thin Firestore helpers for video metadata.

import { app, ensureAnonymous } from './firebase';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import type { VideoDoc } from '../types/firestore';

const db = getFirestore(app);

// Simple random ID generator for share links
function randomShareId(length = 12): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Create a VideoDoc for a newly uploaded video.
 * - Uses anonymous (or logged-in) Firebase user as ownerUid.
 * - Stores storageKey so we can find the file later (Firebase or B2).
 */
export async function createVideoDocFromUpload(opts: {
  storageKey: string;
  sidecarRef?: string;
  sport?: string;
  style?: string;
  athleteId?: string;
}): Promise<string> {
  const user = await ensureAnonymous();
  const now = Date.now();
  const shareId = randomShareId();

  const base: Omit<VideoDoc, 'id'> = {
    ownerUid: user.uid,
    athleteId: opts.athleteId,
    sport: opts.sport,
    style: opts.style,
    createdAt: now,
    updatedAt: now,
    storageKey: opts.storageKey,
    sidecarRef: opts.sidecarRef,
    shareId,
    isPublic: true,
  };

  const ref = await addDoc(collection(db, 'videos'), base as any);
  return ref.id;
}

/**
 * Look up a video by its shareId (for /watch/[shareId] later).
 */
export async function getVideoByShareId(
  shareId: string,
): Promise<(VideoDoc & { id: string }) | null> {
  const q = query(collection(db, 'videos'), where('shareId', '==', shareId));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as any) } as VideoDoc & {
    id: string;
  };
}

/**
 * List all videos for a given user (for /library later).
 */
export async function listVideosForUser(
  uid: string,
): Promise<(VideoDoc & { id: string })[]> {
  const q = query(collection(db, 'videos'), where('ownerUid', '==', uid));
  const snap = await getDocs(q);

  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) } as VideoDoc & { id: string }),
  );
}

// Export db in case we need raw access later
export { db };
