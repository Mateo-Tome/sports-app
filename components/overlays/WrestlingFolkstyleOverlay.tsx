// components/overlays/WrestlingFolkstyleOverlay.tsx

import React from 'react';
import { Animated, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayProps } from './types';

/** Tiny visual confirmation toast (no haptics) */
function FlashToast({
  text, tint, top, center = true, onDone,
}: { text: string; tint: string; top: number; center?: boolean; onDone?: () => void }) {
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
    animIn.start(() => { animOut.start(({ finished }) => finished && onDone?.()); });
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

export default function WrestlingFolkstyleOverlay({
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

  // layout paddings
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  // sizing
  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);
  const TITLE_H = 28;
  const ROWS = 3;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - TITLE_H - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(36, Math.min(60, maxSize));
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  // base colors
  const BASE_GREEN = '#22c55e'; // Green
  const BASE_RED = '#ef4444';   // Red
  const GOLD = '#d4a017';

  // State 1: Which physical side is "my kid" (LOCKED TO ACTOR/LABEL)
  const [myKidSide, setMyKidSide] = React.useState<'left' | 'right'>('left');

  // State 2: Which color is assigned to "my kid" (FLIPPED by the single button)
  const [myKidColor, setMyKidColor] = React.useState<'green' | 'red'>('green');

  // NEW: period tracker (P1, P2, P3, ...)
  const [period, setPeriod] = React.useState<number>(1);

  // Actor mapping is fixed: 'left' or 'right' side determines 'home' or 'opponent'
  const leftActor  = myKidSide === 'left'  ? 'home' : 'opponent';
  const rightActor = myKidSide === 'right' ? 'home' : 'opponent';

  // Title mapping is fixed: 'left' or 'right' side determines 'My Kid' or 'Opponent'
  const leftTitle  = myKidSide === 'left'  ? 'My Kid' : 'Opponent';
  const rightTitle = myKidSide === 'right' ? 'My Kid' : 'Opponent';

  // Color mapping logic: Uses myKidColor state to determine the current visual assignment
  const HOME_COLOR = myKidColor === 'green' ? BASE_GREEN : BASE_RED;
  const OPP_COLOR  = myKidColor === 'green' ? BASE_RED : BASE_GREEN;

  // Final column colors: Maps the actor to the current visual color assignment
  const leftColor  = leftActor  === 'home' ? HOME_COLOR : OPP_COLOR;
  const rightColor = rightActor === 'home' ? HOME_COLOR : OPP_COLOR;

  const myKidCurrentColor = myKidColor.toUpperCase();

  const leftScore  = leftActor  === 'home' ? (score?.home ?? 0) : (score?.opponent ?? 0);
  const rightScore = rightActor === 'home' ? (score?.home ?? 0) : (score?.opponent ?? 0);

  // choosers and state
  const [nfFor, setNfFor] = React.useState<null | 'left' | 'right'>(null);
  const [scFor, setScFor] = React.useState<null | 'left' | 'right'>(null);
  const [stallCount, setStallCount] = React.useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [cautionCount, setCautionCount] = React.useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [pinFor, setPinFor] = React.useState<null | 'left' | 'right'>(null);
  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);

  const showToast = (text: string, tint: string) => setToast({ text, tint });
  const CHOOSER_TOP = isPortrait ? 140 : 6;

  // FIX: Update fire function to always include myKidColor in event metadata
  const fire = (
    actor: 'home' | 'opponent' | 'neutral',
    key: string,
    label: string,
    value?: number,
    meta?: Record<string, any>
  ) => {
    if (!isRecording) return;

    // Add the current color assignment to the event metadata
    const finalMeta = {
      ...(meta || {}), // Preserve existing metadata
      myKidColor: myKidColor, // 'green' or 'red'
      opponentColor: myKidColor === 'green' ? 'red' : 'green', // The opponent's color
    };

    onEvent({ key, label, actor, value, meta: finalMeta });
  };

  // NEW: period advance handler – fires an event for playback to use as a divider
  const handleNextPeriod = () => {
    if (!isRecording) return;
    const next = period + 1;
    setPeriod(next);
    fire('neutral', 'period', `P${next}`, undefined, { period: next });
    showToast(`Period ${next}`, '#ffffff');
  };

  const openNF = (side: 'left' | 'right') => { if (!isRecording) return; setNfFor(side); };
  const openSC = (side: 'left' | 'right') => { if (!isRecording) return; setScFor(side); };

  const NFChooserClose = ({ onClose }: { onClose: () => void }) => (
    <TouchableOpacity
      onPress={onClose}
      style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 6 }}
    >
      <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
    </TouchableOpacity>
  );

  const NFSeparator = () => (
    <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 }} />
  );

  const NFChooser = () => {
    if (!nfFor) return null;
    const actor = nfFor === 'left' ? leftActor : rightActor;
    const color = nfFor === 'left' ? leftColor : rightColor;
    const title = nfFor === 'left' ? leftTitle : rightTitle;

    const Chip = ({ v }: { v: 2 | 3 | 4 }) => (
      <TouchableOpacity
        onPress={() => { fire(actor as any, 'nearfall', `NF${v}`, v); setNfFor(null); showToast(`${title}: NF${v}`, color); }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 2 }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>{v}</Text>
      </TouchableOpacity>
    );

    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: CHOOSER_TOP, left: EDGE_L, right: EDGE_R, alignItems: 'center', zIndex: 50 }}>
        <View style={{ maxWidth: screenW - (EDGE_L + EDGE_R), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 }}>
          <Text style={{ color: 'white', fontWeight: '900', marginRight: 8 }}>{title}: NF points</Text>
          <NFChooserClose onClose={() => setNfFor(null)} />
          <NFSeparator />
          <Chip v={2} /><Chip v={3} /><Chip v={4} />
        </View>
      </View>
    );
  };

  const SCCooser = () => {
    if (!scFor) return null;
    const offenderSide = scFor;
    const offenderActor = offenderSide === 'left' ? leftActor : rightActor;
    const offenderTitle = offenderSide === 'left' ? leftTitle : rightTitle;
    const offenderColor = offenderSide === 'left' ? leftColor : rightColor;
    const receiverActor: 'home' | 'opponent' = offenderActor === 'home' ? 'opponent' : 'home';

    const bumpStall = (kind: 'warn' | '+1' | '+2') => {
      setStallCount(prev => {
        const current = prev[offenderSide];
        let nextBase = current;
        if (kind === 'warn') nextBase = Math.max(current, 0);
        if (kind === '+1')  nextBase = Math.max(current, 1);
        if (kind === '+2')  nextBase = Math.max(current, 3);
        return { ...prev, [offenderSide]: nextBase + 1 };
      });
    };
    const bumpCaution = (kind: 'warn' | '+1') => {
      setCautionCount(prev => {
        const current = prev[offenderSide];
        let nextBase = current;
        if (kind === 'warn') nextBase = Math.max(current, 0);
        if (kind === '+1')  nextBase = Math.max(current, 2);
        return { ...prev, [offenderSide]: nextBase + 1 };
      });
    };

    const stc = stallCount[offenderSide];
    const stNext = stc <= 0 ? 'Warn' : stc === 1 || stc === 2 ? '+1' : '+2';
    const cc = cautionCount[offenderSide];
    const cNext = cc <= 1 ? 'Warn' : '+1';

    const Tag = ({ text }: { text: string }) => (
      <View style={{ marginLeft: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Next: {text}</Text>
      </View>
    );

    const ChipBtn = ({ label, onPress, toastText }: { label: string; onPress: () => void; toastText: string }) => (
      <TouchableOpacity
        onPress={() => { onPress(); setScFor(null); showToast(`${offenderTitle}: ${toastText}`, offenderColor); }}
        style={{ height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: offenderColor, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6, marginVertical: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 2 }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>{label}</Text>
      </TouchableOpacity>
    );

    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: CHOOSER_TOP, left: EDGE_L, right: EDGE_R, alignItems: 'center', zIndex: 50 }}>
        <View style={{ maxWidth: screenW - (EDGE_L + EDGE_R), backgroundColor: 'rgba(0,0,0,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, marginRight: 8 }}>{offenderTitle}: S/C</Text>
            <NFChooserClose onClose={() => setScFor(null)} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 4 }}>
            <Text style={{ color: 'white', fontWeight: '800', marginRight: 6 }}>Caution</Text>
            <Tag text={cNext} />
            <ChipBtn label="Warn" toastText="Caution Warn" onPress={() => { bumpCaution('warn'); fire('neutral', 'caution', 'CAUTION WARN', 0, { offender: offenderActor }); }} />
            <ChipBtn label="+1" toastText="Caution +1" onPress={() => { bumpCaution('+1');  fire(receiverActor, 'caution', 'CAUTION +1', 1, { offender: offenderActor }); }} />
          </View>

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 6 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 4 }}>
            <Text style={{ color: 'white', fontWeight: '800', marginRight: 6 }}>Stalling</Text>
            <Tag text={stNext} />
            <ChipBtn label="Warn" toastText="Stall Warn" onPress={() => { bumpStall('warn'); fire('neutral', 'stalling', 'ST WARN', 0, { offender: offenderActor }); }} />
            <ChipBtn label="+1" toastText="Stall +1" onPress={() => { bumpStall('+1');  fire(receiverActor, 'stalling', 'ST +1', 1, { offender: offenderActor }); }} />
            <ChipBtn label="+2" toastText="Stall +2" onPress={() => { bumpStall('+2');  fire(receiverActor, 'stalling', 'ST +2', 2, { offender: offenderActor, note: 'Stoppage/choice' }); }} />
          </View>
        </View>
      </View>
    );
  };

  const PinConfirm = () => {
    if (!pinFor) return null;
    const actor = pinFor === 'left' ? leftActor : rightActor;
    const title = pinFor === 'left' ? leftTitle : rightTitle;
    const color = pinFor === 'left' ? leftColor : rightColor;

    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: CHOOSER_TOP, left: EDGE_L, right: EDGE_R, alignItems: 'center', zIndex: 50 }}>
        <View style={{ maxWidth: screenW - (EDGE_L + EDGE_R), backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text style={{ color: 'white', fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>Confirm PIN for {title}?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => setPinFor(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { fire(actor as any, 'pin', 'PIN', 0, { winBy: 'pin', myKidSide }); setPinFor(null); showToast(`${title}: PIN`, GOLD); }}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: GOLD }}>
              <Text style={{ color: '#111', fontWeight: '900' }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const Circle = ({
    label, actor, keyName, value, bg, onPressOverride,
  }: { label: string; actor: 'home' | 'opponent' | 'neutral'; keyName: string; value?: number; bg: string; onPressOverride?: () => void; }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => {
        if (!isRecording) return;
        if (onPressOverride) onPressOverride();
        else {
          fire(actor, keyName, label, value);
          if (actor === 'home') showToast(`My Kid: ${label}`, bg);
          else if (actor === 'opponent') showToast(`Opponent: ${label}`, bg);
          else showToast(label, bg);
        }
      }}
      style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: isRecording ? 1 : 0.55, shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 2 }}
    >
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const ScorePill = ({ value, border, extraStyle }: { value: number; border: string; extraStyle?: ViewStyle }) => (
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
    <View pointerEvents="box-none" style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, alignItems: 'flex-start', width: COL_W }}>
      <Text style={{ color: 'white', fontWeight: '800', marginBottom: 8, backgroundColor: leftColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }}>
        {leftTitle}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP }}>
        <Circle label="T3" actor={leftActor as any} keyName="takedown" value={3} bg={leftColor} />
        <Circle label="E1" actor={leftActor as any} keyName="escape" value={1} bg={leftColor} />
        <Circle label="R2" actor={leftActor as any} keyName="reversal" value={2} bg={leftColor} />
        <Circle label="NF" actor={leftActor as any} keyName="nearfall" bg={leftColor} onPressOverride={() => setNfFor('left')} />
        <Circle label="S/C" actor={'neutral'} keyName="sc" bg={leftColor} onPressOverride={() => openSC('left')} />
        <Circle label="PIN" actor={'neutral'} keyName="pin" bg={leftColor} onPressOverride={() => setPinFor('left')} />
      </View>
      <View style={{ flex: 1 }} />
      <ScorePill value={leftScore} border={leftColor} />
    </View>
  );

  const RightGrid = () => (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, alignItems: 'flex-start', width: COL_W }}>
      <Text style={{ color: 'white', fontWeight: '800', marginBottom: 8, backgroundColor: rightColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }}>
        {rightTitle}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP, justifyContent: 'flex-end' }}>
        <Circle label="T3" actor={rightActor as any} keyName="takedown" value={3} bg={rightColor} />
        <Circle label="E1" actor={rightActor as any} keyName="escape" value={1} bg={rightColor} />
        <Circle label="R2" actor={rightActor as any} keyName="reversal" value={2} bg={rightColor} />
        <Circle label="NF" actor={rightActor as any} keyName="nearfall" bg={rightColor} onPressOverride={() => setNfFor('right')} />
        <Circle label="S/C" actor={'neutral'} keyName="sc" bg={rightColor} onPressOverride={() => openSC('right')} />
        <Circle label="PIN" actor={'neutral'} keyName="pin" bg={rightColor} onPressOverride={() => setPinFor('right')} />
      </View>
      <View style={{ flex: 1 }} />
      {/* pill stays on left of the RIGHT column; also nudged 10px further left */}
      <ScorePill value={rightScore} border={rightColor} extraStyle={{
        alignSelf: 'flex-end', // move to the right edge of the right column
        marginLeft: 0,         // override the default -10 left nudge inside ScorePill
        marginRight: -5,       // push it further right; tweak -20..-60 as you like
      }}/>
    </View>
  );

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}>
      {/* Flip colors control (Original 'Flip Sides' location) */}
      <View style={{ position: 'absolute', top: -36, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <TouchableOpacity
          // Flips the color state ('green' <-> 'red')
          onPress={() => setMyKidColor(c => (c === 'green' ? 'red' : 'green'))}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          {/* Text is "Flip Colors" */}
          <Text style={{ color: 'white', fontWeight: '700' }}>Flip Colors (My Kid: {myKidCurrentColor})</Text>
        </TouchableOpacity>
      </View>

      {/* NEW: Period tracker button (top-right, small & out of the way) */}
      <View
        style={{
          position: 'absolute',
          top: -36,
          right: EDGE_R,
          alignItems: 'flex-end',
        }}
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
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>
            P{period}
          </Text>
        </TouchableOpacity>
      </View>

      <NFChooser />
      <SCCooser />
      <PinConfirm />

      {toast ? <FlashToast text={toast.text} tint={toast.tint} top={isPortrait ? 80 : 40} center onDone={() => setToast(null)} /> : null}

      <LeftGrid />
      <RightGrid />
    </View>
  );
}
