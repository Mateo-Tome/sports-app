// src/hooks/athletes/cloudAthletes.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

/**
 * Cloud-safe athlete model (Firestore)
 * DO NOT store file:// local URIs.
 */
export type CloudAthlete = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

function toStringOrNull(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

function sanitize(list: any): CloudAthlete[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => ({
      id: String(a?.id ?? '').trim(),
      name: String(a?.name ?? '').trim(),
      photoUrl: toStringOrNull(a?.photoUrl),
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
