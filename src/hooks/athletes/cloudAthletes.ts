// src/hooks/athletes/cloudAthletes.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

/**
 * Cloud-safe athlete model (Firestore)
 * ✅ Never store file:// local URIs in cloud.
 *
 * Backwards compatible:
 * - photoUrl: legacy / current (can be tokened)
 * - photoKey: stable Backblaze object key (forever identifier)
 */
export type CloudAthlete = {
  id: string;
  name: string;
  photoUrl?: string | null; // legacy / current (may expire if tokened)
  photoKey?: string | null; // ✅ stable key in B2 (e.g. "videos/<uid>/athletes/<id>/profile_....jpg")
  photoUpdatedAt?: number | null; // optional (versioning / cache bust)
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

      // keep BOTH for backward compatibility
      photoUrl: toStringOrNull(a?.photoUrl),
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

  // ✅ always sanitize (defensive)
  const cloudSafe = sanitize(athletes);

  await setDoc(ref, { athletes: cloudSafe }, { merge: true });
}
