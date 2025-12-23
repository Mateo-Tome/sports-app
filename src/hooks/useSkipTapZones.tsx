import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type Side = 'left' | 'right';

export type SkipHUD = {
  side: Side;
  total: number; // cumulative seconds (ex: 5, 10, 15...)
} | null;

type Params = {
  chromeVisible: boolean;
  showChrome: () => void;

  onSkipLeft: () => void; // MUST actually seek (you already do this in PlaybackScreen)
  onSkipRight: () => void;

  // Kept for API compatibility; screen taps will NOT call it.
  onPlayPause: () => void;

  doubleTapMs?: number;
  singleTapShowsChrome?: boolean; // default true

  // NEW: how many seconds per skip "tick" should the HUD show
  // (YouTube style: 10s; you want 5s)
  skipSeconds?: number;

  // NEW: how long the HUD stays visible after the last skip tap
  hudHoldMs?: number;
};

export function useSkipTapZones({
  chromeVisible,
  showChrome,
  onSkipLeft,
  onSkipRight,
  onPlayPause, // intentionally unused by screen taps
  doubleTapMs = 280,
  singleTapShowsChrome = true,
  skipSeconds = 5,
  hudHoldMs = 650,
}: Params) {
  const isWeb = Platform.OS === 'web';

  const lastTapRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const singleTapTimerRef = useRef<{ left?: any; right?: any }>({});

  // ✅ HUD state for SkipHudOverlay (cumulative like YouTube)
  const [skipHUD, setSkipHUD] = useState<SkipHUD>(null);
  const hudHideTimerRef = useRef<any>(null);

  // For accumulating multiple double-taps
  const hudAccumRef = useRef<{ side: Side; total: number; lastAt: number } | null>(null);

  const clearTimers = useCallback(() => {
    (['left', 'right'] as Side[]).forEach(side => {
      const t = (singleTapTimerRef.current as any)[side];
      if (t) clearTimeout(t);
      (singleTapTimerRef.current as any)[side] = undefined;
    });

    if (hudHideTimerRef.current) {
      clearTimeout(hudHideTimerRef.current);
      hudHideTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const scheduleHudHide = useCallback(() => {
    if (hudHideTimerRef.current) clearTimeout(hudHideTimerRef.current);
    hudHideTimerRef.current = setTimeout(() => {
      setSkipHUD(null);
      hudAccumRef.current = null;
      hudHideTimerRef.current = null;
    }, hudHoldMs);
  }, [hudHoldMs]);

  const bumpHud = useCallback(
    (side: Side) => {
      const now = Date.now();
      const prev = hudAccumRef.current;

      // Accumulate if:
      // - same side, and
      // - taps are close enough (treat as the "skip burst")
      const canAccumulate =
        prev && prev.side === side && now - prev.lastAt <= Math.max(900, hudHoldMs + 250);

      const nextTotal = canAccumulate ? prev!.total + skipSeconds : skipSeconds;

      hudAccumRef.current = { side, total: nextTotal, lastAt: now };
      setSkipHUD({ side, total: nextTotal });
      scheduleHudHide();
    },
    [hudHoldMs, scheduleHudHide, skipSeconds],
  );

  const doSingle = useCallback(() => {
    if (!singleTapShowsChrome) return;
    // Single tap should NEVER play/pause.
    showChrome();
  }, [showChrome, singleTapShowsChrome]);

  const doSkip = useCallback(
    (side: Side) => {
      // 1) Seek (caller handles actual onSeek)
      if (side === 'left') onSkipLeft();
      else onSkipRight();

      // 2) HUD accumulation
      bumpHud(side);
    },
    [bumpHud, onSkipLeft, onSkipRight],
  );

  const makeHandlers = useCallback(
    (side: Side) => {
      const fireTap = () => {
        const nowMs = Date.now();
        const last = lastTapRef.current[side];

        // Double-tap => skip
        if (nowMs - last <= doubleTapMs) {
          lastTapRef.current[side] = 0;

          const t = (singleTapTimerRef.current as any)[side];
          if (t) clearTimeout(t);
          (singleTapTimerRef.current as any)[side] = undefined;

          doSkip(side);
          return;
        }

        // First tap: wait briefly to see if a 2nd tap arrives.
        lastTapRef.current[side] = nowMs;

        const prev = (singleTapTimerRef.current as any)[side];
        if (prev) clearTimeout(prev);

        (singleTapTimerRef.current as any)[side] = setTimeout(() => {
          (singleTapTimerRef.current as any)[side] = undefined;
          doSingle();
        }, doubleTapMs + 10);
      };

      // Web: allow dblclick to skip immediately
      const webProps = isWeb
        ? ({
            onDoubleClick: (e: any) => {
              e?.preventDefault?.();
              e?.stopPropagation?.();

              lastTapRef.current[side] = 0;

              const t = (singleTapTimerRef.current as any)[side];
              if (t) clearTimeout(t);
              (singleTapTimerRef.current as any)[side] = undefined;

              doSkip(side);
            },
          } as any)
        : ({} as any);

      return {
        // onPressIn is more immediate for double-tap detection
        onPressIn: fireTap,
        ...(webProps as any),
      };
    },
    [doSingle, doSkip, doubleTapMs, isWeb],
  );

  const left = useMemo(() => makeHandlers('left'), [makeHandlers]);
  const right = useMemo(() => makeHandlers('right'), [makeHandlers]);

  // Web keyboard shortcuts:
  // ArrowLeft / ArrowRight = skip + HUD accumulation
  useEffect(() => {
    if (!isWeb) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as any;
      const tag = String(target?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        doSkip('left');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        doSkip('right');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isWeb, doSkip]);

  return {
    isWeb,
    skipHUD, // ✅ USE THIS to drive SkipHudOverlay
    leftZoneProps: left,
    rightZoneProps: right,
  };
}
