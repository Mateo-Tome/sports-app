// components/modules/baseball/useBaseballHittingLogic.ts
import { useMemo, useState } from 'react';

type AnyEvent = { t?: number; meta?: any };

export const BALL_COLOR = '#22c55e'; // green
export const STRIKE_COLOR = '#ef4444'; // red
export const FOUL_COLOR = '#eab308'; // yellow
export const HIT_COLOR = '#22c55e'; // green
export const OUT_COLOR = '#f97316'; // orange
export const HR_COLOR = '#eab308'; // yellow/gold
export const WALK_COLOR = '#0ea5e9'; // cyan/blue for walk
export const K_COLOR = '#CF1020'; // fire truck red
export const FRAME_COLOR = 'rgba(255,255,255,0.35)';

export const KEY_COLOR: Record<string, string> = {
  ball: BALL_COLOR,
  strike: STRIKE_COLOR,
  foul: FOUL_COLOR,
  hit: HIT_COLOR,
  out: OUT_COLOR,
  homerun: HR_COLOR,
  walk: WALK_COLOR,
  strikeout: K_COLOR,
};

/**
 * Baseball module logic packed into one hook:
 * - derived count from events during normal playback
 * - edit mode state + event firing + toast + choosers
 */
export function useBaseballHittingLogic(args: {
  events: AnyEvent[] | undefined;
  now: number;
  showPalette: boolean;
  onOverlayEvent?: (e: any) => void;
}) {
  const { events, now, showPalette, onOverlayEvent } = args;

  // ======== COUNT FROM EVENTS FOR NORMAL PLAYBACK =========
  const lastCount = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return null;
    let found: { balls: number; strikes: number; fouls: number } | null = null;

    for (let i = 0; i < events.length; i++) {
      const row: any = events[i];

      // Only consider events up to the current playback time
      if (typeof row.t === 'number' && row.t > now) break;

      const m = row?.meta;
      if (!m) continue;

      const hasCountMeta =
        typeof m.balls === 'number' ||
        typeof m.strikes === 'number' ||
        typeof m.fouls === 'number' ||
        typeof m.ballsAfter === 'number' ||
        typeof m.strikesAfter === 'number' ||
        typeof m.foulsAfter === 'number';

      if (hasCountMeta) {
        found = {
          balls:
            typeof m.ballsAfter === 'number'
              ? m.ballsAfter
              : typeof m.balls === 'number'
              ? m.balls
              : 0,
          strikes:
            typeof m.strikesAfter === 'number'
              ? m.strikesAfter
              : typeof m.strikes === 'number'
              ? m.strikes
              : 0,
          fouls:
            typeof m.foulsAfter === 'number'
              ? m.foulsAfter
              : typeof m.fouls === 'number'
              ? m.fouls
              : 0,
        };
      }
    }

    return found;
  }, [events, now]);

  const derivedBalls = lastCount?.balls ?? 0;
  const derivedStrikes = lastCount?.strikes ?? 0;

  // ======== LOCAL STATE FOR EDIT MODE (overlay-style) =========
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [outs, setOuts] = useState(0);

  const [resultChooserOpen, setResultChooserOpen] = useState(false);
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = useState(false);

  const [toast, setToast] = useState<null | { text: string; tint: string }>(null);
  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    const color = KEY_COLOR[key] ?? 'rgba(148,163,184,0.9)';

    onOverlayEvent?.({
      key,
      label,
      actor: 'neutral',
      value: undefined,
      meta: {
        color,
        tint: color,
        buttonColor: color,
        chipColor: color,
        balls,
        strikes,
        fouls,
        outs,
        ...(extraMeta || {}),
      },
    });
  };

  // --- Count actions --------------------------------------------------------
  const onBall = () => {
    setBalls(prev => {
      const next = Math.min(prev + 1, 4);
      fire('ball', 'Ball', { ballsAfter: next });
      showToast(`Ball ${next}`, BALL_COLOR);
      return next;
    });
  };

  const onStrike = () => {
    setStrikes(prev => {
      const next = Math.min(prev + 1, 3);
      fire('strike', 'Strike', { strikesAfter: next });
      showToast(`Strike ${next}`, STRIKE_COLOR);
      return next;
    });
  };

  const onFoul = () => {
    setFouls(prevFouls => {
      let nextStrikes: number;
      setStrikes(prevStrikes => {
        nextStrikes = prevStrikes < 2 ? prevStrikes + 1 : prevStrikes;
        fire('foul', 'Foul Ball', {
          foulsAfter: prevFouls + 1,
          strikesAfter: nextStrikes,
        });
        return nextStrikes;
      });
      const newFouls = prevFouls + 1;
      showToast(`Foul (${newFouls})`, FOUL_COLOR);
      return newFouls;
    });
  };

  const incrementOuts = (type: string) => {
    setOuts(prev => {
      const next = Math.min(prev + 1, 3);
      fire('out', 'Out', { type, outsAfter: next });
      showToast(type, OUT_COLOR);
      return next;
    });
    resetCount();
  };

  const recordHit = (type: 'single' | 'double' | 'triple' | 'bunt') => {
    fire('hit', 'Hit', { type });
    showToast(
      type === 'single'
        ? 'Single'
        : type === 'double'
        ? 'Double'
        : type === 'triple'
        ? 'Triple'
        : 'Bunt',
      HIT_COLOR,
    );
    resetCount();
  };

  const recordHomerun = () => {
    fire('homerun', 'Home Run', { type: 'homerun' });
    showToast('Home Run', HR_COLOR);
    resetCount();
  };

  const recordWalk = () => {
    fire('walk', 'Walk', { type: 'walk' });
    showToast('Walk', WALK_COLOR);
    resetCount();
  };

  const recordStrikeout = (kind: 'swinging' | 'looking') => {
    setOuts(prev => {
      const next = Math.min(prev + 1, 3);
      fire('strikeout', 'Strikeout', { kind, outsAfter: next });
      showToast(kind === 'swinging' ? 'K Swinging' : 'K Looking', K_COLOR);
      return next;
    });
    resetCount();
  };

  // If palette is off, the UI should not show choosers (avoid “stuck open”)
  const safeResultOpen = showPalette ? resultChooserOpen : false;
  const safeStrikeoutOpen = showPalette ? strikeoutChooserOpen : false;
  const safeHrOpen = showPalette ? hrConfirmOpen : false;

  return {
    // derived (normal playback)
    derivedBalls,
    derivedStrikes,

    // edit state
    balls,
    strikes,
    fouls,
    outs,

    // chooser state
    resultChooserOpen: safeResultOpen,
    strikeoutChooserOpen: safeStrikeoutOpen,
    hrConfirmOpen: safeHrOpen,
    setResultChooserOpen,
    setStrikeoutChooserOpen,
    setHrConfirmOpen,

    // toast
    toast,
    setToast,
    showToast,

    // actions
    onBall,
    onStrike,
    onFoul,
    incrementOuts,
    recordHit,
    recordHomerun,
    recordWalk,
    recordStrikeout,
  };
}
