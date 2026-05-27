import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { PlaybackModuleProps } from '../types';

import {
  FlashToast,
  HitOutChooser,
  HomerunConfirm,
  StrikeChooser,
  StrikeoutChooser,
} from './baseballUiParts';

import { deriveCountAtTime, FOUL_COLOR } from './useBaseballHittingLogic';

type BeltLane = 'top' | 'bottom' | undefined;

function beltLaneForKeyPitching(key: string): BeltLane {
  const k = String(key || '').toLowerCase();

  if (
    k === 'ball' ||
    k === 'hit' ||
    k === 'walk' ||
    k === 'homerun' ||
    k === 'hit_by_pitch'
  ) {
    return 'top';
  }

  if (k === 'strike' || k === 'foul' || k === 'strikeout' || k === 'out') {
    return 'bottom';
  }

  return undefined;
}

export default function BaseballPitchingPlaybackModule({
  overlayOn,
  insets,
  editMode,
  editSubmode,
  onOverlayEvent,
  events,
  now,
}: PlaybackModuleProps) {
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

  const showPalette =
    !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  const PITCHER_GOOD = '#22c55e';
  const PITCHER_BAD = '#ef4444';
  const PITCHER_WARN = '#f59e0b';

  const KEY_COLOR_PITCHING: Record<string, string> = {
    ball: PITCHER_BAD,
    strike: PITCHER_GOOD,
    foul: FOUL_COLOR,
    hit: PITCHER_BAD,
    out: PITCHER_GOOD,
    homerun: PITCHER_BAD,
    walk: PITCHER_WARN,
    hit_by_pitch: PITCHER_WARN,
    strikeout: PITCHER_GOOD,
  };

  const derived = useMemo(
    () => deriveCountAtTime(events as any[], now as any),
    [events, now],
  );

  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [outs, setOuts] = useState(0);

  const [resultChooserOpen, setResultChooserOpen] = useState(false);
  const [strikeChooserOpen, setStrikeChooserOpen] = useState(false);
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = useState(false);

  const [toast, setToast] = useState<null | { text: string; tint: string }>(
    null,
  );

  if (!overlayOn) return null;

  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  const actorForKey = (_key: string): 'home' | 'opponent' | 'neutral' =>
    'neutral';

  const fire = (
    key: string,
    label: string,
    extraMeta?: Record<string, any>,
  ) => {
    const color = KEY_COLOR_PITCHING[key] ?? 'rgba(148,163,184,0.9)';
    const beltLane = beltLaneForKeyPitching(key);

    onOverlayEvent?.({
      key,
      label,
      actor: actorForKey(key),
      value: undefined,
      meta: {
        baseballMode: 'pitching',
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
    const next = Math.min(balls + 1, 4);

    setBalls(next);
    fire('ball', 'Ball', { ballsAfter: next });
    showToast(`Ball ${next}`, KEY_COLOR_PITCHING.ball);
  };

  const recordStrike = (strikeKind: 'swinging' | 'looking') => {
    const next = Math.min(strikes + 1, 3);
    const label =
      strikeKind === 'swinging' ? 'Strike Swinging' : 'Strike Looking';

    setStrikes(next);

    fire('strike', label, {
      kind: strikeKind,
      strikesAfter: next,
    });

    showToast(
      strikeKind === 'swinging'
        ? `Swinging Strike ${next}`
        : `Looking Strike ${next}`,
      KEY_COLOR_PITCHING.strike,
    );
  };

  const onStrike = () => {
    setStrikeChooserOpen(true);
  };

  const onFoul = () => {
    const nextFouls = fouls + 1;
    const nextStrikes = strikes < 2 ? strikes + 1 : strikes;

    setFouls(nextFouls);
    setStrikes(nextStrikes);

    fire('foul', 'Foul Ball', {
      foulsAfter: nextFouls,
      strikesAfter: nextStrikes,
    });

    showToast(`Foul (${nextFouls})`, FOUL_COLOR);
  };

  const recordWalk = () => {
    fire('walk', 'Walk', { type: 'walk' });
    showToast('Walk', KEY_COLOR_PITCHING.walk);
    resetCount();
  };

  const recordHitByPitch = () => {
    fire('hit_by_pitch', 'HBP Allowed', { type: 'hit_by_pitch' });
    showToast('HBP Allowed', KEY_COLOR_PITCHING.hit_by_pitch);
    resetCount();
  };

  const recordHit = (type: 'single' | 'double' | 'triple' | 'bunt') => {
    fire('hit', 'Hit Allowed', { type });

    showToast(
      type === 'single'
        ? '1B Allowed'
        : type === 'double'
          ? '2B Allowed'
          : type === 'triple'
            ? '3B Allowed'
            : 'Bunt Hit',
      KEY_COLOR_PITCHING.hit,
    );

    resetCount();
  };

  const incrementOuts = (type: string) => {
    const next = Math.min(outs + 1, 3);

    setOuts(next);

    fire('out', 'Out', {
      type,
      outsAfter: next,
    });

    showToast(type, KEY_COLOR_PITCHING.out);
    resetCount();
  };

  const recordHomerun = () => {
    fire('homerun', 'HR Allowed', { type: 'homerun' });
    showToast('HR Allowed', KEY_COLOR_PITCHING.homerun);
    resetCount();
  };

  const recordStrikeout = (strikeoutKind: 'swinging' | 'looking') => {
    const next = Math.min(outs + 1, 3);

    setOuts(next);

    fire('strikeout', 'Strikeout', {
      kind: strikeoutKind,
      outsAfter: next,
    });

    showToast(
      strikeoutKind === 'swinging' ? 'K Swinging' : 'K Looking',
      KEY_COLOR_PITCHING.strikeout,
    );

    resetCount();
  };

  const displayBalls = showPalette ? balls : derived.balls;
  const displayStrikes = showPalette ? strikes : derived.strikes;

  const PitchingCountBar = () => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.65)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.35)',
        }}
      >
        <Text style={{ fontSize: 11 }}>
          <Text style={{ color: KEY_COLOR_PITCHING.ball, fontWeight: '800' }}>
            Balls:{' '}
          </Text>
          <Text style={{ color: 'white', fontWeight: '900' }}>
            {displayBalls}
          </Text>
          <Text style={{ color: 'white' }}>   </Text>
          <Text style={{ color: KEY_COLOR_PITCHING.strike, fontWeight: '800' }}>
            Strikes:{' '}
          </Text>
          <Text style={{ color: 'white', fontWeight: '900' }}>
            {displayStrikes}
          </Text>
        </Text>
      </View>
    </View>
  );

  const Circle = ({
    label,
    bg,
    onPress,
  }: {
    label: string;
    bg: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      disabled={!showPalette}
      onPress={() => showPalette && onPress()}
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: BTN_SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: showPalette ? 1 : 0.0,
      }}
    >
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <PitchingCountBar />

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
        showPalette={showPalette}
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

      {showPalette ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: EDGE_L,
            top: TOP,
            bottom: BOTTOM,
            justifyContent: 'center',
          }}
        >
          <View style={{ gap: GAP }}>
            <Circle label="Ball" bg={KEY_COLOR_PITCHING.ball} onPress={onBall} />
            <Circle
              label="Strike"
              bg={KEY_COLOR_PITCHING.strike}
              onPress={onStrike}
            />
            <Circle label="Foul" bg={FOUL_COLOR} onPress={onFoul} />
          </View>
        </View>
      ) : null}

      {showPalette ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            right: EDGE_R,
            top: TOP,
            bottom: BOTTOM,
            justifyContent: 'center',
            alignItems: 'flex-end',
          }}
        >
          <View style={{ gap: GAP }}>
            <Circle
              label="Result"
              bg={KEY_COLOR_PITCHING.hit}
              onPress={() => setResultChooserOpen(true)}
            />
            <Circle
              label="K"
              bg={KEY_COLOR_PITCHING.strikeout}
              onPress={() => setStrikeoutChooserOpen(true)}
            />
            <Circle
              label="HR"
              bg={KEY_COLOR_PITCHING.homerun}
              onPress={() => setHrConfirmOpen(true)}
            />
            <Circle
              label="Walk"
              bg={KEY_COLOR_PITCHING.walk}
              onPress={recordWalk}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}