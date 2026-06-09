import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export type CloudAthlete = {
  id: string;
  name: string;
  updatedAt?: number | null;
  photoKey?: string | null;
  photoUpdatedAt?: number | null;
  photoUrl?: string | null;
};

export type DeletedCloudAthlete = {
  id: string;
  deletedAt: number;
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

function sanitizeAthletes(list: any): CloudAthlete[] {
  if (!Array.isArray(list)) return [];

  return list
    .map((a) => ({
      id: String(a?.id ?? '').trim(),
      name: String(a?.name ?? '').trim(),
      updatedAt: toNumberOrNull(a?.updatedAt),
      photoUrl: toStringOrNull(a?.photoUrl),
      photoKey: toStringOrNull(a?.photoKey),
      photoUpdatedAt: toNumberOrNull(a?.photoUpdatedAt),
    }))
    .filter((a) => a.id && a.name);
}

function sanitizeDeletedAthletes(list: any): DeletedCloudAthlete[] {
  if (!Array.isArray(list)) return [];

  const byId = new Map<string, DeletedCloudAthlete>();

  for (const item of list) {
    const id = String(item?.id ?? '').trim();
    if (!id) continue;

    const deletedAt = toNumberOrNull(item?.deletedAt) ?? Date.now();
    const existing = byId.get(id);

    if (!existing || deletedAt > existing.deletedAt) {
      byId.set(id, { id, deletedAt });
    }
  }

  return [...byId.values()];
}

export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export async function getCloudAthletes(uid: string): Promise<CloudAthlete[]> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  return sanitizeAthletes((data as any)?.athletes);
}

export async function getCloudDeletedAthletes(
  uid: string,
): Promise<DeletedCloudAthlete[]> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  return sanitizeDeletedAthletes((data as any)?.deletedAthletes);
}

export async function setCloudAthletes(
  uid: string,
  athletes: CloudAthlete[],
): Promise<void> {
  const ref = doc(db, 'users', uid);

  const cloudSafe = sanitizeAthletes(athletes).map((a) => ({
    id: a.id,
    name: a.name,
    updatedAt: a.updatedAt ?? null,
    photoKey: a.photoKey ?? null,
    photoUpdatedAt: a.photoUpdatedAt ?? null,
  }));

  await setDoc(ref, { athletes: cloudSafe }, { merge: true });
}

export async function setCloudDeletedAthletes(
  uid: string,
  deletedAthletes: DeletedCloudAthlete[],
): Promise<void> {
  const ref = doc(db, 'users', uid);

  const cloudSafe = sanitizeDeletedAthletes(deletedAthletes).map((d) => ({
    id: d.id,
    deletedAt: d.deletedAt,
  }));

  await setDoc(ref, { deletedAthletes: cloudSafe }, { merge: true });
}