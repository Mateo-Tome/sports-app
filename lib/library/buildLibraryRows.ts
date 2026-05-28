import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import type { LibraryRow } from '../../components/library/LibraryVideoRow';
import { readIndex, type IndexMeta } from './indexStore';
import {
  getSportKeyFromSidecar,
  readOutcomeFor,
  readSidecarForUpload,
} from './sidecars';
import {
  getOrCreateThumb,
  sweepOrphanThumbs,
  thumbPathFor,
} from './thumbs';

// ✅ modular, sport-specific library styling (edgeColor/labels)
import './sportLibraryBitsInit';
import { buildSportLibraryBits } from './sportLibraryStyleRegistry';

// ✅ IMPORTANT: use the same UID-scoped athlete list as Athletes tab
import { ensureAnonymous } from '../firebase';

const UPLOADED_MAP_KEY = 'uploaded:map';

function athletesKey(uid: string) {
  return `athletes:list:${uid}`;
}

type Athlete = {
  id: string;
  name: string;
  photoUri?: string | null;
  photoLocalUri?: string | null;
  photoUrl?: string | null;
  photoKey?: string | null;
  photoUpdatedAt?: number | null;
};

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

// ----- build a single row -----
async function buildRow(
  meta: IndexMeta,
  eagerThumb: boolean,
  athleteNameById: Map<string, string>,
): Promise<Row | null> {
  const info: any = await FileSystem.getInfoAsync(meta.uri);
  if (!info?.exists) return null;

  const scoreBits = await readOutcomeFor(meta.uri);

  const sidecar = await readSidecarForUpload(meta.uri);

  const effectiveSport =
    sidecar ? getSportKeyFromSidecar(sidecar) : (meta.sport || '');

  const sportBits = buildSportLibraryBits(effectiveSport || '', sidecar);

  let thumb: string | null = null;

  if (eagerThumb) {
    thumb = await getOrCreateThumb(meta.uri, meta.assetId);
  } else {
    const cached = thumbPathFor(meta.uri);

    try {
      const tInfo: any = await FileSystem.getInfoAsync(cached);
      if (tInfo?.exists) thumb = cached;
    } catch {}
  }

  const finalEdgeColor =
    (sportBits.edgeColor ?? null) ?? (scoreBits.edgeColor ?? null);

  const finalHighlightGold =
    typeof sportBits.highlightGold === 'boolean'
      ? sportBits.highlightGold
      : scoreBits.highlightGold;

  const sportLower = String(effectiveSport || '').toLowerCase();
  const isWrestling = sportLower.startsWith('wrestling');

  // ✅ NEW: stable athlete identity
  const clipAthleteId = String(
    (sidecar as any)?.athleteId ??
      (meta as any)?.athleteId ??
      '',
  ).trim();

  // ✅ old saved display name
  const savedAthleteName =
    String(
      (sidecar as any)?.athleteName ??
        (sidecar as any)?.athlete ??
        (meta as any)?.athleteName ??
        meta.athlete ??
        'Unassigned',
    ).trim() || 'Unassigned';

  // ✅ ALWAYS prefer latest athlete name from athleteId
  const displayAthlete =
    (clipAthleteId && athleteNameById.get(clipAthleteId)) ||
    savedAthleteName;

  return {
    uri: meta.uri,

    displayName:
  (meta.displayName || meta.uri.split('/').pop() || 'video')
    .replace(savedAthleteName, displayAthlete),

    // ✅ FIXED
    athlete: displayAthlete,
    athleteId: clipAthleteId || null,

    sport:
      (effectiveSport || 'unknown').trim() ||
      'unknown',

    assetId: meta.assetId,

    size: info?.size ?? null,

    mtime: info?.modificationTime
      ? Math.round(
          (info.modificationTime as number) * 1000,
        )
      : meta.createdAt ?? null,

    thumbUri: thumb,

    finalScore: isWrestling
      ? scoreBits.finalScore
      : null,

    homeIsAthlete: isWrestling
      ? scoreBits.homeIsAthlete
      : null,

    outcome: isWrestling
      ? (scoreBits.outcome ?? undefined)
      : undefined,

    myScore: isWrestling
      ? scoreBits.myScore
      : null,

    oppScore: isWrestling
      ? scoreBits.oppScore
      : null,

    highlightGold: finalHighlightGold,
    edgeColor: finalEdgeColor,

    libraryStyle: {
      edgeColor: finalEdgeColor,

      badgeText:
        sportBits.badgeText ?? null,

      badgeColor:
        sportBits.badgeColor ??
        sportBits.edgeColor ??
        finalEdgeColor ??
        null,
    },

    hittingLabel:
      sportBits.hittingLabel ?? null,

    pitchingLabel:
      sportBits.pitchingLabel ?? null,
  } as Row;
}

export async function buildLibraryRows(): Promise<{
  rows: Row[];
  athleteList: Athlete[];
  uploadedMap: Record<
    string,
    { key: string; url: string; at: number }
  >;
}> {
  console.log('[buildLibraryRows] start');

  // 1) index
  const list = await readIndex();

  console.log(
    '[buildLibraryRows] index length:',
    list.length,
  );

  const sorted = [...list].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  // ✅ LOAD ATHLETES FIRST
  let athleteList: Athlete[] = [];

  try {
    const u = await ensureAnonymous();

    const raw = await AsyncStorage.getItem(
      athletesKey(u.uid),
    );

    athleteList = raw
      ? (JSON.parse(raw) as Athlete[])
      : [];
  } catch {
    athleteList = [];
  }

  // ✅ athleteId -> latest name
  const athleteNameById = new Map<string, string>();

  for (const a of athleteList) {
    const id = String(a?.id ?? '').trim();
    const name = String(a?.name ?? '').trim();

    if (id && name) {
      athleteNameById.set(id, name);
    }
  }

  // 2) build rows
  const rowsBuilt = await mapLimit(
    sorted,
    4,
    async (meta, i) => {
      return await buildRow(
        meta,
        i < 12,
        athleteNameById,
      );
    },
  );

  const rows = rowsBuilt.filter(Boolean) as Row[];

  rows.sort(
    (a, b) => (b.mtime ?? 0) - (a.mtime ?? 0),
  );

  // 3) uploaded map
  let uploadedMap: Record<
    string,
    { key: string; url: string; at: number }
  > = {};

  try {
    const rawUp = await AsyncStorage.getItem(
      UPLOADED_MAP_KEY,
    );

    uploadedMap = rawUp
      ? JSON.parse(rawUp)
      : {};
  } catch {
    uploadedMap = {};
  }

  // 4) thumb sweep
  try {
    await sweepOrphanThumbs(
      sorted.map((m) => m.uri),
    );
  } catch {}

  console.log('[buildLibraryRows] done:', {
    rows: rows.length,
    athletes: athleteList.length,
    uploadedKeys: Object.keys(uploadedMap || {})
      .length,
  });

  return {
    rows,
    athleteList,
    uploadedMap,
  };
}