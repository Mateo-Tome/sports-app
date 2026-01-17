// components/modules/baseball/baseballUiParts.tsx
import React from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import {
    BALL_COLOR,
    FOUL_COLOR, // ✅ FIX
    FRAME_COLOR,
    HIT_COLOR,
    HR_COLOR,
    K_COLOR,
    OUT_COLOR,
    STRIKE_COLOR,
    WALK_COLOR,
} from './useBaseballHittingLogic';

/** Tiny visual confirmation toast (no haptics) */
export function FlashToast({
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

export function Circle({
  label,
  bg,
  onPress,
  BTN_SIZE,
}: {
  label: string;
  bg: string;
  onPress: () => void;
  BTN_SIZE: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: BTN_SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
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
}

export const PopupFrame: React.FC<{
  children: React.ReactNode;
  CHOOSER_TOP: number;
  EDGE_L: number;
  EDGE_R: number;
  screenW: number;
}> = ({ children, CHOOSER_TOP, EDGE_L, EDGE_R, screenW }) => (
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

export function HitOutChooser(props: {
  showPalette: boolean;
  open: boolean;
  onClose: () => void;
  onHit: (type: 'single' | 'double' | 'triple' | 'bunt') => void;
  onOut: (label: string) => void;
  CHOOSER_TOP: number;
  EDGE_L: number;
  EDGE_R: number;
  screenW: number;
}) {
  if (!props.showPalette || !props.open) return null;

  const HitChip = ({ label, type }: { label: string; type: 'single' | 'double' | 'triple' | 'bunt' }) => (
    <TouchableOpacity
      onPress={() => props.onHit(type)}
      style={{
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: HIT_COLOR,
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

  const OutChip = ({ label }: { label: string }) => (
    <TouchableOpacity
      onPress={() => props.onOut(label)}
      style={{
        height: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: OUT_COLOR,
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

  return (
    <PopupFrame CHOOSER_TOP={props.CHOOSER_TOP} EDGE_L={props.EDGE_L} EDGE_R={props.EDGE_R} screenW={props.screenW}>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginBottom: 6, textAlign: 'center' }}>
          Select Result
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginTop: 4, marginBottom: 2 }}>
          Hits
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <HitChip label="Single" type="single" />
          <HitChip label="Double" type="double" />
          <HitChip label="Triple" type="triple" />
          <HitChip label="Bunt" type="bunt" />
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginTop: 8, marginBottom: 2 }}>
          Outs
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <OutChip label="Ground Out" />
          <OutChip label="Flyout" />
          <OutChip label="Fielder&apos;s Choice" />
        </View>

        <TouchableOpacity
          onPress={props.onClose}
          style={{
            marginTop: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </PopupFrame>
  );
}

export function StrikeoutChooser(props: {
  showPalette: boolean;
  open: boolean;
  onClose: () => void;
  onPick: (kind: 'swinging' | 'looking') => void;
  CHOOSER_TOP: number;
  EDGE_L: number;
  EDGE_R: number;
  screenW: number;
}) {
  if (!props.showPalette || !props.open) return null;

  const KChip = ({ label, kind }: { label: string; kind: 'swinging' | 'looking' }) => (
    <TouchableOpacity
      onPress={() => props.onPick(kind)}
      style={{
        height: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: K_COLOR,
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

  return (
    <PopupFrame CHOOSER_TOP={props.CHOOSER_TOP} EDGE_L={props.EDGE_L} EDGE_R={props.EDGE_R} screenW={props.screenW}>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginBottom: 6, textAlign: 'center' }}>
          Strikeout Type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <KChip label="K Swinging" kind="swinging" />
          <KChip label="K Looking" kind="looking" />
        </View>
        <TouchableOpacity
          onPress={props.onClose}
          style={{
            marginTop: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </PopupFrame>
  );
}

export function HomerunConfirm(props: {
  showPalette: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  CHOOSER_TOP: number;
  EDGE_L: number;
  EDGE_R: number;
  screenW: number;
}) {
  if (!props.showPalette || !props.open) return null;

  return (
    <PopupFrame CHOOSER_TOP={props.CHOOSER_TOP} EDGE_L={props.EDGE_L} EDGE_R={props.EDGE_R} screenW={props.screenW}>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginBottom: 10, textAlign: 'center' }}>
          Confirm Home Run?
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={props.onCancel}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: FRAME_COLOR,
              marginRight: 8,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={props.onConfirm}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: HR_COLOR,
            }}
          >
            <Text style={{ color: '#111', fontWeight: '900' }}>Confirm HR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </PopupFrame>
  );
}

export function CountBar(props: { insetsTop: number; balls: number; strikes: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: props.insetsTop + 8, left: 0, right: 0, alignItems: 'center' }}>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: FRAME_COLOR }}>
        <Text style={{ fontSize: 11 }}>
          <Text style={{ color: BALL_COLOR, fontWeight: '800' }}>Balls: </Text>
          <Text style={{ color: 'white', fontWeight: '900' }}>{props.balls}</Text>
          <Text style={{ color: 'white' }}>   </Text>
          <Text style={{ color: STRIKE_COLOR, fontWeight: '800' }}>Strikes: </Text>
          <Text style={{ color: 'white', fontWeight: '900' }}>{props.strikes}</Text>
        </Text>
      </View>
    </View>
  );
}

export function LeftStack(props: {
  showPalette: boolean;
  EDGE_L: number;
  TOP: number;
  BOTTOM: number;
  GAP: number;
  BTN_SIZE: number;
  onBall: () => void;
  onStrike: () => void;
  onFoul: () => void;
}) {
  if (!props.showPalette) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: props.EDGE_L, top: props.TOP, bottom: props.BOTTOM, justifyContent: 'center' }}>
      <View style={{ gap: props.GAP }}>
        <Circle label="Ball" bg={BALL_COLOR} onPress={props.onBall} BTN_SIZE={props.BTN_SIZE} />
        <Circle label="Strike" bg={STRIKE_COLOR} onPress={props.onStrike} BTN_SIZE={props.BTN_SIZE} />
        <Circle label="Foul" bg={FOUL_COLOR} onPress={props.onFoul} BTN_SIZE={props.BTN_SIZE} />
      </View>
    </View>
  );
}

export function RightStack(props: {
  showPalette: boolean;
  EDGE_R: number;
  TOP: number;
  BOTTOM: number;
  GAP: number;
  BTN_SIZE: number;
  onOpenResult: () => void;
  onOpenK: () => void;
  onOpenHR: () => void;
  onWalk: () => void;
}) {
  if (!props.showPalette) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: props.EDGE_R, top: props.TOP, bottom: props.BOTTOM, justifyContent: 'center', alignItems: 'flex-end' }}>
      <View style={{ gap: props.GAP }}>
        <Circle label="Result" bg={HIT_COLOR} onPress={props.onOpenResult} BTN_SIZE={props.BTN_SIZE} />
        <Circle label="K" bg={K_COLOR} onPress={props.onOpenK} BTN_SIZE={props.BTN_SIZE} />
        <Circle label="HR" bg={HR_COLOR} onPress={props.onOpenHR} BTN_SIZE={props.BTN_SIZE} />
        <Circle label="Walk" bg={WALK_COLOR} onPress={props.onWalk} BTN_SIZE={props.BTN_SIZE} />
      </View>
    </View>
  );
}
