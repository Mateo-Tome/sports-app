// src/hooks/athletes/cloudAthletes.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

/**
 * Cloud-safe athlete model (Firestore)
 * ✅ Never store file:// local URIs in cloud.
 *
 * We only WRITE stable fields:
 * - photoKey (stable forever)
 * - photoUpdatedAt (version)
 *
 * Legacy:
 * - photoUrl may exist in old data; we READ it but never WRITE it.
 */
export type CloudAthlete = {
  id: string;
  name: string;

  // ✅ stable forever
  photoKey?: string | null;
  photoUpdatedAt?: number | null;

  // legacy (read-only, may be tokened/expire)
  photoUrl?: string | null;
};

function toStringOrNull(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

function toNumberOrNull(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitize(list: any): CloudAthlete[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => ({
      id: String(a?.id ?? '').trim(),
      name: String(a?.name ?? '').trim(),

      // legacy (read only)
      photoUrl: toStringOrNull(a?.photoUrl),

      // stable
      photoKey: toStringOrNull(a?.photoKey),
      photoUpdatedAt: toNumberOrNull(a?.photoUpdatedAt),
    }))
    .filter((a) => a.id && a.name);
}

export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export async function getCloudAthletes(uid: string): Promise<CloudAthlete[]> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  return sanitize((data as any)?.athletes);
}

export async function setCloudAthletes(uid: string, athletes: CloudAthlete[]): Promise<void> {
  const ref = doc(db, 'users', uid);

  // ✅ sanitize, then STRIP legacy fields before writing
  const cloudSafe = sanitize(athletes).map((a) => ({
    id: a.id,
    name: a.name,
    photoKey: a.photoKey ?? null,
    photoUpdatedAt: a.photoUpdatedAt ?? null,
    // 🚫 do NOT write photoUrl
  }));

  await setDoc(ref, { athletes: cloudSafe }, { merge: true });
}
