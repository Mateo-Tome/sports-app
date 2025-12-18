// app/screens/playback/hooks/usePlaybackPlayer.ts
import { useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';

type PlaybackSource =
  | { videoPath: string; shareId?: never }
  | { videoPath?: never; shareId: string }
  | { videoPath: string; shareId: string }; // allow both; videoPath wins

type GetPlaybackUrlsResponse = { videoUrl: string };

async function getPlaybackUrls(shareId: string): Promise<GetPlaybackUrlsResponse> {
  // ✅ IMPORTANT: replace with your real endpoint
  // If you already have a helper in your app, we’ll swap to it next.
  const base =
    process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    ''; // e.g. "https://us-central1-<project>.cloudfunctions.net"

  if (!base) throw new Error('Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL (or EXPO_PUBLIC_API_BASE_URL)');

  const res = await fetch(`${base}/getPlaybackUrls?shareId=${encodeURIComponent(shareId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`getPlaybackUrls failed (${res.status}): ${txt || res.statusText}`);
  }

  const json = (await res.json()) as any;
  const videoUrl = String(json?.videoUrl || '');
  if (!videoUrl) throw new Error('getPlaybackUrls returned no videoUrl');
  return { videoUrl };
}

export function usePlaybackPlayer(sourceOrVideoPath: PlaybackSource | string) {
  // Back-compat: allow old call usePlaybackPlayer(videoPath)
  const source: PlaybackSource =
    typeof sourceOrVideoPath === 'string'
      ? { videoPath: sourceOrVideoPath }
      : (sourceOrVideoPath as PlaybackSource);

  const player = useVideoPlayer('', p => {
    p.loop = false;
  });

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string>('');

  // Used to ignore late async results (race-safe)
  const loadTokenRef = useRef(0);

  // Load / replace source (local OR shareId->signed url)
  useEffect(() => {
    let cancelled = false;
    const token = ++loadTokenRef.current;

    (async () => {
      setSourceError('');
      setLoadingSource(false);

      // Prefer local file if present
      const videoPath = (source as any)?.videoPath ? String((source as any).videoPath) : '';
      const shareId = (source as any)?.shareId ? String((source as any).shareId) : '';

      if (!videoPath && !shareId) return;

      setLoadingSource(true);
      try {
        let uri = videoPath;

        if (!uri && shareId) {
          const { videoUrl } = await getPlaybackUrls(shareId);
          uri = videoUrl;
        }

        if (cancelled) return;
        if (loadTokenRef.current !== token) return;

        await (player as any).replaceAsync(uri);

        if (cancelled) return;
        if (loadTokenRef.current !== token) return;

        // Reset to start when switching sources
        try {
          (player as any).currentTime = 0;
        } catch {}
      } catch (e: any) {
        if (cancelled) return;
        if (loadTokenRef.current !== token) return;
        setSourceError(e?.message ? String(e.message) : 'Failed to load video');
      } finally {
        if (!cancelled && loadTokenRef.current === token) setLoadingSource(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player, (source as any)?.videoPath, (source as any)?.shareId]);

  // Poll player state
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const c = (player as any)?.currentTime ?? 0;
        const d = (player as any)?.duration ?? ((player as any)?.durationMs ?? 0) / 1000 ?? 0;
        const playing = (player as any)?.playing ?? (player as any)?.isPlaying ?? false;

        if (!isScrubbing) setNow(typeof c === 'number' ? c : 0);
        setDur(typeof d === 'number' ? d : 0);
        setIsPlaying(!!playing);
      } catch {}
    }, 240);

    return () => clearInterval(id);
  }, [player, isScrubbing]);

  const atVideoEnd = useMemo(() => {
    return !isPlaying && dur > 0 && Math.abs(now - dur) < 0.25;
  }, [isPlaying, dur, now]);

  const getLiveDuration = () => {
    const d = (player as any)?.duration;
    const dm = (player as any)?.durationMs;
    return typeof d === 'number' && d > 0 ? d : typeof dm === 'number' && dm > 0 ? dm / 1000 : dur || 0;
  };

  const onSeek = (sec: number) => {
    try {
      const D = getLiveDuration();
      if (!D) return;
      const clamped = Math.max(0, Math.min(D, sec));
      (player as any).currentTime = clamped;
      if (isScrubbing) setNow(clamped);
    } catch {}
  };

  const onPlayPause = () => {
    try {
      isPlaying ? (player as any)?.pause?.() : (player as any)?.play?.();
    } catch {}
  };

  const reload = () => {
    // Forces the effect to run again by changing token and re-setting same source.
    // We just bump the token; next render effect sees same deps, so to actually reload
    // we do a simple replaceAsync to current source by calling replaceAsync again:
    loadTokenRef.current++;
    const videoPath = (source as any)?.videoPath ? String((source as any).videoPath) : '';
    const shareId = (source as any)?.shareId ? String((source as any).shareId) : '';
    (async () => {
      setSourceError('');
      setLoadingSource(true);
      try {
        let uri = videoPath;
        if (!uri && shareId) {
          const { videoUrl } = await getPlaybackUrls(shareId);
          uri = videoUrl;
        }
        await (player as any).replaceAsync(uri);
        try {
          (player as any).currentTime = 0;
        } catch {}
      } catch (e: any) {
        setSourceError(e?.message ? String(e.message) : 'Failed to load video');
      } finally {
        setLoadingSource(false);
      }
    })();
  };

  return {
    player,
    now,
    dur,
    isPlaying,
    atVideoEnd,
    isScrubbing,
    setIsScrubbing,
    onSeek,
    onPlayPause,
    getLiveDuration,

    // ✅ NEW
    loadingSource,
    sourceError,
    reload,
  };
}
