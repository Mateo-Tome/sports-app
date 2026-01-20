// src/hooks/library/useLibraryDataSource.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchMyVideos, type VideoRow } from '../../../lib/videos';

export type LibraryStyle = {
  edgeColor?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  highlight?: boolean | null;
};

export type LibraryRowLike = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  mtime: number | null;
  assetId?: string | null;
  size?: number | null;
  thumbUri?: string | null;

  finalScore?: any;
  homeIsAthlete?: boolean;
  outcome?: any;
  myScore?: number | null;
  oppScore?: number | null;

  highlightGold?: boolean;
  edgeColor?: string;

  // ✅ NEW: sport-agnostic style
  libraryStyle?: LibraryStyle | null;
};

const DS_KEY = 'library:dataSource';

function safeStr(v: any, fallback = '') {
  const s = (v ?? '').toString().trim();
  return s || fallback;
}

function parseCreatedAt(v: any): number {
  if (typeof v === 'number') return v;
  if (v?.toMillis) return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  return Date.now();
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatWhen(ms: number) {
  const d = new Date(ms);
  const month = d.toLocaleString(undefined, { month: 'short' });
  const day = d.getDate();
  const hh = d.getHours();
  const mm = pad2(d.getMinutes());
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hh12 = ((hh + 11) % 12) + 1;
  return `${month} ${day} at ${hh12}:${mm} ${ampm}`;
}

function computeOutcomeLabel(outcome: any): 'W' | 'L' | '' {
  const s = safeStr(outcome).toUpperCase();
  if (s.startsWith('W')) return 'W';
  if (s.startsWith('L')) return 'L';
  return '';
}

function computeEdgeColorFromWL(o: 'W' | 'L' | '') {
  if (o === 'W') return '#22c55e';
  if (o === 'L') return '#ef4444';
  return 'rgba(255,255,255,0.18)';
}

/**
 * Map Firestore VideoRow -> LibraryRow-like
 * IMPORTANT: Cloud needs style stored in Firestore (libraryStyle / edgeColor),
 * otherwise baseball will fall back to gray (because W/L doesn't apply).
 */
function toCloudLibraryRow(v: VideoRow): LibraryRowLike | null {
  const shareId = safeStr((v as any).shareId, safeStr((v as any).id, ''));
  if (!shareId) return null;

  const athleteName =
    safeStr((v as any).athleteName, '') ||
    safeStr((v as any).athlete, 'Unassigned') ||
    'Unassigned';

  const sportStyle =
    safeStr((v as any).sportStyle, '') ||
    safeStr((v as any).sport, 'unknown') ||
    'unknown';

  const createdAt = parseCreatedAt((v as any).createdAt);
  const when = createdAt ? formatWhen(createdAt) : '';

  const myScore =
    typeof (v as any).myScore === 'number'
      ? (v as any).myScore
      : typeof (v as any).scoreFor === 'number'
      ? (v as any).scoreFor
      : null;

  const oppScore =
    typeof (v as any).oppScore === 'number'
      ? (v as any).oppScore
      : typeof (v as any).scoreAgainst === 'number'
      ? (v as any).scoreAgainst
      : null;

  const outcomeWL = computeOutcomeLabel((v as any).outcome ?? (v as any).result);

  const finalScoreText =
    safeStr((v as any).finalScore, '') ||
    safeStr((v as any).scoreText, '') ||
    (myScore != null && oppScore != null && outcomeWL ? `${outcomeWL} ${myScore}\u2013${oppScore}` : '');

  // Title: "Anakin • baseball-hitting • Jan 11 at 5:53 PM"
  const titleParts = [athleteName, sportStyle];
  if (when) titleParts.push(when);

  const libStyle = ((v as any).libraryStyle ?? null) as LibraryStyle | null;

  // ✅ Border color priority:
  // 1) libraryStyle.edgeColor (sport-agnostic, best)
  // 2) legacy doc edgeColor
  // 3) W/L fallback (only helps wrestling/etc)
  const edgeColor =
    (safeStr(libStyle?.edgeColor, '') || null) ??
    (safeStr((v as any).edgeColor, '') || null) ??
    computeEdgeColorFromWL(outcomeWL);

  return {
    uri: `cloud:${shareId}`,
    displayName: titleParts.join(' • '),

    athlete: athleteName,
    sport: sportStyle,
    mtime: createdAt,

    assetId: null,
    size: (v as any).bytes ?? null,
    thumbUri: null,

    outcome: outcomeWL || undefined,
    myScore,
    oppScore,

    finalScore: finalScoreText || null,

    homeIsAthlete:
      typeof (v as any).homeIsAthlete === 'boolean' ? (v as any).homeIsAthlete : undefined,

    highlightGold: !!(v as any).highlightGold,

    edgeColor,
    libraryStyle: libStyle,
  };
}

export function useLibraryDataSource(router: any, localRows: any[]) {
  const [dataSource, setDataSourceState] = useState<'local' | 'cloud'>('local');
  const [cloudRows, setCloudRows] = useState<LibraryRowLike[]>([]);
  const [cloudCount, setCloudCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(DS_KEY);
        if (v === 'cloud' || v === 'local') setDataSourceState(v);
      } catch {}
    })();
  }, []);

  const setDataSource = useCallback(async (v: 'local' | 'cloud') => {
    setDataSourceState(v);
    try {
      await AsyncStorage.setItem(DS_KEY, v);
    } catch {}
  }, []);

  useEffect(() => {
    if (dataSource !== 'cloud') return;

    let cancelled = false;

    (async () => {
      try {
        const vids = await fetchMyVideos();
        const mapped = vids.map(toCloudLibraryRow).filter(Boolean) as LibraryRowLike[];
        mapped.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));

        if (cancelled) return;
        setCloudRows(mapped);
        setCloudCount(mapped.length);
      } catch (e) {
        if (cancelled) return;
        setCloudRows([]);
        setCloudCount(0);
        console.log('[useLibraryDataSource] fetchMyVideos failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  const sourceRows = useMemo(() => {
    return dataSource === 'cloud' ? cloudRows : (localRows as any);
  }, [dataSource, cloudRows, localRows]);

  const routerPushPlayback = useCallback(
    async (row: any) => {
      const isCloud = String(row?.uri ?? '').startsWith('cloud:');

      if (!isCloud) {
        router.push({
          pathname: '/screens/PlaybackScreen',
          params: {
            videoPath: row.uri,
            athlete: row?.athlete ?? '',
            sport: row?.sport ?? '',
            displayName: row?.displayName ?? '',
          },
        });
        return;
      }

      const shareId = String(row.uri).replace(/^cloud:/, '').trim();
      if (!shareId) return;

      router.push({
        pathname: '/screens/PlaybackScreen',
        params: {
          shareId,
          athlete: row?.athlete ?? '',
          sport: row?.sport ?? '',
          displayName: row?.displayName ?? '',
        },
      });
    },
    [router],
  );

  return {
    dataSource,
    setDataSource,
    sourceRows,
    cloudCount,
    routerPushPlayback,
  };
}
