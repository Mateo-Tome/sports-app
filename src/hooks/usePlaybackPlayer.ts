// src/hooks/usePlaybackPlayer.ts
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

// ✅ If "../" breaks in your repo, this means getPlaybackUrls is under:
// src/hooks/api/getPlaybackUrls.ts
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
  // NOTE: Passing '' can create a web warning if your VideoView renders before replaceAsync completes.
  // We mitigate by never calling play until user clicks.
  const player = useVideoPlayer('', p => {
    p.loop = false;
  });

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // share playback: sidecar URL for fetching events
  const [sidecarUrl, setSidecarUrl] = useState<string | undefined>(undefined);

  // ready flag (we don’t try to play until user clicks)
  const [isReady, setIsReady] = useState(false);

  // debug: what src did we actually load
  const loadedSrcRef = useRef<string>('');
  const [loadedSrc, setLoadedSrc] = useState<string>('');

  const [reloadNonce, setReloadNonce] = useState(0);
  const lastLoadedKeyRef = useRef<string>('');

  const refreshSignedUrl = useCallback(() => {
    lastLoadedKeyRef.current = '';
    loadedSrcRef.current = '';
    setLoadedSrc('');
    setReloadNonce(n => n + 1);
  }, []);

  // ---- LOAD / REPLACE SOURCE ----
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

      try {
        console.log('[usePlaybackPlayer] load start', { loadKey, videoPath, shareId });

        // pause before swap
        try {
          (player as any)?.pause?.();
        } catch {}

        // On web, mute BEFORE replaceAsync to reduce autoplay-related failures.
        if (isWeb) {
          try {
            (player as any).muted = true;
            (player as any).volume = 0;
          } catch {}
        }

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

        // don’t reload same src
        if (loadedSrcRef.current === nextSrc) {
          console.log('[usePlaybackPlayer] src unchanged, ready', { nextSrc });
          setIsReady(true);
          return;
        }

        loadedSrcRef.current = nextSrc;
        setLoadedSrc(nextSrc);

        console.log('[usePlaybackPlayer] replaceAsync ->', nextSrc);

        // swap source
        if ((player as any)?.replaceAsync) {
          await (player as any).replaceAsync(nextSrc);
        } else {
          (player as any)?.replace?.(nextSrc);
        }

        // stay paused; user must click play
        try {
          (player as any)?.pause?.();
        } catch {}

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

  // ---- POLL PLAYER STATE ----
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const c = (player as any)?.currentTime ?? 0;

        const d0 = (player as any)?.duration;
        const dm = (player as any)?.durationMs;

        let d = 0;
        if (typeof d0 === 'number') d = d0;
        else if (typeof dm === 'number') d = dm / 1000;

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

  // ✅ Play/pause should be called ONLY from a user click
  const onPlayPause = async () => {
    console.log('[onPlayPause] click', { isReady, isPlaying, loadedSrc });

    try {
      if (!isReady) {
        setErrorMsg('Video not ready yet. Wait a second and try again.');
        return;
      }

      if (isPlaying) {
        console.log('[onPlayPause] -> pause()');
        (player as any)?.pause?.();
        return;
      }

      // unmute on click (web)
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

    // debug helpers (optional)
    loadedSrc,
  };
}
