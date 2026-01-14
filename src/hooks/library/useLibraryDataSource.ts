// src/hooks/library/useLibraryDataSource.ts
import type { Router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import type { LibraryRow } from '../../../components/library/LibraryVideoRow';
import { fetchMyVideos, type VideoRow } from '../../../lib/videos';
import { pushPlayback } from '../../hooks/navigation/pushPlayback';

function createdAtToMs(createdAt: VideoRow['createdAt']): number | null {
  try {
    if (!createdAt) return null;

    // Firestore Timestamp-like { seconds }
    if (typeof createdAt === 'object' && createdAt && 'seconds' in (createdAt as any)) {
      return Number((createdAt as any).seconds) * 1000;
    }

    if (typeof createdAt === 'number') return createdAt;

    // string / Date-ish
    const d = new Date(String(createdAt));
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch {
    return null;
  }
}

function looksLikeFilenameTitle(t: string) {
  const s = t.trim().toLowerCase();
  return s.startsWith('match_') || s.endsWith('.mp4') || s.endsWith('.mov') || s.endsWith('.m4v');
}

function scoreChipFromDoc(v: VideoRow): { outcome?: 'W' | 'L' | 'T'; myScore?: number | null; oppScore?: number | null } {
  const st = (v.scoreText ?? '').trim(); // e.g. "W 5–4"
  if (st) {
    const outcome = st.toUpperCase().startsWith('W')
      ? 'W'
      : st.toUpperCase().startsWith('L')
      ? 'L'
      : st.toUpperCase().startsWith('T')
      ? 'T'
      : undefined;

    const m = st.match(/([0-9]+)\s*[–-]\s*([0-9]+)/);
    const myScore = m ? Number(m[1]) : null;
    const oppScore = m ? Number(m[2]) : null;

    return { outcome, myScore, oppScore };
  }

  const r = (v.result ?? '').toString().trim().toUpperCase();
  if (r && v.scoreFor != null && v.scoreAgainst != null) {
    const outcome = r === 'W' ? 'W' : r === 'L' ? 'L' : r === 'T' ? 'T' : undefined;
    return { outcome, myScore: v.scoreFor, oppScore: v.scoreAgainst };
  }

  return { outcome: undefined, myScore: null, oppScore: null };
}

function outcomeColor(o?: 'W' | 'L' | 'T') {
  return o === 'W' ? '#16a34a' : o === 'L' ? '#dc2626' : o === 'T' ? '#eab308' : null;
}

function prettyTitleFromDoc(v: VideoRow) {
  const athlete = (v.athleteName ?? v.athlete ?? 'Unassigned').toString().trim() || 'Unassigned';
  const sport = (v.sportStyle ?? v.sport ?? 'unknown').toString().trim() || 'unknown';

  const ms = createdAtToMs(v.createdAt);
  if (!ms) return `${athlete} • ${sport} • ${v.shareId || v.id}`;

  const d = new Date(ms);
  const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return `${athlete} • ${sport} • ${datePart} at ${timePart}`;
}

export function useLibraryDataSource(router: Router, localRows: LibraryRow[]) {
  // Default: web => cloud, native => local
  const [dataSource, setDataSource] = useState<'local' | 'cloud'>(
    Platform.OS === 'web' ? 'cloud' : 'local'
  );

  const [cloudVideos, setCloudVideos] = useState<VideoRow[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setCloudLoading(true);
      try {
        const vids = await fetchMyVideos();
        if (!alive) return;
        console.log('🔥 fetchMyVideos ->', vids);
        setCloudVideos(vids);
      } catch (e) {
        console.log('fetchMyVideos error', e);
        if (!alive) return;
        setCloudVideos([]);
      } finally {
        if (alive) setCloudLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const cloudRows: LibraryRow[] = useMemo(() => {
    return cloudVideos
      .slice()
      .sort((a, b) => (createdAtToMs(b.createdAt) ?? 0) - (createdAtToMs(a.createdAt) ?? 0))
      .map((v) => {
        const athlete = (v.athleteName ?? v.athlete ?? 'Unassigned').toString().trim() || 'Unassigned';
        const sport = (v.sportStyle ?? v.sport ?? 'unknown').toString().trim() || 'unknown';

        const titleRaw = (v.title ?? '').toString().trim();
        const displayName =
          titleRaw && !looksLikeFilenameTitle(titleRaw) ? titleRaw : prettyTitleFromDoc(v);

        const mtime = createdAtToMs(v.createdAt);
        const { outcome, myScore, oppScore } = scoreChipFromDoc(v);

        return {
          // Special uri scheme so it can’t collide with file://
          uri: `cloud:${v.shareId ?? v.id}`,
          displayName,
          athlete,
          sport,

          assetId: undefined,
          size: v.bytes ?? null,
          mtime: mtime ?? null,
          thumbUri: null,

          // outcome fields (so LibraryVideoRow can show chip + border)
          finalScore: null,
          homeIsAthlete: true,
          outcome: outcome ?? undefined,
          myScore: myScore ?? null,
          oppScore: oppScore ?? null,
          highlightGold: false,
          edgeColor: outcomeColor(outcome ?? undefined),
        } as any;
      });
  }, [cloudVideos]);

  const sourceRows = dataSource === 'cloud' ? cloudRows : localRows;

  const routerPushPlayback = useCallback(
    (row: LibraryRow) => {
      if (dataSource === 'cloud') {
        const shareId = String(row.uri).replace('cloud:', '');
        router.push({
          pathname: '/cloud-playback',
          params: { shareId },
        } as any);
        return;
      }

      pushPlayback(router, {
        kind: 'local',
        videoPath: row.uri,
        athlete: row.athlete,
        sport: row.sport,
        displayName: row.displayName,
      });
    },
    [router, dataSource]
  );

  return {
    dataSource,
    setDataSource,
    sourceRows,
    cloudLoading,
    cloudCount: cloudVideos.length,
    routerPushPlayback,
  };
}
