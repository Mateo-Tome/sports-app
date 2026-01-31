// src/hooks/athletes/useAthleteSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { ensureAnonymous } from '../../../lib/firebase';
import type { Athlete } from '../../lib/athleteTypes';
import { getCloudAthletes, setCloudAthletes } from './cloudAthletes';

const ATHLETES_KEY = 'athletes:list';

function toStringOrNull(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

type CloudAthlete = { id: string; name: string; photoUrl?: string | null };

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
    });
  }

  return out;
}

/**
 * Merge rules:
 * - cloud "name" wins if present
 * - cloud "photoUrl" wins if present
 * - local-only fields (photoLocalUri, photoUri) NEVER come from cloud
 */
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

      // cloud truth (cross-device)
      photoUrl: c.photoUrl ?? l?.photoUrl ?? null,

      // device-only fields stay device-only
      photoLocalUri: l?.photoLocalUri ?? null,
      photoUri: l?.photoUri ?? null,
    } as any);
  }

  // keep ordering: cloud first, then local-only
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

async function readLocalFromStorage(): Promise<Athlete[]> {
  try {
    const raw = await AsyncStorage.getItem(ATHLETES_KEY);
    const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function toCloudPayload(list: Athlete[]): CloudAthlete[] {
  // only cloud-safe fields
  return (Array.isArray(list) ? list : []).map((a: any) => ({
    id: String(a?.id ?? '').trim(),
    name: String(a?.name ?? '').trim(),
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
      const user = await ensureAnonymous();
      const uid = user.uid;

      // ✅ Always read from AsyncStorage (source of truth), avoids stale React state
      const localList = await readLocalFromStorage();

      const cloudList = await getCloudAthletes(uid);

      const merged = mergeAthletes(localList, cloudList);

      // ✅ Push ONLY cloud-safe fields
      await setCloudAthletes(uid, toCloudPayload(merged));

      // ✅ Save merged locally (preserves photoLocalUri)
      await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(merged));
      setLocal(merged);

      if (showAlerts) Alert.alert('Synced', `Synced ${merged.length} athlete(s).`);
    } catch (e: any) {
      console.log('[useAthleteSync] sync failed:', e);
      if (showAlerts) Alert.alert('Sync failed', String(e?.message ?? e));
    } finally {
      setSyncing(false);
    }
  }, [setLocal, showAlerts, syncing]);

  return { syncing, syncNow };
}
