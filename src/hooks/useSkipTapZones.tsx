import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

type Side = 'left' | 'right';

type Params = {
  chromeVisible: boolean;
  showChrome: () => void;

  onSkipLeft: () => void; // rewind 5s
  onSkipRight: () => void; // forward 5s

  // Kept for API compatibility; screen taps will NOT call it.
  onPlayPause: () => void;

  doubleTapMs?: number;
  singleTapShowsChrome?: boolean; // default true
};

export function useSkipTapZones({
  chromeVisible,
  showChrome,
  onSkipLeft,
  onSkipRight,
  onPlayPause, // intentionally unused by screen taps
  doubleTapMs = 280,
  singleTapShowsChrome = true,
}: Params) {
  const isWeb = Platform.OS === 'web';

  const lastTapRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const singleTapTimerRef = useRef<{ left?: any; right?: any }>({});

  const clearTimers = useCallback(() => {
    (['left', 'right'] as Side[]).forEach(side => {
      const t = (singleTapTimerRef.current as any)[side];
      if (t) clearTimeout(t);
      (singleTapTimerRef.current as any)[side] = undefined;
    });
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const doSingle = useCallback(() => {
    if (!singleTapShowsChrome) return;
    // Single tap should NEVER play/pause.
    // Just show chrome.
    showChrome();
  }, [showChrome, singleTapShowsChrome]);

  const doSkip = useCallback(
    (side: Side) => {
      if (side === 'left') onSkipLeft();
      else onSkipRight();
    },
    [onSkipLeft, onSkipRight],
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
        // Pressable onPress can be delayed by press retention on some platforms.
        // onPressIn is more immediate for double-tap detection.
        onPressIn: fireTap,
        ...(webProps as any),
      };
    },
    [doubleTapMs, doSingle, doSkip, isWeb],
  );

  const left = useMemo(() => makeHandlers('left'), [makeHandlers]);
  const right = useMemo(() => makeHandlers('right'), [makeHandlers]);

  // Web keyboard shortcuts:
  // ArrowLeft / ArrowRight = skip
  // NO spacebar play/pause (only button should do that)
  useEffect(() => {
    if (!isWeb) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as any;
      const tag = String(target?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSkipLeft();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSkipRight();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isWeb, onSkipLeft, onSkipRight]);

  return {
    isWeb,
    leftZoneProps: left,
    rightZoneProps: right,
  };
}
