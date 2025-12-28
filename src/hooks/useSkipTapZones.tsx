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

  onSkipLeft: () => void; // caller MUST seek
  onSkipRight: () => void;

  // Kept for API compatibility; taps won’t call it
  onPlayPause: () => void;

  doubleTapMs?: number;
  singleTapShowsChrome?: boolean;

  skipSeconds?: number;
  hudHoldMs?: number;
};

export function useSkipTapZones({
  chromeVisible,
  showChrome,
  onSkipLeft,
  onSkipRight,
  onPlayPause, // intentionally unused
  doubleTapMs = 280,
  singleTapShowsChrome = true,
  skipSeconds = 5,
  hudHoldMs = 650,
}: Params) {
  const isWeb = Platform.OS === 'web';

  const lastTapRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const singleTapTimerRef = useRef<{ left?: any; right?: any }>({});

  const [skipHUD, setSkipHUD] = useState<SkipHUD>(null);
  const hudHideTimerRef = useRef<any>(null);

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
    showChrome();
  }, [showChrome, singleTapShowsChrome]);

  const doSkip = useCallback(
    (side: Side) => {
      if (side === 'left') onSkipLeft();
      else onSkipRight();

      bumpHud(side);
    },
    [bumpHud, onSkipLeft, onSkipRight],
  );

  const makeHandlers = useCallback(
    (side: Side) => {
      const fireTap = () => {
        const nowMs = Date.now();
        const last = lastTapRef.current[side];

        // double tap => skip
        if (nowMs - last <= doubleTapMs) {
          lastTapRef.current[side] = 0;

          const t = (singleTapTimerRef.current as any)[side];
          if (t) clearTimeout(t);
          (singleTapTimerRef.current as any)[side] = undefined;

          doSkip(side);
          return;
        }

        // first tap: wait briefly for second
        lastTapRef.current[side] = nowMs;

        const prev = (singleTapTimerRef.current as any)[side];
        if (prev) clearTimeout(prev);

        (singleTapTimerRef.current as any)[side] = setTimeout(() => {
          (singleTapTimerRef.current as any)[side] = undefined;
          doSingle();
        }, doubleTapMs + 10);
      };

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
        onPressIn: fireTap,
        ...(webProps as any),
      };
    },
    [doSingle, doSkip, doubleTapMs, isWeb],
  );

  const left = useMemo(() => makeHandlers('left'), [makeHandlers]);
  const right = useMemo(() => makeHandlers('right'), [makeHandlers]);

  // ✅ Web keyboard shortcuts: ArrowLeft/ArrowRight -> skip + HUD
  useEffect(() => {
    if (!isWeb) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as any;
      const tag = String(target?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        doSkip('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        doSkip('right');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isWeb, doSkip]);

  return {
    isWeb,
    skipHUD,
    leftZoneProps: left,
    rightZoneProps: right,
  };
}
