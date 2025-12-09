// lib/videos.ts
// Small helper to load the current user's videos from Firestore.

import {
    collection,
    getDocs,
    getFirestore,
    query,
    where,
} from 'firebase/firestore';
import { app, ensureAnonymous } from './firebase';

// Minimal shape we care about for the library for now
export type VideoRow = {
  id: string;
  storageKey: string;
  sidecarRef?: string;
  createdAt: number;
  shareId: string;
};

export async function fetchMyVideos(): Promise<VideoRow[]> {
  const user = await ensureAnonymous();
  const db = getFirestore(app);

  const q = query(
    collection(db, 'videos'),
    where('ownerUid', '==', user.uid),
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      storageKey: data.storageKey as string,
      sidecarRef: data.sidecarRef as string | undefined,
      createdAt: data.createdAt as number,
      shareId: data.shareId as string,
    };
  });
}
