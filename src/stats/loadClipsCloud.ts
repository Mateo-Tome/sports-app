import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { app, auth, authReady } from '../../lib/firebase';
import { fetchClipSidecarByShareId } from './fetchSidecarByShareId';
import type { ClipSidecar } from './types';

async function mapLimit<T, R>(
  items: T[],
  maxConcurrent: number,
  fn: (item: T, idx: number) => Promise<R>,
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

function clean(v: any): string {
  return typeof v === 'string' ? v.trim() : '';
}

function cleanOrNull(v: any): string | null {
  const s = clean(v);
  return s.length ? s : null;
}

async function getSignedInUid(): Promise<string | null> {
  const user = auth.currentUser ?? (await authReady());

  if (!user || user.isAnonymous) {
    return null;
  }

  return user.uid;
}

export async function loadClipsForAthleteFromCloud(
  athleteName: string,
  athleteId?: string | null,
): Promise<ClipSidecar[]> {
  const cleanName = clean(athleteName);
  const cleanId = cleanOrNull(athleteId);

  if (!cleanName && !cleanId) return [];

  const uid = await getSignedInUid();
  if (!uid) return [];

  const db = getFirestore(app);
  const videosRef = collection(db, 'videos');

  const snaps = [];

  if (cleanId) {
    const byId = query(
      videosRef,
      where('ownerUid', '==', uid),
      where('athleteId', '==', cleanId),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    snaps.push(await getDocs(byId));
  }

  if (cleanName) {
    const byName = query(
      videosRef,
      where('ownerUid', '==', uid),
      where('athleteName', '==', cleanName),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    snaps.push(await getDocs(byName));
  }

  const docsById = new Map<string, any>();

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      docsById.set(doc.id, doc);
    }
  }

  const docs = Array.from(docsById.values());

  const results = await mapLimit(docs, 6, async (doc) => {
    const d: any = doc.data() || {};
    const shareId = clean(d?.shareId);

    if (!shareId) return null;

    try {
      const sc = await fetchClipSidecarByShareId(shareId);

      const sidecarAthleteName =
        clean((sc as any)?.athleteName) ||
        clean((sc as any)?.athlete) ||
        clean(d?.athleteName) ||
        cleanName ||
        'Unassigned';

      const sidecarAthleteId =
        cleanOrNull((sc as any)?.athleteId) ??
        cleanOrNull(d?.athleteId) ??
        cleanId;

      const createdAt =
        typeof d?.createdAt === 'number'
          ? d.createdAt
          : typeof (sc as any)?.createdAt === 'number'
            ? (sc as any).createdAt
            : Date.now();

      const clip: ClipSidecar = {
        ...(sc as any),

        athlete: sidecarAthleteName,
        athleteName: sidecarAthleteName,
        athleteId: sidecarAthleteId,

        createdAt,
      } as any;

      return clip;
    } catch (e) {
      console.log('[loadClipsForAthleteFromCloud] sidecar fetch failed', {
        shareId,
        athleteName: cleanName,
        athleteId: cleanId,
        e,
      });

      return null;
    }
  });

  const out = results.filter(Boolean) as ClipSidecar[];

  out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return out;
}

export async function loadVerifiedClipsForAthleteFromCloud(
  athleteName: string,
  athleteId?: string | null,
): Promise<ClipSidecar[]> {
  return loadClipsForAthleteFromCloud(athleteName, athleteId);
}