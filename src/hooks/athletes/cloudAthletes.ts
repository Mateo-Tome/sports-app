import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export type Athlete = { id: string; name: string; photoUri?: string | null };

function sanitize(list: any): Athlete[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => ({
      id: String(a?.id ?? ''),
      name: String(a?.name ?? '').trim(),
      photoUri: a?.photoUri != null ? String(a.photoUri) : null,
    }))
    .filter((a) => a.id && a.name);
}

export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export async function getCloudAthletes(uid: string): Promise<Athlete[]> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  return sanitize((data as any)?.athletes);
}

export async function setCloudAthletes(uid: string, athletes: Athlete[]): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { athletes }, { merge: true });
}
