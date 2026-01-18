import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import type { PlaybackModuleProps } from '../types';

import {
  CountBar,
  FlashToast,
  HitOutChooser,
  HomerunConfirm,
  LeftStack,
  RightStack,
  StrikeoutChooser,
} from './baseballUiParts';

import {
  BALL_COLOR,
  deriveCountAtTime,
  FOUL_COLOR,
  HIT_COLOR,
  HR_COLOR,
  K_COLOR,
  KEY_COLOR,
  OUT_COLOR,
  STRIKE_COLOR,
  WALK_COLOR,
} from './useBaseballHittingLogic';

/**
 * Lane rule:
 * - TOP: balls + hitter-positive (hit/walk/hr)
 * - BOTTOM: strikes + fouls + outs
 * Stored in meta.beltLane so EventBelt can read it.
 */
type BeltLane = 'top' | 'bottom' | undefined;

function beltLaneForKey(key: string): BeltLane {
  const k = String(key || '').toLowerCase();
  if (k === 'ball' || k === 'hit' || k === 'walk' || k === 'homerun') return 'top';
  if (k === 'strike' || k === 'foul' || k === 'strikeout' || k === 'out') return 'bottom';
  return undefined;
}

export default function BaseballHittingPlaybackModule({
  overlayOn,
  insets,
  editMode,
  editSubmode,
  onOverlayEvent,
  events,
  now,
}: PlaybackModuleProps) {
  if (!overlayOn) return null;

  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;
  const isPortrait = screenH >= screenW;

  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);
  const ROWS = 3;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(44, Math.min(70, maxSize));
  const BTN_SIZE = Math.round(SIZE * 0.75);

  const CHOOSER_TOP = isPortrait ? TOP + 40 : TOP + 10;

  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  // derive count from event stream (for playback mode)
  const derived = useMemo(() => deriveCountAtTime(events as any[], now as any), [events, now]);
  const derivedBalls = derived.balls;
  const derivedStrikes = derived.strikes;

  // Local state for edit mode
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

  // actor fallback (still fine to keep)
  const actorForKey = (key: string): 'home' | 'opponent' | 'neutral' => {
    const k = String(key || '').toLowerCase();
    if (k === 'ball' || k === 'hit' || k === 'walk' || k === 'homerun') return 'home';
    if (k === 'strike' || k === 'foul' || k === 'strikeout' || k === 'out') return 'opponent';
    return 'neutral';
  };

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    const color = KEY_COLOR[key] ?? 'rgba(148,163,184,0.9)';
    const beltLane = beltLaneForKey(key);

    onOverlayEvent?.({
      key,
      label,
      actor: actorForKey(key),
      value: undefined,
      meta: {
        beltLane, // ✅ EventBelt will use this (when present)
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

  // actions
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
      let nextStrikes = strikes;
      setStrikes(prevStrikes => {
        nextStrikes = prevStrikes < 2 ? prevStrikes + 1 : prevStrikes;
        fire('foul', 'Foul Ball', { foulsAfter: prevFouls + 1, strikesAfter: nextStrikes });
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
      type === 'single' ? 'Single' : type === 'double' ? 'Double' : type === 'triple' ? 'Triple' : 'Bunt',
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

  const displayBalls = showPalette ? balls : derivedBalls;
  const displayStrikes = showPalette ? strikes : derivedStrikes;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <CountBar insetsTop={insets.top} balls={displayBalls} strikes={displayStrikes} />

      <HitOutChooser
        showPalette={showPalette}
        open={resultChooserOpen}
        onClose={() => setResultChooserOpen(false)}
        onHit={(type) => {
          setResultChooserOpen(false);
          recordHit(type);
        }}
        onOut={(label) => {
          setResultChooserOpen(false);
          incrementOuts(label);
        }}
        CHOOSER_TOP={CHOOSER_TOP}
        EDGE_L={EDGE_L}
        EDGE_R={EDGE_R}
        screenW={screenW}
      />

      <StrikeoutChooser
        showPalette={showPalette}
        open={strikeoutChooserOpen}
        onClose={() => setStrikeoutChooserOpen(false)}
        onPick={(kind) => {
          setStrikeoutChooserOpen(false);
          recordStrikeout(kind);
        }}
        CHOOSER_TOP={CHOOSER_TOP}
        EDGE_L={EDGE_L}
        EDGE_R={EDGE_R}
        screenW={screenW}
      />

      <HomerunConfirm
        showPalette={showPalette}
        open={hrConfirmOpen}
        onCancel={() => setHrConfirmOpen(false)}
        onConfirm={() => {
          setHrConfirmOpen(false);
          recordHomerun();
        }}
        CHOOSER_TOP={CHOOSER_TOP}
        EDGE_L={EDGE_L}
        EDGE_R={EDGE_R}
        screenW={screenW}
      />

      {showPalette && toast ? (
        <FlashToast
          text={toast.text}
          tint={toast.tint}
          top={isPortrait ? insets.top + 60 : insets.top + 40}
          center
          onDone={() => setToast(null)}
        />
      ) : null}

      <LeftStack
        showPalette={showPalette}
        EDGE_L={EDGE_L}
        TOP={TOP}
        BOTTOM={BOTTOM}
        GAP={GAP}
        BTN_SIZE={BTN_SIZE}
        onBall={onBall}
        onStrike={onStrike}
        onFoul={onFoul}
      />

      <RightStack
        showPalette={showPalette}
        EDGE_R={EDGE_R}
        TOP={TOP}
        BOTTOM={BOTTOM}
        GAP={GAP}
        BTN_SIZE={BTN_SIZE}
        onOpenResult={() => setResultChooserOpen(true)}
        onOpenK={() => setStrikeoutChooserOpen(true)}
        onOpenHR={() => setHrConfirmOpen(true)}
        onWalk={recordWalk}
      />
    </View>
  );
}
