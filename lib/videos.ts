// lib/videos.ts
// Load the current user's videos from Firestore, including fields needed for Library UI.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import { app, ensureAnonymous } from './firebase';

const SIDECARS_COLLECTION = 'sidecars';

export type VideoRow = {
  id: string;
  storageKey: string;
  shareId: string;
  createdAt: number;

  // Display fields
  athlete?: string;
  sport?: string;
  displayName?: string;

  // Score / styling fields (optional)
  outcome?: 'W' | 'L' | 'T' | null;
  myScore?: number | null;
  oppScore?: number | null;
  highlightGold?: boolean | null;
  edgeColor?: string | null;

  // Sidecar linking
  sidecarRef?: string;
};

function normalizeSidecarRef(sidecarRef?: string): { col: string; id: string } | null {
  if (!sidecarRef) return null;

  // allow "sidecars/ABC" or just "ABC"
  const s = String(sidecarRef);
  if (s.includes('/')) {
    const parts = s.split('/').filter(Boolean);
    if (parts.length >= 2) return { col: parts[0], id: parts[1] };
  }
  return { col: SIDECARS_COLLECTION, id: s };
}

async function readSidecar(db: any, sidecarRef?: string) {
  const ref = normalizeSidecarRef(sidecarRef);
  if (!ref) return null;

  try {
    const snap = await getDoc(doc(db, ref.col, ref.id));
    if (!snap.exists()) return null;
    return snap.data() as any;
  } catch {
    return null;
  }
}

export async function fetchMyVideos(): Promise<VideoRow[]> {
  const user = await ensureAnonymous();
  const db = getFirestore(app);

  const q = query(collection(db, 'videos'), where('ownerUid', '==', user.uid));
  const snap = await getDocs(q);

  // Pull base docs first
  const base = snap.docs.map((d) => {
    const data = d.data() as any;

    return {
      id: d.id,
      storageKey: data.storageKey as string,
      shareId: data.shareId as string,
      createdAt: (data.createdAt as number) ?? Date.now(),

      athlete: data.athlete as string | undefined,
      sport: data.sport as string | undefined,
      displayName: (data.displayName ?? data.title) as string | undefined,

      outcome: (data.outcome ?? null) as any,
      myScore: (data.myScore ?? null) as number | null,
      oppScore: (data.oppScore ?? null) as number | null,
      highlightGold: (data.highlightGold ?? null) as boolean | null,
      edgeColor: (data.edgeColor ?? null) as string | null,

      sidecarRef: data.sidecarRef as string | undefined,
    } satisfies VideoRow;
  });

  // If you don't store athlete/sport/title/score on the videos doc,
  // try to enrich from sidecarRef.
  const enriched = await Promise.all(
    base.map(async (v) => {
      if (!v.sidecarRef) return v;

      const s = await readSidecar(db, v.sidecarRef);
      if (!s) return v;

      // Merge (videos doc wins if it already has values)
      return {
        ...v,
        athlete: v.athlete ?? s.athlete,
        sport: v.sport ?? s.sport,
        displayName: v.displayName ?? s.displayName ?? s.title ?? s.name,

        outcome: (v.outcome ?? s.outcome) ?? null,
        myScore: (v.myScore ?? s.myScore) ?? null,
        oppScore: (v.oppScore ?? s.oppScore) ?? null,
        highlightGold: (v.highlightGold ?? s.highlightGold) ?? null,
        edgeColor: (v.edgeColor ?? s.edgeColor) ?? null,
      } as VideoRow;
    }),
  );

  // Sort newest first
  enriched.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return enriched;
}
