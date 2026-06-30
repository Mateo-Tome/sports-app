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

import './sportLibraryBitsInit';
import { buildSportLibraryBits } from './sportLibraryStyleRegistry';

import { auth, authReady } from '../firebase';

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

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getInfoWithRetry(uri: string) {
  try {
    let info: any = await FileSystem.getInfoAsync(uri);

    if (!info?.exists) {
      await sleep(250);
      info = await FileSystem.getInfoAsync(uri);
    }

    return info;
  } catch (e) {
    console.log('[buildLibraryRows] getInfo failed:', uri, e);
    return null;
  }
}

async function safeReadOutcome(uri: string) {
  try {
    return await readOutcomeFor(uri);
  } catch (e) {
    console.log('[buildLibraryRows] readOutcome failed:', uri, e);
    return {
      finalScore: null,
      homeIsAthlete: null,
      outcome: undefined,
      myScore: null,
      oppScore: null,
      highlightGold: false,
      edgeColor: null,
    };
  }
}

async function safeReadSidecar(uri: string) {
  try {
    return await readSidecarForUpload(uri);
  } catch (e) {
    console.log('[buildLibraryRows] sidecar failed:', uri, e);
    return null;
  }
}

async function safeGetCachedThumb(uri: string) {
  try {
    const cached = thumbPathFor(uri);
    const tInfo: any = await FileSystem.getInfoAsync(cached);
    return tInfo?.exists ? cached : null;
  } catch {
    return null;
  }
}

async function safeGetOrCreateThumb(uri: string, assetId?: string | null) {
  try {
    return await getOrCreateThumb(uri, assetId);
  } catch (e) {
    console.log('[buildLibraryRows] thumbnail failed:', uri, e);
    return null;
  }
}

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

        try {
          results[idx] = await worker(items[idx], idx);
        } catch (e) {
          console.log('[buildLibraryRows] worker failed:', e);
          results[idx] = null as R;
        }
      }
    });

  await Promise.all(workers);
  return results;
}

async function buildRow(
  meta: IndexMeta,
  eagerThumb: boolean,
  athleteNameById: Map<string, string>,
): Promise<Row | null> {
  const uri = String(meta?.uri ?? '').trim();

  if (!uri) {
    console.log('[buildLibraryRows] skipped row with missing uri', meta);
    return null;
  }

  const info: any = await getInfoWithRetry(uri);

  if (!info?.exists) {
    console.log('[buildLibraryRows] skipped missing video after retry:', {
      uri,
      displayName: meta?.displayName,
    });
    return null;
  }

  const scoreBits = await safeReadOutcome(uri);
  const sidecar = await safeReadSidecar(uri);

  let effectiveSport = meta.sport || '';

  try {
    if (sidecar) {
      effectiveSport = getSportKeyFromSidecar(sidecar);
    }
  } catch (e) {
    console.log('[buildLibraryRows] getSportKey failed:', uri, e);
    effectiveSport = meta.sport || '';
  }

  let sportBits: any = {};

  try {
    sportBits = buildSportLibraryBits(effectiveSport || '', sidecar);
  } catch (e) {
    console.log('[buildLibraryRows] sportBits failed:', uri, e);
    sportBits = {};
  }

  let thumb: string | null = null;

  if (eagerThumb) {
    thumb = await safeGetOrCreateThumb(uri, meta.assetId);
  } else {
    thumb = await safeGetCachedThumb(uri);
  }

  const finalEdgeColor =
    (sportBits.edgeColor ?? null) ?? (scoreBits.edgeColor ?? null);

  const finalHighlightGold =
    typeof sportBits.highlightGold === 'boolean'
      ? sportBits.highlightGold
      : scoreBits.highlightGold;

  const sportLower = String(effectiveSport || '').toLowerCase();
  const isWrestling = sportLower.startsWith('wrestling');

  const clipAthleteId = String(
    (sidecar as any)?.athleteId ??
      (meta as any)?.athleteId ??
      '',
  ).trim();

  const savedAthleteName =
    String(
      (sidecar as any)?.athleteName ??
        (sidecar as any)?.athlete ??
        (meta as any)?.athleteName ??
        meta.athlete ??
        'Unassigned',
    ).trim() || 'Unassigned';

  const displayAthlete =
    (clipAthleteId && athleteNameById.get(clipAthleteId)) ||
    savedAthleteName;

  const displayName = String(
    meta.displayName || uri.split('/').pop() || 'video',
  ).replace(savedAthleteName, displayAthlete);

  return {
    uri,
    displayName,

    athlete: displayAthlete,
    athleteId: clipAthleteId || null,

    gameId:
      String((sidecar as any)?.gameId ?? (meta as any)?.gameId ?? '').trim() || null,

    gameTitle:
      String((sidecar as any)?.gameTitle ?? (meta as any)?.gameTitle ?? '').trim() || null,

    sport: (effectiveSport || 'unknown').trim() || 'unknown',

    assetId: meta.assetId,
    size: info?.size ?? null,

    mtime: info?.modificationTime
      ? Math.round((info.modificationTime as number) * 1000)
      : meta.createdAt ?? null,

    thumbUri: thumb,

    finalScore: isWrestling ? scoreBits.finalScore : null,
    homeIsAthlete: isWrestling ? scoreBits.homeIsAthlete : null,
    outcome: isWrestling ? (scoreBits.outcome ?? undefined) : undefined,
    myScore: isWrestling ? scoreBits.myScore : null,
    oppScore: isWrestling ? scoreBits.oppScore : null,

    highlightGold: finalHighlightGold,
    edgeColor: finalEdgeColor,

    libraryStyle: {
      edgeColor: finalEdgeColor,
      badgeText: sportBits.badgeText ?? null,
      badgeColor:
        sportBits.badgeColor ??
        sportBits.edgeColor ??
        finalEdgeColor ??
        null,
    },

    hittingLabel: sportBits.hittingLabel ?? null,
    pitchingLabel: sportBits.pitchingLabel ?? null,
  } as Row;
}

