import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { ensureAnonymous } from '../../../lib/firebase';
import type { Athlete } from './cloudAthletes';
import { getCloudAthletes, setCloudAthletes } from './cloudAthletes';

const ATHLETES_KEY = 'athletes:list';

function normalize(list: Athlete[]): Athlete[] {
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
      photoUri: (a as any)?.photoUri != null ? String((a as any).photoUri) : null,
    });
  }
  return out;
}

// Prefer CLOUD names/photos if same id exists on both sides.
// If ids differ but names match, we still keep both (simple + safe).
function mergeAthletes(local: Athlete[], cloud: Athlete[]): Athlete[] {
  const L = normalize(local);
  const C = normalize(cloud);

  const byId = new Map<string, Athlete>();

  // Start with local
  for (const a of L) byId.set(a.id, a);

  // Cloud overrides local if same id
  for (const a of C) byId.set(a.id, a);

  // Most recent-ish order: cloud first (usually “source of truth”), then locals that weren’t in cloud
  const merged: Athlete[] = [];
  const used = new Set<string>();

  for (const a of C) {
    const v = byId.get(a.id);
    if (v && !used.has(v.id)) {
      merged.push(v);
      used.add(v.id);
    }
  }
  for (const a of L) {
    const v = byId.get(a.id);
    if (v && !used.has(v.id)) {
      merged.push(v);
      used.add(v.id);
    }
  }

  return merged;
}

export function useAthleteSync(params: {
  getLocal: () => Athlete[];
  setLocal: (list: Athlete[]) => void;
}) {
  const { getLocal, setLocal } = params;
  const [syncing, setSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);

    try {
      // Ensure we have a uid (anonymous is fine)
      const user = await ensureAnonymous();
      const uid = user.uid;

      // ✅ SAFE ORDER:
      // 1) Pull cloud first
      const cloudList = await getCloudAthletes(uid);

      // 2) Merge with local
      const localList = getLocal();
      const merged = mergeAthletes(localList, cloudList);

      // 3) Push merged back to cloud (prevents wiping)
      await setCloudAthletes(uid, merged);

      // 4) Save locally + update UI
      await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(merged));
      setLocal(merged);

      Alert.alert('Synced', `Synced ${merged.length} athlete(s).`);
    } catch (e: any) {
      console.log('[useAthleteSync] sync failed:', e);
      Alert.alert('Sync failed', String(e?.message ?? e));
    } finally {
      setSyncing(false);
    }
  }, [getLocal, setLocal, syncing]);

  return { syncing, syncNow };
}

export default useAthleteSync;
