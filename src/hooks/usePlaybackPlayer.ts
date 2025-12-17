// app/screens/playback/hooks/usePlaybackPlayer.ts
import { useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';

export function usePlaybackPlayer(videoPath: string) {
  const player = useVideoPlayer('', p => {
    p.loop = false;
  });

  // Load / replace source
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoPath) return;
      try {
        await (player as any).replaceAsync(String(videoPath));
        if (cancelled) return;
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [videoPath, player]);

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Poll player state (matches your existing logic)
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
    getLiveDuration, // keep exposed because your screen uses it
  };
}
