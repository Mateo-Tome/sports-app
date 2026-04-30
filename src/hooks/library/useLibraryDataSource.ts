import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';

import { getThumbnailViewUrl } from '../../../lib/backend';
import {
  fetchMyVideosPage,
  type VideoPageCursor,
  type VideoRow,
} from '../../../lib/videos';

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

  libraryStyle?: LibraryStyle | null;

  videoId?: string;
  shareId?: string | null;
  b2VideoKey?: string | null;
  b2SidecarKey?: string | null;
  b2ThumbnailKey?: string | null;
  thumbnailUrl?: string | null;
};

const DS_KEY = 'library:dataSource';

// Test with 7. Production: 20.
const CLOUD_PAGE_SIZE = 20;

const THUMB_CACHE_MS = 45 * 60 * 1000;

type ThumbCacheEntry = {
  url: string;
  expiresAt: number;
};

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

function toCloudLibraryRow(v: VideoRow): LibraryRowLike | null {
  const videoId = safeStr((v as any).id, '');
  const shareId = safeStr((v as any).shareId, videoId);
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
    (myScore != null && oppScore != null && outcomeWL
      ? `${outcomeWL} ${myScore}\u2013${oppScore}`
      : '');

  const titleParts = [athleteName, sportStyle];
  if (when) titleParts.push(when);

  const libStyle = ((v as any).libraryStyle ?? null) as LibraryStyle | null;

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
      typeof (v as any).homeIsAthlete === 'boolean'
        ? (v as any).homeIsAthlete
        : undefined,

    highlightGold: !!(v as any).highlightGold,
    edgeColor,
    libraryStyle: libStyle,

    videoId: videoId || undefined,
    shareId: shareId || null,
    b2VideoKey: (v as any).b2VideoKey ?? null,
    b2SidecarKey: (v as any).b2SidecarKey ?? null,
    b2ThumbnailKey: (v as any).b2ThumbnailKey ?? null,
    thumbnailUrl: null,
  };
}

async function attachSignedThumbnails(
  rows: LibraryRowLike[],
  cacheRef: MutableRefObject<Map<string, ThumbCacheEntry>>,
) {
  return Promise.all(
    rows.map(async (row) => {
      const key = safeStr(row.b2ThumbnailKey, '');
      if (!key) return row;

      const now = Date.now();
      const cached = cacheRef.current.get(key);

      if (cached && cached.expiresAt > now) {
        return {
          ...row,
          thumbUri: cached.url,
          thumbnailUrl: cached.url,
        };
      }

      try {
        const signed = await getThumbnailViewUrl(key);

        cacheRef.current.set(key, {
          url: signed.thumbnailUrl,
          expiresAt: Date.now() + THUMB_CACHE_MS,
        });

        return {
          ...row,
          thumbUri: signed.thumbnailUrl,
          thumbnailUrl: signed.thumbnailUrl,
        };
      } catch (e) {
        console.log('[useLibraryDataSource] thumbnail signed URL failed:', e);
        return row;
      }
    }),
  );
}

export function useLibraryDataSource(router: any, localRows: any[]) {
  const [dataSource, setDataSourceState] = useState<'local' | 'cloud'>('local');
  const [cloudRows, setCloudRows] = useState<LibraryRowLike[]>([]);
  const [cloudCount, setCloudCount] = useState<number>(0);
  const [cloudRefreshNonce, setCloudRefreshNonce] = useState(0);
  const [loadingMoreCloudRows, setLoadingMoreCloudRows] = useState(false);
  const [hasMoreCloudRows, setHasMoreCloudRows] = useState(false);

  const thumbCacheRef = useRef<Map<string, ThumbCacheEntry>>(new Map());
  const loadingMoreRef = useRef(false);
  const cursorRef = useRef<VideoPageCursor>(null);

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

  const refreshCloudRows = useCallback(async () => {
    cursorRef.current = null;
    setCloudRows([]);
    setCloudCount(0);
    setHasMoreCloudRows(false);
    setCloudRefreshNonce((n) => n + 1);
  }, []);

  const loadInitialCloudRows = useCallback(async () => {
    const page = await fetchMyVideosPage({
      pageSize: CLOUD_PAGE_SIZE,
      cursor: null,
    });

    const mappedBase = page.rows
      .map(toCloudLibraryRow)
      .filter(Boolean) as LibraryRowLike[];

    const mappedWithThumbs = await attachSignedThumbnails(
      mappedBase,
      thumbCacheRef,
    );

    cursorRef.current = page.cursor;

    setCloudRows(mappedWithThumbs);
    setCloudCount(mappedWithThumbs.length);
    setHasMoreCloudRows(page.hasMore);

    console.log(
      `[useLibraryDataSource] initial cloud page loaded rows=${mappedWithThumbs.length}, hasMore=${page.hasMore}`,
    );
  }, []);

  useEffect(() => {
    if (dataSource !== 'cloud') return;

    let cancelled = false;

    (async () => {
      try {
        cursorRef.current = null;
        setCloudRows([]);
        setCloudCount(0);
        setHasMoreCloudRows(false);

        const page = await fetchMyVideosPage({
          pageSize: CLOUD_PAGE_SIZE,
          cursor: null,
        });

        const mappedBase = page.rows
          .map(toCloudLibraryRow)
          .filter(Boolean) as LibraryRowLike[];

        const mappedWithThumbs = await attachSignedThumbnails(
          mappedBase,
          thumbCacheRef,
        );

        if (cancelled) return;

        cursorRef.current = page.cursor;

        setCloudRows(mappedWithThumbs);
        setCloudCount(mappedWithThumbs.length);
        setHasMoreCloudRows(page.hasMore);

        console.log(
          `[useLibraryDataSource] cloud loaded page rows=${mappedWithThumbs.length}, hasMore=${page.hasMore}`,
        );
      } catch (e) {
        if (cancelled) return;
        cursorRef.current = null;
        setCloudRows([]);
        setCloudCount(0);
        setHasMoreCloudRows(false);
        console.log('[useLibraryDataSource] fetchMyVideosPage failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataSource, cloudRefreshNonce]);

  const loadMoreCloudRows = useCallback(async () => {
    if (dataSource !== 'cloud') return;
    if (loadingMoreRef.current) return;
    if (!hasMoreCloudRows) return;

    loadingMoreRef.current = true;
    setLoadingMoreCloudRows(true);

    try {
      const page = await fetchMyVideosPage({
        pageSize: CLOUD_PAGE_SIZE,
        cursor: cursorRef.current,
      });

      const mappedBase = page.rows
        .map(toCloudLibraryRow)
        .filter(Boolean) as LibraryRowLike[];

      const mappedWithThumbs = await attachSignedThumbnails(
        mappedBase,
        thumbCacheRef,
      );

      cursorRef.current = page.cursor;

      setCloudRows((prev) => [...prev, ...mappedWithThumbs]);
      setCloudCount((prev) => prev + mappedWithThumbs.length);
      setHasMoreCloudRows(page.hasMore);

      console.log(
        `[useLibraryDataSource] loaded more cloud rows add=${mappedWithThumbs.length}, hasMore=${page.hasMore}`,
      );
    } catch (e) {
      console.log('[useLibraryDataSource] loadMoreCloudRows failed:', e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMoreCloudRows(false);
    }
  }, [dataSource, hasMoreCloudRows]);

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
    refreshCloudRows,
    loadMoreCloudRows,
    loadingMoreCloudRows,
    hasMoreCloudRows,
  };
}