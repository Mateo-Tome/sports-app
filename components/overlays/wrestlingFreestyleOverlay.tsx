// components/overlays/WrestlingFreestyleOverlay.tsx

import React from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayProps } from './types';

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
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
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

export default function WrestlingFreestyleOverlay({
  isRecording,
  onEvent,
  getCurrentTSec: _getCurrentTSec,
  sport: _sport,
  style: _style,
  score,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;
  const isPortrait = screenH >= screenW;

  // layout paddings (match folkstyle)
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  // sizing (match folkstyle)
  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);
  const TITLE_H = 28;
  const ROWS = 3;
  const GAP = 10;
  const maxSize = Math.floor(
    (availableHeight - TITLE_H - (ROWS - 1) * GAP) / ROWS,
  );
  const SIZE = Math.max(36, Math.min(60, maxSize));
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  // base colors (RED/BLUE for freestyle)
  const BASE_RED = '#ef4444';
  const BASE_BLUE = '#3b82f6';

  // keep the same “my kid is left” behavior as folkstyle
  const [myKidSide] = React.useState<'left' | 'right'>('left');

  // flip colors control (red <-> blue)
  const [myKidColor, setMyKidColor] = React.useState<'red' | 'blue'>('red');

  // period tracker
  const [period, setPeriod] = React.useState<number>(1);

  // fixed actor mapping
  const leftActor = myKidSide === 'left' ? 'home' : 'opponent';
  const rightActor = myKidSide === 'right' ? 'home' : 'opponent';

  const leftTitle = myKidSide === 'left' ? 'My Kid' : 'Opponent';
  const rightTitle = myKidSide === 'right' ? 'My Kid' : 'Opponent';

  const HOME_COLOR = myKidColor === 'red' ? BASE_RED : BASE_BLUE;
  const OPP_COLOR = myKidColor === 'red' ? BASE_BLUE : BASE_RED;

  const leftColor = leftActor === 'home' ? HOME_COLOR : OPP_COLOR;
  const rightColor = rightActor === 'home' ? HOME_COLOR : OPP_COLOR;

  const leftScore =
    leftActor === 'home' ? score?.home ?? 0 : score?.opponent ?? 0;
  const rightScore =
    rightActor === 'home' ? score?.home ?? 0 : score?.opponent ?? 0;

  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(
    null,
  );
  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const myKidCurrentColor = myKidColor.toUpperCase();

  // Chooser states (NF-style) - keep only ones that have multiple choices
  const [bigFor, setBigFor] = React.useState<null | 'left' | 'right'>(null);
  const [passFor, setPassFor] = React.useState<null | 'left' | 'right'>(null);
  const [penFor, setPenFor] = React.useState<null | 'left' | 'right'>(null);

  const CHOOSER_TOP = isPortrait ? 140 : 6;

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
      myKidColor,
      opponentColor: myKidColor === 'red' ? 'blue' : 'red',
    };

    onEvent({ key, label, actor, value, meta: finalMeta });
  };

  const handleNextPeriod = () => {
    if (!isRecording) return;
    const next = period + 1;
    setPeriod(next);
    fire('neutral', 'period', `P${next}`, undefined, { period: next });
    showToast(`Period ${next}`, '#ffffff');
  };

  // helpers to map side → actor/title/color
  const sideInfo = (side: 'left' | 'right') => {
    const actor = side === 'left' ? leftActor : rightActor;
    const color = side === 'left' ? leftColor : rightColor;
    const title = side === 'left' ? leftTitle : rightTitle;
    return { actor, color, title };
  };

  const receiverOf = (offender: 'home' | 'opponent'): 'home' | 'opponent' =>
    offender === 'home' ? 'opponent' : 'home';

  // shared UI bits
  const ChooserClose = ({ onClose }: { onClose: () => void }) => (
    <TouchableOpacity
      onPress={onClose}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginRight: 6,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
    </TouchableOpacity>
  );

  const Chip = ({
    label,
    tint,
    onPress,
  }: {
    label: string;
    tint: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 6,
        marginVertical: 4,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900' }}>{label}</Text>
    </TouchableOpacity>
  );

  // --- Choosers ------------------------------------------------

  const BigChooser = () => {
    if (!bigFor) return null;
    const { actor, color, title } = sideInfo(bigFor);

    return (
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
            backgroundColor: 'rgba(0,0,0,0.70)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            borderRadius: 16,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: '900',
                fontSize: 14,
                marginRight: 8,
              }}
            >
              {title}: Big Points
            </Text>
            <ChooserClose onClose={() => setBigFor(null)} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Chip
              label="FTD4"
              tint={color}
              onPress={() => {
                fire(actor as any, 'feet_to_danger', 'FTD4', 4, { kind: 'FTD' });
                showToast(`${title}: FTD4`, color);
                setBigFor(null);
              }}
            />
            <Chip
              label="GA4"
              tint={color}
              onPress={() => {
                fire(actor as any, 'grand_amplitude', 'GA4', 4, {
                  kind: 'GA',
                  danger: false,
                });
                showToast(`${title}: GA4`, color);
                setBigFor(null);
              }}
            />
            <Chip
              label="GA5"
              tint={color}
              onPress={() => {
                fire(actor as any, 'grand_amplitude', 'GA5', 5, {
                  kind: 'GA',
                  danger: true,
                });
                showToast(`${title}: GA5`, color);
                setBigFor(null);
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  const PassivityChooser = () => {
    if (!passFor) return null;
    const {
      actor: offenderActor,
      color: offenderColor,
      title: offenderTitle,
    } = sideInfo(passFor);
    const receiver = receiverOf(offenderActor as any);

    return (
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
            backgroundColor: 'rgba(0,0,0,0.70)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            borderRadius: 16,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: '900',
                fontSize: 14,
                marginRight: 8,
              }}
            >
              {offenderTitle}: Passivity
            </Text>
            <ChooserClose onClose={() => setPassFor(null)} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Chip
              label="WARN"
              tint={offenderColor}
              onPress={() => {
                fire('neutral', 'passivity', 'PASS WARN', 0, {
                  offender: offenderActor,
                });
                showToast(`${offenderTitle}: PASS WARN`, offenderColor);
                setPassFor(null);
              }}
            />
            <Chip
              label="+1"
              tint={offenderColor}
              onPress={() => {
                fire(receiver, 'passivity', 'PASS +1', 1, {
                  offender: offenderActor,
                });
                showToast(`${offenderTitle}: PASS (+1 opp)`, offenderColor);
                setPassFor(null);
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  const PenaltyChooser = () => {
    if (!penFor) return null;
    const {
      actor: offenderActor,
      color: offenderColor,
      title: offenderTitle,
    } = sideInfo(penFor);
    const receiver = receiverOf(offenderActor as any);

    return (
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
            backgroundColor: 'rgba(0,0,0,0.70)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            borderRadius: 16,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: '900',
                fontSize: 14,
                marginRight: 8,
              }}
            >
              {offenderTitle}: Penalty
            </Text>
            <ChooserClose onClose={() => setPenFor(null)} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Chip
              label="P +1"
              tint={offenderColor}
              onPress={() => {
                fire(receiver, 'penalty', 'P +1', 1, { offender: offenderActor });
                showToast(`${offenderTitle}: P (+1 opp)`, offenderColor);
                setPenFor(null);
              }}
            />
            <Chip
              label="FLEE +1"
              tint={offenderColor}
              onPress={() => {
                fire(receiver, 'flee', 'FLEE +1', 1, {
                  offender: offenderActor,
                  where: 'mat',
                });
                showToast(`${offenderTitle}: FLEE (+1 opp)`, offenderColor);
                setPenFor(null);
              }}
            />
            <Chip
              label="FLEE +2"
              tint={offenderColor}
              onPress={() => {
                fire(receiver, 'flee', 'FLEE +2', 2, {
                  offender: offenderActor,
                  where: 'danger',
                });
                showToast(`${offenderTitle}: FLEE (+2 opp)`, offenderColor);
                setPenFor(null);
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  // --- Circles & grids ----------------------------------------

  const Circle = ({
    label,
    actor,
    keyName,
    value,
    bg,
    onPressOverride,
  }: {
    label: string;
    actor: 'home' | 'opponent' | 'neutral';
    keyName: string;
    value?: number;
    bg: string;
    onPressOverride?: () => void;
  }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => {
        if (!isRecording) return;
        if (onPressOverride) {
          onPressOverride();
          return;
        }

        fire(actor, keyName, label, value);

        if (actor === 'home') showToast(`My Kid: ${label}`, bg);
        else if (actor === 'opponent') showToast(`Opponent: ${label}`, bg);
        else showToast(label, bg);
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
      }}
    >
      <Text style={{ color: 'white', fontSize: 13, fontWeight: '800' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const ScorePill = ({
    value,
    border,
    extraStyle,
  }: {
    value: number;
    border: string;
    extraStyle?: ViewStyle;
  }) => (
    <View
      style={[
        {
          marginTop: 10,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderWidth: 1,
          borderColor: border,
        },
        extraStyle,
      ]}
    >
      <Text style={{ color: 'white', fontWeight: '900' }}>Score: {value}</Text>
    </View>
  );

  const LeftGrid = () => (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: EDGE_L,
        top: 0,
        bottom: 0,
        alignItems: 'flex-start',
        width: COL_W,
      }}
    >
      <Text
        style={{
          color: 'white',
          fontWeight: '800',
          marginBottom: 8,
          backgroundColor: leftColor,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        {leftTitle}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP }}>
        <Circle label="TD2" actor={leftActor as any} keyName="takedown" value={2} bg={leftColor} />

        {/* ✅ one-tap exposure */}
        <Circle label="EX2" actor={leftActor as any} keyName="exposure" value={2} bg={leftColor} />

        {/* ✅ one-tap out */}
        <Circle label="OB1" actor={leftActor as any} keyName="out" value={1} bg={leftColor} />

        {/* multi-choice choosers */}
        <Circle label="BIG" actor="neutral" keyName="big" bg={leftColor} onPressOverride={() => setBigFor('left')} />
        <Circle label="PASS" actor="neutral" keyName="pass" bg={leftColor} onPressOverride={() => setPassFor('left')} />
        <Circle label="PEN" actor="neutral" keyName="pen" bg={leftColor} onPressOverride={() => setPenFor('left')} />
      </View>

      <View style={{ flex: 1 }} />
      <ScorePill value={leftScore} border={leftColor} />
    </View>
  );

  const RightGrid = () => (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: EDGE_R,
        top: 0,
        bottom: 0,
        alignItems: 'flex-start',
        width: COL_W,
      }}
    >
      <Text
        style={{
          color: 'white',
          fontWeight: '800',
          marginBottom: 8,
          backgroundColor: rightColor,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        {rightTitle}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: COL_W,
          gap: GAP,
          justifyContent: 'flex-end',
        }}
      >
        <Circle label="TD2" actor={rightActor as any} keyName="takedown" value={2} bg={rightColor} />

        {/* ✅ one-tap exposure */}
        <Circle label="EX2" actor={rightActor as any} keyName="exposure" value={2} bg={rightColor} />

        {/* ✅ one-tap out */}
        <Circle label="OB1" actor={rightActor as any} keyName="out" value={1} bg={rightColor} />

        {/* multi-choice choosers */}
        <Circle label="BIG" actor="neutral" keyName="big" bg={rightColor} onPressOverride={() => setBigFor('right')} />
        <Circle label="PASS" actor="neutral" keyName="pass" bg={rightColor} onPressOverride={() => setPassFor('right')} />
        <Circle label="PEN" actor="neutral" keyName="pen" bg={rightColor} onPressOverride={() => setPenFor('right')} />
      </View>

      <View style={{ flex: 1 }} />
      <ScorePill
        value={rightScore}
        border={rightColor}
        extraStyle={{ alignSelf: 'flex-end', marginLeft: 0, marginRight: -5 }}
      />
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}
    >
      {/* Flip colors control (same placement as folkstyle) */}
      <View
        style={{ position: 'absolute', top: -36, left: 0, right: 0, alignItems: 'center' }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => setMyKidColor((c) => (c === 'red' ? 'blue' : 'red'))}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            Flip Colors (My Kid: {myKidCurrentColor})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Period button (same placement) */}
      <View
        style={{ position: 'absolute', top: -36, right: EDGE_R, alignItems: 'flex-end' }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleNextPeriod}
          disabled={!isRecording}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderWidth: 1,
            borderColor: 'white',
            opacity: isRecording ? 1 : 0.6,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>P{period}</Text>
        </TouchableOpacity>
      </View>

      <BigChooser />
      <PassivityChooser />
      <PenaltyChooser />

      {toast ? (
        <FlashToast
          text={toast.text}
          tint={toast.tint}
          top={isPortrait ? 80 : 40}
          center
          onDone={() => setToast(null)}
        />
      ) : null}

      <LeftGrid />
      <RightGrid />
    </View>
  );
}
