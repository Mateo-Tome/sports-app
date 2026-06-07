import React from 'react';
import { TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OverlayProps } from './types';

import {
  CountBar,
  FlashToast,
  HitOutChooser,
  HomerunConfirm,
  LeftStack,
  RightStack,
  StrikeChooser,
  StrikeoutChooser,
} from '../modules/baseball/baseballUiParts';

import { OverlayCompactText } from './OverlayCompactText';

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
type PendingRbiEvent =
  | { key: 'hit'; label: string; color: string; meta: Record<string, any>; toastBase: string }
  | { key: 'homerun'; label: string; color: string; meta: Record<string, any>; toastBase: string }
  | { key: 'walk'; label: string; color: string; meta: Record<string, any>; toastBase: string }
  | { key: 'hit_by_pitch'; label: string; color: string; meta: Record<string, any>; toastBase: string }
  | { key: 'out'; label: string; color: string; meta: Record<string, any>; toastBase: string };

function beltLaneForHittingKey(key: string): BeltLane {
  const k = String(key || '').toLowerCase();
  if (k === 'strike' || k === 'foul' || k === 'strikeout' || k === 'out') return 'top';

  if (
    k === 'ball' ||
    k === 'walk' ||
    k === 'hit' ||
    k === 'homerun' ||
    k === 'hit_by_pitch'
  ) {
    return 'bottom';
  }

  return undefined;
}

