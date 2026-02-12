import React from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OverlayProps } from './types';

import {
    CountBar,
    FlashToast,
    HitOutChooser,
    HomerunConfirm,
    LeftStack,
    StrikeoutChooser,
} from '../modules/baseball/baseballUiParts';

import { FOUL_COLOR } from '../modules/baseball/useBaseballHittingLogic';

export default function BaseballPitchingOverlay({ isRecording, onEvent }: OverlayProps) {
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
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = React.useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = React.useState(false);

  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);
  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const isPortrait = screenH >= screenW;
  const CHOOSER_TOP = isPortrait ? TOP + 40 : TOP + 10;

  // Pitcher POV colors
  const PITCHER_GOOD = '#22c55e'; // green
  const PITCHER_BAD = '#ef4444'; // red
  const PITCHER_WARN = '#f59e0b'; // amber
  const FRAME_COLOR = 'rgba(255,255,255,0.35)';

  const KEY_COLOR_PITCHING: Record<string, string> = {
    ball: PITCHER_WARN,
    strike: PITCHER_GOOD,
    foul: FOUL_COLOR,
    hit: PITCHER_BAD,
    out: PITCHER_GOOD,
    homerun: PITCHER_BAD,
    walk: PITCHER_WARN,
    strikeout: PITCHER_GOOD,
  };

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    if (!isRecording) return;

    const color = KEY_COLOR_PITCHING[key] ?? 'rgba(148,163,184,0.9)';

    onEvent({
      key,
      label,
      actor: 'neutral',
      meta: {
        pillColor: color,
        color,
        tint: color,
        buttonColor: color,
        chipColor: color,

        balls,
        strikes,
        fouls,
        outs,

        baseballMode: 'pitching',
        ...(extraMeta || {}),
      },
    });
  };

  const onBall = () => {
    if (!isRecording) return;
    setBalls((prev) => {
      const next = Math.min(prev + 1, 4);
      fire('ball', 'Ball', { ballsAfter: next });
      showToast(`Ball ${next}`, KEY_COLOR_PITCHING.ball);
      return next;
    });
  };

  const onStrike = () => {
    if (!isRecording) return;
    setStrikes((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('strike', 'Strike', { strikesAfter: next });
      showToast(`Strike ${next}`, KEY_COLOR_PITCHING.strike);
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
    showToast('Walk', KEY_COLOR_PITCHING.walk);
    resetCount();
  };

  const recordHit = (type: 'single' | 'double' | 'triple' | 'bunt') => {
    if (!isRecording) return;
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

  const incrementOuts = (label: string) => {
    if (!isRecording) return;
    setOuts((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('out', 'Out', { type: label, outsAfter: next });
      showToast(label, KEY_COLOR_PITCHING.out);
      return next;
    });
    resetCount();
  };

  const recordHomerun = () => {
    if (!isRecording) return;
    fire('homerun', 'HR Allowed', { type: 'homerun' });
    showToast('HR Allowed', KEY_COLOR_PITCHING.homerun);
    resetCount();
  };

  const recordStrikeout = (kind: 'swinging' | 'looking') => {
    if (!isRecording) return;
    setOuts((prev) => {
      const next = Math.min(prev + 1, 3);
      fire('strikeout', 'Strikeout', { kind, outsAfter: next });
      showToast(kind === 'swinging' ? 'K Swinging' : 'K Looking', KEY_COLOR_PITCHING.strikeout);
      return next;
    });
    resetCount();
  };

  const Circle = ({ label, bg, onPress }: { label: string; bg: string; onPress: () => void }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => {
        if (!isRecording) return;
        onPress();
      }}
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: BTN_SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isRecording ? 1 : 0.55,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const RightStackPitching = () => (
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
        {/* Result = “bad” for pitcher when it’s a hit; still opens hit/out chooser */}
        <Circle label="Result" bg={PITCHER_BAD} onPress={() => setResultChooserOpen(true)} />

        {/* K = good (green) */}
        <Circle label="K" bg={PITCHER_GOOD} onPress={() => setStrikeoutChooserOpen(true)} />

        {/* HR = bad (red) */}
        <Circle label="HR" bg={PITCHER_BAD} onPress={() => setHrConfirmOpen(true)} />

        {/* Walk = warning */}
        <Circle label="Walk" bg={PITCHER_WARN} onPress={recordWalk} />
      </View>
    </View>
  );

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
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

      {/* Left side buttons (Ball/Strike/Foul) are fine to keep shared */}
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

      {/* Right side uses pitcher colors */}
      <RightStackPitching />
    </View>
  );
}
