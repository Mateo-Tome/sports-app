// src/hooks/usePlaybackPlayer.ts
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPlaybackUrls } from './api/getPlaybackUrls';

type Source = { videoPath?: string; shareId?: string };

export function usePlaybackPlayer(source: Source) {
  const player = useVideoPlayer('', p => {
    p.loop = false;
  });

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const lastLoadedKeyRef = useRef<string>('');
  const retryNonceRef = useRef(0);
  const [, forceRerender] = useState(0);

  const retry = useCallback(() => {
    retryNonceRef.current += 1;
    forceRerender(x => x + 1);
  }, []);

  // Load / replace source (local path OR shareId → signed URL)
  useEffect(() => {
    const videoPath = source?.videoPath ? String(source.videoPath) : '';
    const shareId = source?.shareId ? String(source.shareId) : '';

    const loadKey = videoPath ? `local:${videoPath}` : shareId ? `share:${shareId}:${retryNonceRef.current}` : '';
    if (!loadKey) return;

    // prevent reloading the same thing repeatedly (except when retryNonce changes)
    if (lastLoadedKeyRef.current === loadKey) return;
    lastLoadedKeyRef.current = loadKey;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setErrorMsg('');
      setLoading(true);
      try {
        if (videoPath) {
          await (player as any).replaceAsync(videoPath);
        } else if (shareId) {
          const { videoUrl } = await getPlaybackUrls(shareId, { signal: controller.signal });
          if (!videoUrl) throw new Error('No videoUrl');
          await (player as any).replaceAsync(String(videoUrl));
        }
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message ? String(e.message) : 'Could not load video');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, source?.videoPath, source?.shareId, retry]); // retry triggers rerender

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

    // NEW (cloud playback support)
    loading,
    errorMsg,
    retry,
  };
}
