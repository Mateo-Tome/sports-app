// src/stats/loadClipsCloud.ts
import { collection, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import { app, auth, ensureAnonymous } from '../../lib/firebase';
import { fetchClipSidecarByShareId } from './fetchSidecarByShareId';
import type { ClipSidecar } from './types';

/**
 * Run async work in parallel, but limit concurrency so you don't spike network / function limits.
 */
async function mapLimit<T, R>(
  items: T[],
  maxConcurrent: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.max(1, maxConcurrent) }, async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}

/**
 * Cloud = "verified" stats = stats computed ONLY from clips that were uploaded
 * and have a shareId (and usually a sidecar in B2).
 *
 * IMPORTANT:
 * - Firestore is used ONLY to list which clips exist (metadata).
 * - Sidecar JSON is fetched from B2 through your Firebase Function proxy (getSidecar).
 * - No video downloading.
 */
export async function loadClipsForAthleteFromCloud(athleteName: string): Promise<ClipSidecar[]> {
  const clean = (athleteName || '').trim();
  if (!clean) return [];

  // make sure we have a user (anon ok)
  await ensureAnonymous();
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const db = getFirestore(app);

  // Only read metadata docs for this user + athlete
  const q = query(
    collection(db, 'videos'),
    where('ownerUid', '==', uid),
    where('athleteName', '==', clean),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  const snap = await getDocs(q);

  // fetch sidecars in parallel (6 at a time)
  const results = await mapLimit(snap.docs, 6, async (doc) => {
    const d: any = doc.data() || {};
    const shareId = String(d?.shareId || '').trim();
    if (!shareId) return null;

    try {
      const sc = await fetchClipSidecarByShareId(shareId);

      // Make sure createdAt exists (prefer Firestore timestamp/number if present)
      const createdAt =
        typeof d?.createdAt === 'number'
          ? d.createdAt
          : typeof (sc as any)?.createdAt === 'number'
            ? (sc as any).createdAt
            : Date.now();

      const clip: ClipSidecar = {
        ...(sc as any),
        athlete: (sc as any)?.athlete?.trim() ? (sc as any).athlete : clean,
        createdAt,
      } as any;

      return clip;
    } catch (e) {
      // If one clip fails, skip it (don’t break the whole stats page)
      console.log('[loadClipsForAthleteFromCloud] sidecar fetch failed', {
        shareId,
        athleteName: clean,
        e,
      });
      return null;
    }
  });

  const out = results.filter(Boolean) as ClipSidecar[];

  // newest first
  out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return out;
}

/**
 * Your screens import this name, so keep it.
 * For now it’s the same as loadClipsForAthleteFromCloud().
 */
export async function loadVerifiedClipsForAthleteFromCloud(athleteName: string): Promise<ClipSidecar[]> {
  return loadClipsForAthleteFromCloud(athleteName);
}
