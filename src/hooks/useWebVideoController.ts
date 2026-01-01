import { useCallback, useRef, useState } from 'react';

export type WebVideoHandlers = {
  onLoadedMetadata: (e: any) => void;
  onTimeUpdate: (e: any) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
};

export function useWebVideoController() {
  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  const [webNow, setWebNow] = useState(0);
  const [webDur, setWebDur] = useState(0);
  const [webIsPlaying, setWebIsPlaying] = useState(false);

  const bindRef = useCallback((node: HTMLVideoElement | null) => {
    webVideoRef.current = node;
  }, []);

  const onLoadedMetadata = useCallback((e: any) => {
    const el = e.currentTarget as HTMLVideoElement;
    setWebDur(Number.isFinite(el.duration) ? el.duration : 0);
    setWebNow(el.currentTime || 0);
  }, []);

  const onTimeUpdate = useCallback((e: any) => {
    const el = e.currentTarget as HTMLVideoElement;
    setWebNow(el.currentTime || 0);
  }, []);

  const onPlay = useCallback(() => setWebIsPlaying(true), []);
  const onPause = useCallback(() => setWebIsPlaying(false), []);
  const onEnded = useCallback(() => setWebIsPlaying(false), []);

  const seek = useCallback(
    (sec: number) => {
      const el = webVideoRef.current;
      const D = webDur || 0;
      const clamped = Math.max(0, Math.min(D || 0, sec));

      if (el) {
        try {
          el.currentTime = clamped;
        } catch {}
      }
      setWebNow(clamped);
    },
    [webDur],
  );

  const playPause = useCallback(async () => {
    const el = webVideoRef.current;
    if (!el) return;

    try {
      el.muted = false;
      el.volume = 1;

      if (el.paused) await el.play();
      else el.pause();
    } catch (e) {
      console.log('[web video play error]', e);
    }
  }, []);

  return {
    webVideoRef,
    bindRef,
    webNow,
    webDur,
    webIsPlaying,
    seek,
    playPause,
    videoHandlers: {
      onLoadedMetadata,
      onTimeUpdate,
      onPlay,
      onPause,
      onEnded,
    } as WebVideoHandlers,
  };
}

// ✅ default export too (prevents import mismatch crashes)
export default useWebVideoController;
