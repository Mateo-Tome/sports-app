// src/hooks/athletes/useAthleteSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { auth, authReady } from '../../../lib/firebase';
import { uploadAthleteProfilePhotoToB2 } from '../../lib/athletePhotoUpload';
import type { Athlete } from '../../lib/athleteTypes';
import {
  getCloudAthletes,
  getCloudDeletedAthletes,
  setCloudAthletes,
  setCloudDeletedAthletes,
  type DeletedCloudAthlete,
} from './cloudAthletes';

const ATHLETES_KEY_PREFIX = 'athletes:list';
const DELETED_ATHLETES_KEY_PREFIX = 'athletes:deleted';

function athletesKey(uid: string) {
  return `${ATHLETES_KEY_PREFIX}:${uid}`;
}

function deletedAthletesKey(uid: string) {
  return `${DELETED_ATHLETES_KEY_PREFIX}:${uid}`;
}

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

type CloudAthlete = {
  id: string;
  name: string;
  updatedAt?: number | null;
  photoUrl?: string | null;
  photoKey?: string | null;
  photoUpdatedAt?: number | null;
};

async function readLocalDeletedAthletes(uid: string): Promise<DeletedCloudAthlete[]> {
  try {
    const raw = await AsyncStorage.getItem(deletedAthletesKey(uid));
    const list = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(list)) return [];

    return list
      .map((x: any) => ({
        id: String(x?.id ?? '').trim(),
        deletedAt: toNumberOrNull(x?.deletedAt) ?? Date.now(),
      }))
      .filter((x) => x.id);
  } catch {
    return [];
  }
}

async function writeLocalDeletedAthletes(
  uid: string,
  deletedAthletes: DeletedCloudAthlete[],
) {
  await AsyncStorage.setItem(
    deletedAthletesKey(uid),
    JSON.stringify(mergeDeletedAthletes(deletedAthletes, [])),
  );
}