export async function buildLibraryRows(): Promise<{
  rows: Row[];
  athleteList: Athlete[];
  uploadedMap: Record<string, { key: string; url: string; at: number }>;
}> {
  console.log('[buildLibraryRows] start');

  const list = await readIndex();

  console.log('[buildLibraryRows] index length:', list.length);

  const sorted = [...list].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  let athleteList: Athlete[] = [];

  try {
    const u = auth.currentUser ?? (await authReady());

    if (!u || u.isAnonymous) {
      athleteList = [];
    } else {
      const raw = await AsyncStorage.getItem(athletesKey(u.uid));
      athleteList = raw ? (JSON.parse(raw) as Athlete[]) : [];
    }
  } catch (e) {
    console.log('[buildLibraryRows] athlete list failed:', e);
    athleteList = [];
  }

  const athleteNameById = new Map<string, string>();

  for (const a of athleteList) {
    const id = String(a?.id ?? '').trim();
    const name = String(a?.name ?? '').trim();

    if (id && name) {
      athleteNameById.set(id, name);
    }
  }

  const rowsBuilt = await mapLimit(sorted, 2, async (meta, i) => {
    try {
      return await buildRow(meta, i < 8, athleteNameById);
    } catch (e) {
      console.log('[buildLibraryRows] skipped bad row:', {
        uri: meta?.uri,
        displayName: meta?.displayName,
        e,
      });
      return null;
    }
  });

  const rows = rowsBuilt.filter(Boolean) as Row[];

  rows.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));

  let uploadedMap: Record<string, { key: string; url: string; at: number }> = {};

  try {
    const rawUp = await AsyncStorage.getItem(UPLOADED_MAP_KEY);
    uploadedMap = rawUp ? JSON.parse(rawUp) : {};
  } catch (e) {
    console.log('[buildLibraryRows] uploaded map failed:', e);
    uploadedMap = {};
  }

  try {
    await sweepOrphanThumbs(sorted.map((m) => m.uri));
  } catch (e) {
    console.log('[buildLibraryRows] thumb sweep failed:', e);
  }

  console.log('[buildLibraryRows] done:', {
    index: list.length,
    rows: rows.length,
    dropped: list.length - rows.length,
    athletes: athleteList.length,
    uploadedKeys: Object.keys(uploadedMap || {}).length,
  });

  return {
    rows,
    athleteList,
    uploadedMap,
  };
}