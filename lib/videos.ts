// lib/videos.ts
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { app, ensureAnonymous } from './firebase';

export type LibraryStyle = {
  edgeColor?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  highlight?: boolean | null;
};

export type VideoRow = {
  id: string;

  // identity
  shareId: string;

  // timestamps
  createdAt: any;

  // naming/grouping
  athleteName?: string | null;
  athlete?: string | null;
  sport?: string | null;
  sportStyle?: string | null;
  title?: string | null;
  originalFileName?: string | null;

  // scoring (legacy / optional)
  result?: 'W' | 'L' | 'T' | string | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  scoreText?: string | null;

  // ✅ NEW: generic, sport-agnostic presentation bundle
  libraryStyle?: LibraryStyle | null;

  // ✅ legacy presentation fields (optional)
  edgeColor?: string | null;
  highlightGold?: boolean | null;

  // storage pointers (any era)
  b2VideoKey?: string | null;
  b2SidecarKey?: string | null;
  storageKey?: string | null;
  sidecarRef?: string | null;
  url?: string | null;
  storagePath?: string | null;

  // misc
  bytes?: number | null;
};

export async function fetchMyVideos(): Promise<VideoRow[]> {
  const user = await ensureAnonymous();
  const db = getFirestore(app);

  const q = query(
    collection(db, 'videos'),
    where('ownerUid', '==', user.uid),
    orderBy('createdAt', 'desc'),
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;

    return {
      id: d.id,
      shareId: data.shareId ?? d.id,

      createdAt: data.createdAt ?? null,

      athleteName: data.athleteName ?? null,
      athlete: data.athlete ?? null,
      sport: data.sport ?? null,
      sportStyle: data.sportStyle ?? data.style ?? null,
      title: data.title ?? null,
      originalFileName: data.originalFileName ?? null,

      result: data.result ?? null,
      scoreFor: data.scoreFor ?? null,
      scoreAgainst: data.scoreAgainst ?? null,
      scoreText: data.scoreText ?? null,

      // ✅ NEW
      libraryStyle: (data.libraryStyle ?? null) as any,

      // ✅ legacy
      edgeColor: data.edgeColor ?? null,
      highlightGold: typeof data.highlightGold === 'boolean' ? data.highlightGold : null,

      b2VideoKey: data.b2VideoKey ?? null,
      b2SidecarKey: data.b2SidecarKey ?? null,
      storageKey: data.storageKey ?? null,
      sidecarRef: data.sidecarRef ?? null,
      url: data.url ?? null,
      storagePath: data.storagePath ?? null,

      bytes: data.bytes ?? null,
    };
  });
}
