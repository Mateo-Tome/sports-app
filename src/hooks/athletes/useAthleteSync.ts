// src/hooks/athletes/useAthleteSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { ensureAnonymous } from '../../../lib/firebase';
import { uploadAthleteProfilePhotoToB2 } from '../../lib/athletePhotoUpload';
import type { Athlete } from '../../lib/athleteTypes';
import { getCloudAthletes, setCloudAthletes } from './cloudAthletes';

const ATHLETES_KEY_PREFIX = 'athletes:list';

function athletesKey(uid: string) {
  return `${ATHLETES_KEY_PREFIX}:${uid}`;
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
  photoUrl?: string | null; // legacy
  photoKey?: string | null; // stable
  photoUpdatedAt?: number | null;
};

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
      photoUrl: toStringOrNull((a as any)?.photoUrl),
      photoKey: toStringOrNull((a as any)?.photoKey),
      photoUpdatedAt: toNumberOrNull((a as any)?.photoUpdatedAt),
    });
  }
  return out;
}

function mergeAthletes(local: Athlete[], cloud: CloudAthlete[]): Athlete[] {
  const L = normalizeLocal(local);
  const C = normalizeCloud(cloud);

  const byId = new Map<string, Athlete>();
  for (const a of L) byId.set(a.id, a);

  for (const c of C) {
    const l = byId.get(c.id);

    byId.set(c.id, {
      id: c.id,
      name: c.name?.trim() ? c.name.trim() : (l?.name ?? c.name),

      // cloud truth
      photoKey: c.photoKey ?? (l as any)?.photoKey ?? null,
      photoUpdatedAt: c.photoUpdatedAt ?? (l as any)?.photoUpdatedAt ?? null,
      photoUrl: c.photoUrl ?? (l as any)?.photoUrl ?? null,

      // device-only stays device-only
      photoLocalUri: (l as any)?.photoLocalUri ?? null,
      photoUri: (l as any)?.photoUri ?? null,

      // keep local queue flag
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
    photoKey: toStringOrNull(a?.photoKey),
    photoUpdatedAt: toNumberOrNull(a?.photoUpdatedAt),
    // keep legacy for now (optional)
    photoUrl: toStringOrNull(a?.photoUrl),
  }));
}

export default function useAthleteSync(params: { setLocal: (list: Athlete[]) => void; showAlerts?: boolean }) {
  const { setLocal, showAlerts = true } = params;
  const [syncing, setSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);

    try {
      const user = await ensureAnonymous();
      const uid = user.uid;

      const localList = await readLocalFromStorage(uid);
      const cloudList = await getCloudAthletes(uid);

      let merged = mergeAthletes(localList, cloudList as any);

      // ✅ Upload photos ONLY if queued
      let uploadedCount = 0;
      let failedCount = 0;

      const nextMerged: Athlete[] = [];
      for (const a of merged) {
        const needs = (a as any)?.photoNeedsUpload === true;
        const localUri = toStringOrNull((a as any)?.photoLocalUri);

        if (needs && localUri) {
          try {
            const up = await uploadAthleteProfilePhotoToB2({ athleteId: a.id, localFileUri: localUri });
            uploadedCount++;

            nextMerged.push({
              ...(a as any),
              photoKey: up.photoKey,
              photoUpdatedAt: Date.now(),
              // optional keep for now; but don’t rely on it
              photoUrl: up.photoUrl ?? (a as any)?.photoUrl ?? null,
              photoNeedsUpload: false,
            } as any);
            continue;
          } catch (e) {
            failedCount++;
            // keep it queued for next Sync attempt
            nextMerged.push(a);
            continue;
          }
        }

        nextMerged.push(a);
      }

      merged = nextMerged;

      // ✅ Push ONLY cloud-safe fields (now includes photoKey)
      await setCloudAthletes(uid, toCloudPayload(merged) as any);

      // ✅ Save merged locally (preserves photoLocalUri)
      await AsyncStorage.setItem(athletesKey(uid), JSON.stringify(merged));
      setLocal(merged);

      if (showAlerts) {
        if (failedCount > 0) {
          Alert.alert(
            'Synced (some pending)',
            `Synced ${merged.length} athlete(s).\nUploaded ${uploadedCount} photo(s).\n${failedCount} photo(s) still pending (likely no network).`
          );
        } else if (uploadedCount > 0) {
          Alert.alert('Synced', `Synced ${merged.length} athlete(s).\nUploaded ${uploadedCount} photo(s).`);
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
