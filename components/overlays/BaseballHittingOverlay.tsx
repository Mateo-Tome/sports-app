import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OverlayProps } from './types';

// shared UI parts + colors
import {
  CountBar,
  FlashToast,
  HitOutChooser,
  HomerunConfirm,
  LeftStack,
  RightStack,
  StrikeoutChooser,
} from '../modules/baseball/baseballUiParts';

import {
  BALL_COLOR,
  FOUL_COLOR,
  HIT_COLOR,
  HR_COLOR,
  K_COLOR,
  KEY_COLOR,
  OUT_COLOR,
  STRIKE_COLOR,
  WALK_COLOR,
} from '../modules/baseball/useBaseballHittingLogic';

type BeltLane = 'top' | 'bottom' | undefined;

// strikes/top, balls/bottom
function beltLaneForHittingKey(key: string): BeltLane {
  const k = String(key || '').toLowerCase();
  if (k === 'strike' || k === 'foul' || k === 'strikeout' || k === 'out') return 'top';
  if (k === 'ball' || k === 'walk' || k === 'hit' || k === 'homerun') return 'bottom';
  return undefined;
}

export default function BaseballHittingOverlay({ isRecording, onEvent }: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;

  // layout paddings to avoid header + bottom controls from camera screen
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

  const [balls, setBalls] = React.useState(0);
  const [strikes, setStrikes] = React.useState(0);
  const [fouls, setFouls] = React.useState(0);
  const [outs, setOuts] = React.useState(0);

  const [resultChooserOpen, setResultChooserOpen] = React.useState(false);
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = React.useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = React.useState(false);

  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);
  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const isPortrait = screenH >= screenW;
  const CHOOSER_TOP = isPortrait ? TOP + 40 : TOP + 10;

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    if (!isRecording) return;

    const color = KEY_COLOR[key] ?? 'rgba(148,163,184,0.9)';
    const beltLane = beltLaneForHittingKey(key);

    onEvent({
      key,
      label,
      actor: 'neutral',
      meta: {
        beltLane,
        pillColor: color,
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

  const onBall = () => {
    if (!isRecording) return;
    setBalls((prev) => {
      const next = Math.min(prev + 1, 4);
      fire('ball', 'Ball', { ballsAfter: next });
      showToast(`Ball ${next}`, BALL_COLOR);
      return next;
    });
  };

  const onStrike = () => {
    if (!isRecording) return;
    setStrikes((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('strike', 'Strike', { strikesAfter: next });
      showToast(`Strike ${next}`, STRIKE_COLOR);
      return next;
    });
  };

  const onFoul = () => {
    if (!isRecording) return;
    setFouls((prevFouls) => {
      let nextStrikes = 0;

      setStrikes((prevStrikes) => {
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

  const recordWalk = () => {
    if (!isRecording) return;
    fire('walk', 'Walk', { type: 'walk' });
    showToast('Walk', WALK_COLOR);
    resetCount();
  };

  const recordHit = (type: 'single' | 'double' | 'triple' | 'bunt') => {
    if (!isRecording) return;
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

  const incrementOuts = (label: string) => {
    if (!isRecording) return;
    setOuts((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('out', 'Out', { type: label, outsAfter: next });
      showToast(label, OUT_COLOR);
      return next;
    });
    resetCount();
  };

  const recordHomerun = () => {
    if (!isRecording) return;
    fire('homerun', 'Home Run', { type: 'homerun' });
    showToast('Home Run', HR_COLOR);
    resetCount();
  };

  const recordStrikeout = (kind: 'swinging' | 'looking') => {
    if (!isRecording) return;
    setOuts((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('strikeout', 'Strikeout', { kind, outsAfter: next });
      showToast(kind === 'swinging' ? 'K Swinging' : 'K Looking', K_COLOR);
      return next;
    });
    resetCount();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <CountBar insetsTop={insets.top} balls={balls} strikes={strikes} />

      <HitOutChooser
        showPalette
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
        showPalette
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
        showPalette
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

      {toast ? (
        <FlashToast
          text={toast.text}
          tint={toast.tint}
          top={isPortrait ? insets.top + 60 : insets.top + 40}
          center
          onDone={() => setToast(null)}
        />
      ) : null}

      <LeftStack
        showPalette
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
        showPalette
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