// lib/library/indexStore.ts

import * as FileSystem from 'expo-file-system';

const DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = DIR + 'index.json';

export type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  createdAt: number;
  assetId?: string;
};

// ---------- index helpers ----------
export async function readIndex(): Promise<IndexMeta[]> {
  try {
    const info: any = await FileSystem.getInfoAsync(INDEX_PATH);
    if (!info?.exists) return [];
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function writeIndexAtomic(list: IndexMeta[]) {
  const tmp = INDEX_PATH + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(list));
  try {
    await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true });
  } catch {}
  await FileSystem.moveAsync({ from: tmp, to: INDEX_PATH });
}

// --- update displayName for a single entry (by uri)
export async function updateDisplayName(uri: string, newName: string) {
  const list = await readIndex();
  let changed = false;
  const next = list.map((e) => {
    if (e.uri === uri) {
      changed = true;
      return { ...e, displayName: newName };
    }
    return e;
  });
  if (changed) {
    await writeIndexAtomic(next);
  } else {
    // try to recover if path moved but filename matches current media
    const fileName = uri.split('/').pop() || '';
    const hit = list.find((e) => (e.uri.split('/').pop() || '') === fileName);
    if (hit) {
      const next2 = list.map((e) =>
        e === hit ? { ...e, displayName: newName } : e,
      );
      await writeIndexAtomic(next2);
    }
  }
  return true;
}