function RbiChooser({
  open,
  pending,
  top,
  screenW,
  edgeL,
  edgeR,
  onPick,
  onCancel,
}: {
  open: boolean;
  pending: PendingRbiEvent | null;
  top: number;
  screenW: number;
  edgeL: number;
  edgeR: number;
  onPick: (rbi: number) => void;
  onCancel: () => void;
}) {
  if (!open || !pending) return null;

  const maxW = Math.max(280, Math.min(screenW - edgeL - edgeR, 420));

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        left: edgeL,
        right: edgeR,
        alignItems: 'center',
        zIndex: 80,
      }}
    >
      <View
        style={{
          width: maxW,
          borderRadius: 22,
          padding: 12,
          backgroundColor: 'rgba(0,0,0,0.82)',
          borderWidth: 1,
          borderColor: pending.color,
        }}
      >
        <OverlayCompactText
          style={{
            color: 'white',
            fontWeight: '900',
            fontSize: 13,
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          RBI for {pending.toastBase}?
        </OverlayCompactText>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2, 3, 4].map((rbi) => (
            <TouchableOpacity
              key={rbi}
              onPress={() => onPick(rbi)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: rbi === 0 ? 'rgba(255,255,255,0.13)' : pending.color,
                borderWidth: 1,
                borderColor: rbi === 0 ? 'rgba(255,255,255,0.25)' : pending.color,
              }}
            >
              <OverlayCompactText
                style={{
                  color: 'white',
                  fontWeight: '900',
                  fontSize: 15,
                }}
              >
                {rbi}
              </OverlayCompactText>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={onCancel}
          style={{
            alignSelf: 'center',
            marginTop: 10,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.10)',
          }}
        >
          <OverlayCompactText style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '800' }}>
            Cancel
          </OverlayCompactText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BaseballHittingOverlay({ isRecording, onEvent }: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;

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
  const [strikeChooserOpen, setStrikeChooserOpen] = React.useState(false);
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = React.useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = React.useState(false);

  const [pendingRbi, setPendingRbi] = React.useState<PendingRbiEvent | null>(null);

  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);
  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const isPortrait = screenH >= screenW;
  const CHOOSER_TOP = isPortrait ? TOP + 40 : TOP + 10;

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  const colorForKey = (key: string) => {
    if (key === 'hit_by_pitch') return WALK_COLOR;
    return KEY_COLOR[key] ?? 'rgba(148,163,184,0.9)';
  };

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    if (!isRecording) return;

    const color = colorForKey(key);
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

  const askRbi = (pending: PendingRbiEvent) => {
    if (!isRecording) return;
    setPendingRbi(pending);
  };

  const finishPendingRbi = (rbi: number) => {
    const pending = pendingRbi;
    if (!pending) return;

    fire(pending.key, pending.label, {
      ...pending.meta,
      rbi,
      hasRbi: rbi > 0,
    });

    showToast(
      rbi > 0 ? `${pending.toastBase} • ${rbi} RBI` : pending.toastBase,
      pending.color,
    );

    setPendingRbi(null);
    resetCount();
  };

  const cancelPendingRbi = () => {
    setPendingRbi(null);
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

  const recordStrike = (kind: 'swinging' | 'looking') => {
    if (!isRecording) return;
    setStrikes((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('strike', kind === 'swinging' ? 'Strike Swinging' : 'Strike Looking', {
        kind,
        strikesAfter: next,
      });
      showToast(
        kind === 'swinging' ? `Swinging Strike ${next}` : `Looking Strike ${next}`,
        STRIKE_COLOR,
      );
      return next;
    });
  };

  const onStrike = () => {
    if (!isRecording) return;
    setStrikeChooserOpen(true);
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

    askRbi({
      key: 'walk',
      label: 'Walk',
      color: WALK_COLOR,
      meta: { type: 'walk' },
      toastBase: 'Walk',
    });
  };

  const recordHitByPitch = () => {
    if (!isRecording) return;

    askRbi({
      key: 'hit_by_pitch',
      label: 'HBP',
      color: WALK_COLOR,
      meta: { type: 'hit_by_pitch' },
      toastBase: 'Hit By Pitch',
    });
  };

  const recordHit = (type: 'single' | 'double' | 'triple' | 'bunt') => {
    if (!isRecording) return;

    const toastBase =
      type === 'single'
        ? 'Single'
        : type === 'double'
          ? 'Double'
          : type === 'triple'
            ? 'Triple'
            : 'Bunt';

    askRbi({
      key: 'hit',
      label: 'Hit',
      color: HIT_COLOR,
      meta: { type },
      toastBase,
    });
  };

  const incrementOuts = (label: string) => {
    if (!isRecording) return;
  
    setOuts((prev) => {
      const next = Math.min(prev + 1, 3);
  
      const cleanLabel = String(label ?? '').trim();
      const lower = cleanLabel.toLowerCase();
  
      const isSacBunt =
        lower === 'sac bunt' ||
        lower === 'sacrifice bunt' ||
        lower.includes('sac bunt') ||
        lower.includes('sacrifice bunt');
  
      askRbi({
        key: 'out',
        label: 'Out',
        color: OUT_COLOR,
        meta: {
          type: isSacBunt ? 'sac_bunt' : cleanLabel,
          label: cleanLabel,
          isSacrifice: isSacBunt,
          outsAfter: next,
        },
        toastBase: cleanLabel,
      });
  
      return next;
    });
  };

  const recordHomerun = () => {
    if (!isRecording) return;

    askRbi({
      key: 'homerun',
      label: 'Home Run',
      color: HR_COLOR,
      meta: { type: 'homerun' },
      toastBase: 'Home Run',
    });
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
        onHbp={() => {
          setResultChooserOpen(false);
          recordHitByPitch();
        }}
        CHOOSER_TOP={CHOOSER_TOP}
        EDGE_L={EDGE_L}
        EDGE_R={EDGE_R}
        screenW={screenW}
      />

      <StrikeChooser
        showPalette
        open={strikeChooserOpen}
        onClose={() => setStrikeChooserOpen(false)}
        onPick={(kind) => {
          setStrikeChooserOpen(false);
          recordStrike(kind);
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

      <RbiChooser
        open={!!pendingRbi}
        pending={pendingRbi}
        top={CHOOSER_TOP}
        screenW={screenW}
        edgeL={EDGE_L}
        edgeR={EDGE_R}
        onPick={finishPendingRbi}
        onCancel={cancelPendingRbi}
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