function mergeDeletedAthletes(
  a: DeletedCloudAthlete[],
  b: DeletedCloudAthlete[],
): DeletedCloudAthlete[] {
  const byId = new Map<string, DeletedCloudAthlete>();

  for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
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

function deletedIdSet(list: DeletedCloudAthlete[]): Set<string> {
  const ids = new Set<string>();

  for (const item of Array.isArray(list) ? list : []) {
    const id = String(item?.id ?? '').trim();
    if (id) ids.add(id);
  }

  return ids;
}

function normalizeLocal(list: Athlete[]): Athlete[] {
  const out: Athlete[] = [];
  const seen = new Set<string>();

  for (const a of Array.isArray(list) ? list : []) {
    const id = String((a as any)?.id ?? '').trim();
    const name = String((a as any)?.name ?? '').trim();

    if (!id || !name) continue;
    if (seen.has(id)) continue;

    seen.add(id);

    out.push({
      id,
      name,
      updatedAt: toNumberOrNull((a as any)?.updatedAt),
      photoLocalUri: toStringOrNull((a as any)?.photoLocalUri),
      photoUri: toStringOrNull((a as any)?.photoUri),
      photoUrl: toStringOrNull((a as any)?.photoUrl),
      photoKey: toStringOrNull((a as any)?.photoKey),
      photoUpdatedAt: toNumberOrNull((a as any)?.photoUpdatedAt),
      photoNeedsUpload: (a as any)?.photoNeedsUpload === true,
    } as any);
  }

  return out;
}

function normalizeCloud(list: CloudAthlete[]): CloudAthlete[] {
  const out: CloudAthlete[] = [];
  const seen = new Set<string>();

  for (const a of Array.isArray(list) ? list : []) {
    const id = String((a as any)?.id ?? '').trim();
    const name = String((a as any)?.name ?? '').trim();

    if (!id || !name) continue;
    if (seen.has(id)) continue;

    seen.add(id);

    out.push({
      id,
      name,
      updatedAt: toNumberOrNull((a as any)?.updatedAt),
      photoUrl: toStringOrNull((a as any)?.photoUrl),
      photoKey: toStringOrNull((a as any)?.photoKey),
      photoUpdatedAt: toNumberOrNull((a as any)?.photoUpdatedAt),
    });
  }

  return out;
}

function withoutDeleted<T extends { id?: any }>(list: T[], deletedIds: Set<string>): T[] {
  return (Array.isArray(list) ? list : []).filter((a) => {
    const id = String(a?.id ?? '').trim();
    return id && !deletedIds.has(id);
  });
}

function mergeAthletes(local: Athlete[], cloud: CloudAthlete[]): Athlete[] {
  const L = normalizeLocal(local);
  const C = normalizeCloud(cloud);

  const byId = new Map<string, Athlete>();

  for (const a of L) {
    byId.set(a.id, a);
  }

  for (const c of C) {
    const l = byId.get(c.id);

    const localUpdated =
      typeof (l as any)?.updatedAt === 'number' ? (l as any).updatedAt : 0;

    const cloudUpdated =
      typeof (c as any)?.updatedAt === 'number' ? (c as any).updatedAt : 0;

    const useCloudName = cloudUpdated > localUpdated;

    byId.set(c.id, {
      id: c.id,
      name: useCloudName
        ? c.name?.trim() || (l as any)?.name?.trim() || 'Unnamed Athlete'
        : (l as any)?.name?.trim() || c.name?.trim() || 'Unnamed Athlete',
      updatedAt: Math.max(localUpdated, cloudUpdated),

      photoKey: c.photoKey ?? (l as any)?.photoKey ?? null,
      photoUpdatedAt: c.photoUpdatedAt ?? (l as any)?.photoUpdatedAt ?? null,
      photoUrl: c.photoUrl ?? (l as any)?.photoUrl ?? null,

      photoLocalUri: (l as any)?.photoLocalUri ?? null,
      photoUri: (l as any)?.photoUri ?? null,
      photoNeedsUpload: (l as any)?.photoNeedsUpload === true,
    } as any);
  }

  const merged: Athlete[] = [];
  const used = new Set<string>();

  for (const c of C) {
    const v = byId.get(c.id);
    if (v && !used.has(v.id)) {
      merged.push(v);
      used.add(v.id);
    }
  }

  for (const l of L) {
    const v = byId.get(l.id);
    if (v && !used.has(v.id)) {
      merged.push(v);
      used.add(v.id);
    }
  }

  return merged;
}

async function readLocalFromStorage(uid: string): Promise<Athlete[]> {
  try {
    const raw = await AsyncStorage.getItem(athletesKey(uid));
    const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function toCloudPayload(list: Athlete[]): CloudAthlete[] {
  return (Array.isArray(list) ? list : []).map((a: any) => ({
    id: String(a?.id ?? '').trim(),
    name: String(a?.name ?? '').trim(),
    updatedAt:
      typeof a?.updatedAt === 'number' &&
        Number.isFinite(a.updatedAt) &&
        a.updatedAt > 0
        ? a.updatedAt
        : Date.now(),
    photoKey: toStringOrNull(a?.photoKey),
    photoUpdatedAt: toNumberOrNull(a?.photoUpdatedAt),
    photoUrl: toStringOrNull(a?.photoUrl),
  }));
}

export default function useAthleteSync(params: {
  setLocal: (list: Athlete[]) => void;
  showAlerts?: boolean;
}) {
  const { setLocal, showAlerts = true } = params;
  const [syncing, setSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);

    try {
      const user = auth.currentUser ?? (await authReady());

      if (!user || user.isAnonymous) {
        throw new Error('Sign in required to sync athletes.');
      }

      const uid = user.uid;

      const localDeleted = await readLocalDeletedAthletes(uid);
      const cloudDeleted = await getCloudDeletedAthletes(uid);
      const mergedDeleted = mergeDeletedAthletes(localDeleted, cloudDeleted);
      const deletedIds = deletedIdSet(mergedDeleted);

      const localRaw = await readLocalFromStorage(uid);
      const cloudRaw = await getCloudAthletes(uid);

      const localList = withoutDeleted(localRaw, deletedIds);
      const cloudList = withoutDeleted(cloudRaw as any, deletedIds);

      let merged = mergeAthletes(localList, cloudList as any);

      let uploadedCount = 0;
      let failedCount = 0;

      const nextMerged: Athlete[] = [];

      for (const a of merged) {
        if (deletedIds.has(a.id)) continue;

        const needs = (a as any)?.photoNeedsUpload === true;
        const localUri = toStringOrNull((a as any)?.photoLocalUri);

        if (needs && localUri) {
          try {
            const up = await uploadAthleteProfilePhotoToB2({
              athleteId: a.id,
              localFileUri: localUri,
            });

            uploadedCount++;

            nextMerged.push({
              ...(a as any),
              photoKey: up.photoKey,
              photoUpdatedAt: Date.now(),
              photoUrl: up.photoUrl ?? (a as any)?.photoUrl ?? null,
              photoNeedsUpload: false,
            } as any);

            continue;
          } catch {
            failedCount++;
            nextMerged.push(a);
            continue;
          }
        }

        nextMerged.push(a);
      }

      merged = withoutDeleted(nextMerged, deletedIds);

      await setCloudDeletedAthletes(uid, mergedDeleted);
      await setCloudAthletes(uid, toCloudPayload(merged) as any);

      await writeLocalDeletedAthletes(uid, mergedDeleted);
      await AsyncStorage.setItem(athletesKey(uid), JSON.stringify(merged));
      setLocal(merged);

      if (showAlerts) {
        if (failedCount > 0) {
          Alert.alert(
            'Synced (some pending)',
            `Synced ${merged.length} athlete(s).\nUploaded ${uploadedCount} photo(s).\n${failedCount} photo(s) still pending.`
          );
        } else if (uploadedCount > 0) {
          Alert.alert(
            'Synced',
            `Synced ${merged.length} athlete(s).\nUploaded ${uploadedCount} photo(s).`
          );
        } else {
          Alert.alert('Synced', `Synced ${merged.length} athlete(s).`);
        }
      }
    } catch (e: any) {
      console.log('[useAthleteSync] sync failed:', e);
      if (showAlerts) Alert.alert('Sync failed', String(e?.message ?? e));
    } finally {
      setSyncing(false);
    }
  }, [setLocal, showAlerts, syncing]);

  return { syncing, syncNow };
}