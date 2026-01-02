// lib/sync/syncStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncMap, SyncStatus } from './syncTypes';

const KEY = 'sync:map:v1';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export async function readSyncMap(): Promise<SyncMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? (parsed as SyncMap) : {};
  } catch {
    return {};
  }
}

export async function writeSyncMap(map: SyncMap) {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

// Always ensure updatedAt exists
function stamp(status: SyncStatus): SyncStatus {
  const now = Date.now();

  switch (status.state) {
    case 'local_only':
      return { state: 'local_only', updatedAt: status.updatedAt ?? now };

    case 'uploaded':
      return {
        state: 'uploaded',
        shareId: status.shareId,
        storageKey: status.storageKey,
        url: status.url,
        updatedAt: status.updatedAt ?? now,
      };

    case 'error':
      return {
        state: 'error',
        message: status.message,
        updatedAt: status.updatedAt ?? now,
      };
  }
}

export async function setSyncStatus(
  mapKey: string,
  status: SyncStatus,
): Promise<SyncMap> {
  const current = await readSyncMap();
  const next: SyncMap = { ...current, [mapKey]: stamp(status) };
  await writeSyncMap(next);
  return next;
}

export async function getSyncStatus(mapKey: string): Promise<SyncStatus | null> {
  const map = await readSyncMap();
  return map[mapKey] ?? null;
}
