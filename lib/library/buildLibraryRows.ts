// lib/library/buildLibraryRows.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import type { LibraryRow } from '../../components/library/LibraryVideoRow';
import { readIndex, type IndexMeta } from './indexStore';
import { readOutcomeFor } from './sidecars';
import {
    getOrCreateThumb,
    sweepOrphanThumbs,
    thumbPathFor,
} from './thumbs';

const ATHLETES_KEY = 'athletes:list';
const UPLOADED_MAP_KEY = 'uploaded:map';

type Athlete = { id: string; name: string; photoUri?: string | null };
type Row = LibraryRow;

// ----- bounded concurrency helper -----
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;

  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) break;
        results[idx] = await worker(items[idx], idx);
      }
    });

  await Promise.all(workers);
  return results;
}

// ----- build a single row (same logic as original library.tsx) -----
async function buildRow(
  meta: IndexMeta,
  eagerThumb: boolean,
): Promise<Row | null> {
  const info: any = await FileSystem.getInfoAsync(meta.uri);
  if (!info?.exists) return null;

  const scoreBits = await readOutcomeFor(meta.uri);

  // Thumbnails:
  // - eager for first N newest rows
  // - otherwise use cached thumb if it exists
  let thumb: string | null = null;

  if (eagerThumb) {
    thumb = await getOrCreateThumb(meta.uri, meta.assetId);
  } else {
    const cached = thumbPathFor(meta.uri);
    try {
      const tInfo: any = await FileSystem.getInfoAsync(cached);
      if (tInfo?.exists) thumb = cached;
    } catch {
      // ignore
    }
  }

  return {
    uri: meta.uri,
    displayName: meta.displayName || (meta.uri.split('/').pop() || 'video'),
    athlete: (meta.athlete || 'Unassigned').trim() || 'Unassigned',
    sport: (meta.sport || 'unknown').trim() || 'unknown',
    assetId: meta.assetId,
    size: info?.size ?? null,
    mtime: info?.modificationTime
      ? Math.round((info.modificationTime as number) * 1000)
      : meta.createdAt ?? null,
    thumbUri: thumb,

    finalScore: scoreBits.finalScore,
    homeIsAthlete: scoreBits.homeIsAthlete,
    outcome: scoreBits.outcome ?? undefined,
    myScore: scoreBits.myScore,
    oppScore: scoreBits.oppScore,
    highlightGold: scoreBits.highlightGold,
    edgeColor: scoreBits.edgeColor,
  };
}

export async function buildLibraryRows(): Promise<{
  rows: Row[];
  athleteList: Athlete[];
  uploadedMap: Record<string, { key: string; url: string; at: number }>;
}> {
  // Debug: start
  console.log('[buildLibraryRows] start');

  // 1) index
  const list = await readIndex();
  console.log('[buildLibraryRows] index length:', list.length);

  const sorted = [...list].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  // 2) build rows (bounded concurrency, eager thumbs for first 12)
  const rowsBuilt = await mapLimit(sorted, 4, async (meta, i) => {
    return await buildRow(meta, i < 12);
  });

  const rows = rowsBuilt.filter(Boolean) as Row[];
  rows.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));

  // 3) athletes list
  let athleteList: Athlete[] = [];
  try {
    const raw = await AsyncStorage.getItem(ATHLETES_KEY);
    athleteList = raw ? (JSON.parse(raw) as Athlete[]) : [];
  } catch {
    athleteList = [];
  }

  // 4) uploaded map
  let uploadedMap: Record<string, { key: string; url: string; at: number }> =
    {};
  try {
    const rawUp = await AsyncStorage.getItem(UPLOADED_MAP_KEY);
    uploadedMap = rawUp ? JSON.parse(rawUp) : {};
  } catch {
    uploadedMap = {};
  }

  // 5) thumb sweep (quiet, non-fatal)
  try {
    await sweepOrphanThumbs(sorted.map((m) => m.uri));
  } catch {
    // ignore
  }

  console.log('[buildLibraryRows] done:', {
    rows: rows.length,
    athletes: athleteList.length,
    uploadedKeys: Object.keys(uploadedMap || {}).length,
  });

  return { rows, athleteList, uploadedMap };
}
