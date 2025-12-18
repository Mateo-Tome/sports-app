// src/hooks/usePlaybackChrome.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type SkipHUD = { side: 'left' | 'right'; total: number; shownAt: number } | null;

export function usePlaybackChrome(opts: {
  now: number;
  isPlaying: boolean;
  editMode: boolean;
  showEventBelt: boolean;

  insets: { top: number; right: number; bottom: number; left: number };

  beltHeight: number; // pass BELT_H from PlaybackChrome.tsx
  safeMargin: number; // pass SAFE_MARGIN from PlaybackChrome.tsx

  skipSeconds?: number; // default 5
  hideAfterMs?: number; // default 2200
  doubleTapMs?: number; // default 260

  onSeek: (t: number) => void; // seek absolute time in seconds
}) {
  const {
    now,
    isPlaying,
    editMode,
    showEventBelt,
    insets,
    beltHeight,
    safeMargin,
    onSeek,
    skipSeconds = 5,
    hideAfterMs = 2200,
    doubleTapMs = 260,
  } = opts;

  // chrome visibility
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    clearHideTimer();
    hideTimer.current = setTimeout(() => setChromeVisible(false), hideAfterMs);
  }, [clearHideTimer, hideAfterMs]);

  useEffect(() => {
    clearHideTimer();
    if (!editMode) {
      if (isPlaying) showChrome();
      else setChromeVisible(true);
    } else {
      setChromeVisible(false);
    }
    return clearHideTimer;
  }, [isPlaying, showChrome, editMode, clearHideTimer]);

  // skip HUD
  const [skipHUD, setSkipHUD] = useState<SkipHUD>(null);
  const skipHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSkipHud = useCallback((side: 'left' | 'right', add: number) => {
    setSkipHUD(prev => {
      const nowMs = Date.now();
      if (prev && prev.side === side && nowMs - prev.shownAt < 600) {
        return { side, total: prev.total + add, shownAt: nowMs };
      }
      return { side, total: add, shownAt: nowMs };
    });

    if (skipHudTimer.current) clearTimeout(skipHudTimer.current);
    skipHudTimer.current = setTimeout(() => setSkipHUD(null), 900);
  }, []);

  // double-tap zones
  const lastTapLeft = useRef(0);
  const lastTapRight = useRef(0);

  const onSeekRelative = useCallback(
    (delta: number) => {
      const t = (now || 0) + delta;
      onSeek(t);
    },
    [now, onSeek],
  );

  const handleLeftTap = useCallback(() => {
    const nowMs = Date.now();
    if (nowMs - lastTapLeft.current < doubleTapMs) {
      lastTapLeft.current = 0;
      onSeekRelative(-skipSeconds);
      showSkipHud('left', skipSeconds);
      showChrome();
    } else {
      lastTapLeft.current = nowMs;
      setTimeout(() => showChrome(), doubleTapMs + 20);
    }
  }, [doubleTapMs, onSeekRelative, skipSeconds, showSkipHud, showChrome]);

  const handleRightTap = useCallback(() => {
    const nowMs = Date.now();
    if (nowMs - lastTapRight.current < doubleTapMs) {
      lastTapRight.current = 0;
      onSeekRelative(+skipSeconds);
      showSkipHud('right', skipSeconds);
      showChrome();
    } else {
      lastTapRight.current = nowMs;
      setTimeout(() => showChrome(), doubleTapMs + 20);
    }
  }, [doubleTapMs, onSeekRelative, skipSeconds, showSkipHud, showChrome]);

  // layout helpers
  const SCRUB_RESERVED_TOP = insets.top + 150;
  const tapZoneBottomGap = (showEventBelt ? beltHeight : 0) + insets.bottom;

  // For your Skip HUD bounds calc in the screen
  const skipHudSideOffset = safeMargin; // used by screen for left/right positioning

  return {
    chromeVisible,
    showChrome,

    skipHUD,
    handleLeftTap,
    handleRightTap,

    SCRUB_RESERVED_TOP,
    tapZoneBottomGap,

    skipHudSideOffset,
  };
}
