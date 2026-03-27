// components/overlays/bjj/BJJOverlay.tsx

import React from 'react';
import {
  Animated,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayCompactText } from '../OverlayCompactText';
import { OverlayTitleText } from '../OverlayTitleText';
import type { OverlayProps } from '../types';

function FlashToast({
  text,
  tint,
  top,
  onDone,
}: {
  text: string;
  tint: string;
  top: number;
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
      Animated.timing(opacity, { toValue: 0, duration: 150, delay: 750, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -6, duration: 150, delay: 750, useNativeDriver: true }),
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
        alignSelf: 'center',
        opacity,
        transform: [{ translateY }],
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: tint,
        zIndex: 100,
        maxWidth: '88%',
      }}
    >
      <OverlayCompactText style={{ color: 'white', fontWeight: '900' }}>
        {text}
      </OverlayCompactText>
    </Animated.View>
  );
}

function cleanName(v?: string) {
  const s = String(v ?? '').trim();
  return s.length ? s : 'Unassigned';
}

export default function BJJOverlay({
  isRecording,
  onEvent,
  style,
  score,
  athleteName,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;
  const isPortrait = screenH >= screenW;

  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);
  const ROWS = 4;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(34, Math.min(58, maxSize));
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  const BASE_GREEN = '#22c55e';
  const BASE_RED = '#ef4444';
  const GOLD = '#d4a017';

  const [myKidSide, setMyKidSide] = React.useState<'left' | 'right'>('left');
  const [myKidColor, setMyKidColor] = React.useState<'green' | 'red'>('green');

  const recordedName = cleanName(athleteName);

  const leftActor = myKidSide === 'left' ? 'home' : 'opponent';
  const rightActor = myKidSide === 'right' ? 'home' : 'opponent';

  const HOME_COLOR = myKidColor === 'green' ? BASE_GREEN : BASE_RED;
  const OPP_COLOR = myKidColor === 'green' ? BASE_RED : BASE_GREEN;

  const leftColor = leftActor === 'home' ? HOME_COLOR : OPP_COLOR;
  const rightColor = rightActor === 'home' ? HOME_COLOR : OPP_COLOR;

  const leftScore = leftActor === 'home' ? (score?.home ?? 0) : (score?.opponent ?? 0);
  const rightScore = rightActor === 'home' ? (score?.home ?? 0) : (score?.opponent ?? 0);

  const leftTitle = myKidSide === 'left' ? recordedName : 'Opponent';
  const rightTitle = myKidSide === 'right' ? recordedName : 'Opponent';

  const pillMaxWidth = Math.max(
    COL_W + 28,
    Math.min(Math.floor(screenW * (isPortrait ? 0.44 : 0.42)), 320),
  );

  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);
  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const fire = (
    actor: 'home' | 'opponent' | 'neutral',
    key: string,
    label: string,
    value?: number,
    meta?: Record<string, any>,
  ) => {
    if (!isRecording) return;

    const finalMeta = {
      ...(meta || {}),
      style: String(style ?? 'gi'),
      myKidColor,
      opponentColor: myKidColor === 'green' ? 'red' : 'green',
      myKidSide,
      athleteName: recordedName,
    };

    onEvent({ key, label, actor, value, meta: finalMeta });
  };

  const Circle = ({
    shortLabel,
    fullLabel,
    actor,
    keyName,
    value,
    bg,
    meta,
  }: {
    shortLabel: string;
    fullLabel: string;
    actor: 'home' | 'opponent' | 'neutral';
    keyName: string;
    value?: number;
    bg: string;
    meta?: Record<string, any>;
  }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => {
        if (!isRecording) return;

        fire(actor, keyName, fullLabel, value, meta);

        const who =
          actor === 'home'
            ? recordedName
            : actor === 'opponent'
            ? 'Opponent'
            : '';

        const suffix = typeof value === 'number' && value > 0 ? ` (+${value})` : '';
        const toastText = who ? `${who}: ${fullLabel}${suffix}` : `${fullLabel}${suffix}`;

        showToast(toastText, bg);
      }}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isRecording ? 1 : 0.55,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
        paddingHorizontal: 4,
      }}
    >
      <OverlayCompactText style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>
        {shortLabel}
      </OverlayCompactText>
    </TouchableOpacity>
  );

  const ScorePill = ({
    title,
    value,
    border,
    extraStyle,
  }: {
    title: string;
    value: number;
    border: string;
    extraStyle?: ViewStyle;
  }) => (
    <View
      style={[
        {
          marginTop: 10,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderWidth: 1,
          borderColor: border,
          maxWidth: pillMaxWidth,
          minWidth: Math.min(170, pillMaxWidth),
          minHeight: 38,
          justifyContent: 'center',
        },
        extraStyle,
      ]}
    >
      <OverlayTitleText style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>
        {cleanName(title)}: {value}
      </OverlayTitleText>
    </View>
  );

  const LeftGrid = () => (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, width: COL_W }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP }}>
        <Circle shortLabel="TD2" fullLabel="Takedown" actor={leftActor} keyName="takedown" value={2} bg={leftColor} meta={{ points: 2 }} />
        <Circle shortLabel="SW2" fullLabel="Sweep" actor={leftActor} keyName="sweep" value={2} bg={leftColor} meta={{ points: 2 }} />
        <Circle shortLabel="KOB2" fullLabel="Knee on Belly" actor={leftActor} keyName="knee_on_belly" value={2} bg={leftColor} meta={{ points: 2 }} />
        <Circle shortLabel="P3" fullLabel="Guard Pass" actor={leftActor} keyName="guard_pass" value={3} bg={leftColor} meta={{ points: 3 }} />
        <Circle shortLabel="M4" fullLabel="Mount" actor={leftActor} keyName="mount" value={4} bg={leftColor} meta={{ points: 4 }} />
        <Circle shortLabel="B4" fullLabel="Back Control" actor={leftActor} keyName="back_control" value={4} bg={leftColor} meta={{ points: 4 }} />
        <Circle shortLabel="ADV" fullLabel="Advantage" actor={leftActor} keyName="advantage" value={1} bg={leftColor} meta={{ kind: 'adv' }} />
        <Circle shortLabel="PEN" fullLabel="Penalty" actor="neutral" keyName="penalty" value={1} bg={leftColor} meta={{ offender: leftActor }} />
      </View>

      <View style={{ flex: 1 }} />
      <ScorePill title={leftTitle} value={leftScore} border={leftColor} />
    </View>
  );

  const RightGrid = () => (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, width: COL_W }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: COL_W,
          gap: GAP,
          justifyContent: 'flex-end',
        }}
      >
        <Circle shortLabel="TD2" fullLabel="Takedown" actor={rightActor} keyName="takedown" value={2} bg={rightColor} meta={{ points: 2 }} />
        <Circle shortLabel="SW2" fullLabel="Sweep" actor={rightActor} keyName="sweep" value={2} bg={rightColor} meta={{ points: 2 }} />
        <Circle shortLabel="KOB2" fullLabel="Knee on Belly" actor={rightActor} keyName="knee_on_belly" value={2} bg={rightColor} meta={{ points: 2 }} />
        <Circle shortLabel="P3" fullLabel="Guard Pass" actor={rightActor} keyName="guard_pass" value={3} bg={rightColor} meta={{ points: 3 }} />
        <Circle shortLabel="M4" fullLabel="Mount" actor={rightActor} keyName="mount" value={4} bg={rightColor} meta={{ points: 4 }} />
        <Circle shortLabel="B4" fullLabel="Back Control" actor={rightActor} keyName="back_control" value={4} bg={rightColor} meta={{ points: 4 }} />
        <Circle shortLabel="ADV" fullLabel="Advantage" actor={rightActor} keyName="advantage" value={1} bg={rightColor} meta={{ kind: 'adv' }} />
        <Circle shortLabel="PEN" fullLabel="Penalty" actor="neutral" keyName="penalty" value={1} bg={rightColor} meta={{ offender: rightActor }} />
      </View>

      <View style={{ flex: 1 }} />
      <ScorePill
        title={rightTitle}
        value={rightScore}
        border={rightColor}
        extraStyle={{ alignSelf: 'flex-end' }}
      />
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}
    >
      {/* Controls row */}
      <View style={{ position: 'absolute', top: -36, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => setMyKidColor((c) => (c === 'green' ? 'red' : 'green'))}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              maxWidth: 220,
              minHeight: 34,
              justifyContent: 'center',
            }}
          >
            <OverlayCompactText style={{ color: 'white', fontWeight: '700' }}>
              Flip Colors (Style: {String(style ?? 'gi').toUpperCase()})
            </OverlayCompactText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMyKidSide((s) => (s === 'left' ? 'right' : 'left'))}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              minHeight: 34,
              justifyContent: 'center',
            }}
          >
            <OverlayCompactText style={{ color: 'white', fontWeight: '700' }}>
              Flip Sides
            </OverlayCompactText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Finish marker */}
      <View style={{ position: 'absolute', top: -36, right: EDGE_R }} pointerEvents="box-none">
        <TouchableOpacity
          disabled={!isRecording}
          onPress={() => {
            fire('neutral', 'finish', 'Submission', 0, { winBy: 'submission' });
            showToast(`${recordedName}: Submission`, GOLD);
          }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: GOLD,
            opacity: isRecording ? 1 : 0.6,
            minHeight: 34,
            justifyContent: 'center',
          }}
        >
          <OverlayCompactText style={{ color: '#111', fontWeight: '900', fontSize: 12 }}>
            SUB
          </OverlayCompactText>
        </TouchableOpacity>
      </View>

      {toast ? (
        <FlashToast
          text={toast.text}
          tint={toast.tint}
          top={isPortrait ? 80 : 40}
          onDone={() => setToast(null)}
        />
      ) : null}

      <LeftGrid />
      <RightGrid />
    </View>
  );
}