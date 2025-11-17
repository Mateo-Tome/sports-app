// components/overlays/BaseballHittingOverlay.tsx

import React from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OverlayProps } from './types';

/** Tiny visual confirmation toast (no haptics) */
function FlashToast({
  text,
  tint,
  top,
  center = true,
  onDone,
}: {
  text: string;
  tint: string;
  top: number;
  center?: boolean;
  onDone?: () => void;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(6)).current;

  React.useEffect(() => {
    const animIn = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]);
    const animOut = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        delay: 750,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -6,
        duration: 150,
        delay: 750,
        useNativeDriver: true,
      }),
    ]);
    animIn.start(() => {
      animOut.start(({ finished }) => finished && onDone?.());
    });
  }, [opacity, translateY, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left: center ? undefined : 12,
        right: center ? undefined : 12,
        alignSelf: center ? 'center' : 'auto',
        opacity,
        transform: [{ translateY }],
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: tint,
        zIndex: 100,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900' }}>{text}</Text>
    </Animated.View>
  );
}

export default function BaseballHittingOverlay({
  isRecording,
  onEvent,
  getCurrentTSec: _getCurrentTSec,
  sport: _sport,
  style: _style,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;
  const isPortrait = screenH >= screenW;

  // layout padding
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

  // colors
  const BALL_COLOR = '#22c55e';
  const STRIKE_COLOR = '#ef4444';
  const FOUL_COLOR = '#eab308';
  const HIT_COLOR = '#22c55e';
  const OUT_COLOR = '#f97316';
  const HR_COLOR = '#eab308';
  const WALK_COLOR = '#0ea5e9';
  const K_COLOR = '#CF1020';
  const FRAME_COLOR = 'rgba(255,255,255,0.35)';

  // map keys to pill colors
  const KEY_COLOR: Record<string, string> = {
    ball: BALL_COLOR,
    strike: STRIKE_COLOR,
    foul: FOUL_COLOR,
    hit: HIT_COLOR,
    out: OUT_COLOR,
    homerun: HR_COLOR,
    walk: WALK_COLOR,
    strikeout: K_COLOR,
  };

  // count state
  const [balls, setBalls] = React.useState(0);
  const [strikes, setStrikes] = React.useState(0);
  const [fouls, setFouls] = React.useState(0);
  const [outs, setOuts] = React.useState(0);

  // popups
  const [resultChooserOpen, setResultChooserOpen] = React.useState(false);
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = React.useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = React.useState(false);
  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);

  const showToast = (text: string, tint: string) => setToast({ text, tint });
  const CHOOSER_TOP = isPortrait ? TOP + 40 : TOP + 10;

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  // UPDATED FIRE — adds pillColor + tint + chipColor for the BELT
  const fire = (
    key: string,
    label: string,
    extraMeta?: Record<string, any>,
  ) => {
    if (!isRecording) return;

    const color = KEY_COLOR[key] ?? 'rgba(148,163,184,0.9)';

    onEvent({
      key,
      label,
      actor: 'neutral',
      value: undefined,
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
        ...(extraMeta || {}),
      },
    });
  };

  // ---- Handlers ----

  const onBall = () => {
    if (!isRecording) return;
    setBalls(prev => {
      const next = Math.min(prev + 1, 4);
      fire('ball', 'Ball', { ballsAfter: next });
      showToast(`Ball ${next}`, BALL_COLOR);
      return next;
    });
  };

  const onStrike = () => {
    if (!isRecording) return;
    setStrikes(prev => {
      const next = Math.min(prev + 1, 3);
      fire('strike', 'Strike', { strikesAfter: next });
      showToast(`Strike ${next}`, STRIKE_COLOR);
      return next;
    });
  };

  const onFoul = () => {
    if (!isRecording) return;
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
    if (!isRecording) return;
    setOuts(prev => {
      const next = Math.min(prev + 1, 3);
      fire('out', 'Out', { type, outsAfter: next });
      showToast(type, OUT_COLOR);
      return next;
    });
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
      HIT_COLOR
    );
    resetCount();
  };

  const recordHomerun = () => {
    if (!isRecording) return;
    fire('homerun', 'Home Run', { type: 'homerun' });
    showToast('Home Run', HR_COLOR);
    resetCount();
  };

  const recordWalk = () => {
    if (!isRecording) return;
    fire('walk', 'Walk', { type: 'walk' });
    showToast('Walk', WALK_COLOR);
    resetCount();
  };

  const recordStrikeout = (kind: 'swinging' | 'looking') => {
    if (!isRecording) return;
    setOuts(prev => {
      const next = Math.min(prev + 1, 3);
      fire('strikeout', 'Strikeout', { kind, outsAfter: next });
      showToast(kind === 'swinging' ? 'K Swinging' : 'K Looking', K_COLOR);
      return next;
    });
    resetCount();
  };

  // ---- UI COMPONENTS ----

  const Circle = ({ label, bg, onPress }: any) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => isRecording && onPress()}
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
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const PopupFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: CHOOSER_TOP,
        left: EDGE_L,
        right: EDGE_R,
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <View
        style={{
          maxWidth: screenW - (EDGE_L + EDGE_R),
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderWidth: 1,
          borderColor: FRAME_COLOR,
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        {children}
      </View>
    </View>
  );

  // popups (unchanged — omitted for brevity, they are the same in your file)

  // ---- Count bar ----

  const CountBar = () => (
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
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.65)',
          borderWidth: 1,
          borderColor: FRAME_COLOR,
        }}
      >
        <Text style={{ fontSize: 14 }}>
          <Text style={{ color: 'white', fontWeight: '800' }}>Balls: </Text>
          <Text style={{ color: BALL_COLOR, fontWeight: '900' }}>{balls}</Text>
          <Text>   </Text>
          <Text style={{ color: 'white', fontWeight: '800' }}>Strikes: </Text>
          <Text style={{ color: STRIKE_COLOR, fontWeight: '900' }}>{strikes}</Text>
          <Text>   </Text>
          <Text style={{ color: 'white', fontWeight: '800' }}>Fouls: </Text>
          <Text style={{ color: FOUL_COLOR, fontWeight: '900' }}>{fouls}</Text>
        </Text>
      </View>
    </View>
  );

  const LeftStack = () => (
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
        <Circle label="Ball" bg={BALL_COLOR} onPress={onBall} />
        <Circle label="Strike" bg={STRIKE_COLOR} onPress={onStrike} />
        <Circle label="Foul" bg={FOUL_COLOR} onPress={onFoul} />
      </View>
    </View>
  );

  const RightStack = () => (
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
        <Circle label="Result" bg={HIT_COLOR} onPress={() => setResultChooserOpen(true)} />
        <Circle label="K" bg={K_COLOR} onPress={() => setStrikeoutChooserOpen(true)} />
        <Circle label="HR" bg={HR_COLOR} onPress={() => setHrConfirmOpen(true)} />
        <Circle label="Walk" bg={WALK_COLOR} onPress={recordWalk} />
      </View>
    </View>
  );

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="box-none">
      <CountBar />

      {/* Popups */}
      {resultChooserOpen && null /* keep yours here */}
      {strikeoutChooserOpen && null /* keep yours here */}
      {hrConfirmOpen && null /* keep yours here */}

      {toast && (
        <FlashToast
          text={toast.text}
          tint={toast.tint}
          top={isPortrait ? insets.top + 60 : insets.top + 40}
          center
          onDone={() => setToast(null)}
        />
      )}

      <LeftStack />
      <RightStack />
    </View>
  );
}
