// src/hooks/usePlaybackPlayer.ts
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getPlaybackUrls } from './api/getPlaybackUrls';

type Source = { videoPath?: string; shareId?: string };

const isWeb = Platform.OS === 'web';

function errToString(e: any) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e?.message) return String(e.message);
  return String(e);
}

export function usePlaybackPlayer(source: Source) {
  const player = useVideoPlayer('', (p) => {
    p.loop = false;
  
    try {
      (p as any).seekTolerance = {
        before: 0,
        after: 0,
      };
    } catch {}
  });

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [sidecarUrl, setSidecarUrl] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  const loadedSrcRef = useRef<string>('');
  const [loadedSrc, setLoadedSrc] = useState<string>('');

  const [reloadNonce, setReloadNonce] = useState(0);
  const lastLoadedKeyRef = useRef<string>('');

  const lastCTRef = useRef<number>(0);
  const lastCTTickRef = useRef<number>(Date.now());
  const wantsPlayRef = useRef<boolean>(false);

  const refreshSignedUrl = useCallback(() => {
    lastLoadedKeyRef.current = '';
    loadedSrcRef.current = '';
    setLoadedSrc('');
    setReloadNonce((n) => n + 1);
  }, []);

  const getLiveDuration = useCallback(() => {
    const d = (player as any)?.duration;
    const dm = (player as any)?.durationMs;
    if (typeof d === 'number' && d > 0) return d;
    if (typeof dm === 'number' && dm > 0) return dm / 1000;
    return dur || 0;
  }, [player, dur]);

  useEffect(() => {
    const videoPath = source?.videoPath ? String(source.videoPath) : '';
    const shareId = source?.shareId ? String(source.shareId) : '';

    const loadKey = videoPath
      ? `local:${videoPath}`
      : shareId
        ? `share:${shareId}:${reloadNonce}`
        : '';

    if (!loadKey) return;
    if (lastLoadedKeyRef.current === loadKey) return;
    lastLoadedKeyRef.current = loadKey;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setErrorMsg('');
      setLoading(true);
      setSidecarUrl(undefined);
      setIsReady(false);

      wantsPlayRef.current = false;
      lastCTRef.current = 0;
      lastCTTickRef.current = Date.now();
      setIsPlaying(false);

      try {
        console.log('[usePlaybackPlayer] load start', { loadKey, videoPath, shareId });

        try {
          (player as any)?.pause?.();
        } catch {}

        let nextSrc = '';

        if (videoPath) {
          nextSrc = videoPath;
        } else if (shareId) {
          const urls = await getPlaybackUrls(shareId, { signal: controller.signal });

          console.log('[usePlaybackPlayer] getPlaybackUrls result', urls);

          if (urls?.sidecarUrl) setSidecarUrl(String(urls.sidecarUrl));

          const videoUrl = urls?.videoUrl;
          if (!videoUrl) throw new Error('No videoUrl returned');
          nextSrc = String(videoUrl);
        }

        if (!nextSrc) {
          console.log('[usePlaybackPlayer] no nextSrc, stopping');
          return;
        }

        if (loadedSrcRef.current === nextSrc) {
          console.log('[usePlaybackPlayer] src unchanged, ready', { nextSrc });
          setIsReady(true);
          return;
        }

        loadedSrcRef.current = nextSrc;
        setLoadedSrc(nextSrc);

        console.log('[usePlaybackPlayer] replaceAsync ->', nextSrc);

        if ((player as any)?.replaceAsync) {
          await (player as any).replaceAsync(nextSrc);
        } else {
          (player as any)?.replace?.(nextSrc);
        }

        try {
          (player as any)?.pause?.();
        } catch {}

        if (isWeb) {
          try {
            (player as any).muted = false;
            (player as any).volume = 1;
          } catch {}
        }

        console.log('[usePlaybackPlayer] load done, ready', {
          nextSrc,
          muted: (player as any)?.muted,
          volume: (player as any)?.volume,
        });

        setIsReady(true);
      } catch (e: any) {
        if (cancelled) return;
        const msg = errToString(e);
        console.error('[usePlaybackPlayer] load error', msg, e);
        setErrorMsg(msg);
        setIsReady(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, source?.videoPath, source?.shareId, reloadNonce]);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const cRaw = (player as any)?.currentTime ?? 0;
        const c = typeof cRaw === 'number' ? cRaw : 0;

        const d0 = (player as any)?.duration;
        const dm = (player as any)?.durationMs;

        let d = 0;
        if (typeof d0 === 'number') d = d0;
        else if (typeof dm === 'number') d = dm / 1000;

        if (!isScrubbing) setNow(c);
        setDur(typeof d === 'number' ? d : 0);

        if (!isWeb) {
          const playing = (player as any)?.playing ?? (player as any)?.isPlaying ?? false;
          setIsPlaying(!!playing);
          return;
        }

        const prev = lastCTRef.current;
        const nowMs = Date.now();

        const moved = c > prev + 0.03;

        if (moved) {
          lastCTRef.current = c;
          lastCTTickRef.current = nowMs;
          setIsPlaying(true);
        } else {
          const msSinceMove = nowMs - lastCTTickRef.current;
          const graceMs = wantsPlayRef.current ? 900 : 350;

          if (msSinceMove > graceMs) {
            setIsPlaying(false);
          }
        }
      } catch {}
    }, 200);

    return () => clearInterval(id);
  }, [player, isScrubbing]);

  const atVideoEnd = useMemo(() => {
    return !isPlaying && dur > 0 && Math.abs(now - dur) < 0.25;
  }, [isPlaying, dur, now]);

  const onSeek = (sec: number) => {
    try {
      const D = getLiveDuration();
      if (!D) return;

      const clamped = Math.max(0, Math.min(D, sec));
      (player as any).currentTime = clamped;

      // Important: update UI immediately.
      setNow(clamped);

      if (isWeb) {
        lastCTRef.current = clamped;
        lastCTTickRef.current = Date.now();
      }
    } catch {}
  };

  const onPlayPause = async () => {
    console.log('[onPlayPause] click', { isReady, isPlaying, loadedSrc });

    try {
      if (!isReady) {
        setErrorMsg('Video not ready yet. Wait a second and try again.');
        return;
      }

      if (isPlaying) {
        wantsPlayRef.current = false;
        console.log('[onPlayPause] -> pause()');
        (player as any)?.pause?.();
        return;
      }

      wantsPlayRef.current = true;

      if (isWeb) {
        try {
          (player as any).muted = false;
          (player as any).volume = 1;
        } catch {}
      }

      console.log('[onPlayPause] -> play()', {
        muted: (player as any)?.muted,
        volume: (player as any)?.volume,
      });

      const maybePromise = (player as any)?.play?.();
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
    } catch (e: any) {
      const msg = errToString(e);

      if (String(msg).includes('AbortError')) {
        console.warn('[onPlayPause] AbortError (often benign on web):', msg);
        return;
      }

      console.error('[onPlayPause] error', msg, e);
      setErrorMsg(msg);
    }
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

    loading,
    errorMsg,
    refreshSignedUrl,

    sidecarUrl,
    isReady,

    loadedSrc,
  };
}