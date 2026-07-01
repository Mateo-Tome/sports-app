// lib/library/indexStore.ts

import * as FileSystem from 'expo-file-system';

const DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = DIR + 'index.json';
const BACKUP_PATH = DIR + 'index.backup.json';

export type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  athleteName?: string;
  athleteId?: string | null;
  sport: string;
  createdAt: number;
  assetId?: string;

  gameId?: string | null;
  gameTitle?: string | null;
};

let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);

  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

async function readJsonList(path: string): Promise<IndexMeta[] | null> {
  try {
    const info: any = await FileSystem.getInfoAsync(path);
    if (!info?.exists) return null;

    const raw = await FileSystem.readAsStringAsync(path);
    const list = JSON.parse(raw || '[]');

    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export async function readIndex(): Promise<IndexMeta[]> {
  const main = await readJsonList(INDEX_PATH);
  if (main) return main;

  const backup = await readJsonList(BACKUP_PATH);
  if (backup) return backup;

  return [];
}

async function writeIndexInner(list: IndexMeta[]) {
  if (!Array.isArray(list)) {
    throw new Error('writeIndexAtomic: list must be an array');
  }

  await ensureDir();

  const tmp = INDEX_PATH + '.tmp';
  const backupTmp = BACKUP_PATH + '.tmp';

  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(list));

  const currentInfo: any = await FileSystem.getInfoAsync(INDEX_PATH);
  if (currentInfo?.exists) {
    try {
      await FileSystem.copyAsync({ from: INDEX_PATH, to: backupTmp });
      await FileSystem.deleteAsync(BACKUP_PATH, { idempotent: true });
      await FileSystem.moveAsync({ from: backupTmp, to: BACKUP_PATH });
    } catch {
      await FileSystem.deleteAsync(backupTmp, { idempotent: true }).catch(() => {});
    }
  }

  await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: tmp, to: INDEX_PATH });
}

export function writeIndexAtomic(list: IndexMeta[]): Promise<void> {
  return enqueueWrite(() => writeIndexInner(list));
}

export function updateIndex(
  updater: (list: IndexMeta[]) => IndexMeta[] | Promise<IndexMeta[]>,
): Promise<IndexMeta[]> {
  return enqueueWrite(async () => {
    const current = await readIndex();
    const next = await updater(current);

    if (!Array.isArray(next)) {
      throw new Error('updateIndex: updater must return an array');
    }

    await writeIndexInner(next);
    return next;
  });
}

export async function updateDisplayName(uri: string, newName: string) {
  let didUpdate = false;

  await updateIndex((list) => {
    let changed = false;

    const next = list.map((e) => {
      if (e.uri === uri) {
        changed = true;
        return { ...e, displayName: newName };
      }

      return e;
    });

    if (changed) {
      didUpdate = true;
      return next;
    }

    const fileName = uri.split('/').pop() || '';
    const hit = list.find((e) => (e.uri.split('/').pop() || '') === fileName);

    if (hit) {
      didUpdate = true;
      return list.map((e) => (e === hit ? { ...e, displayName: newName } : e));
    }

    return list;
  });

  return didUpdate;
}