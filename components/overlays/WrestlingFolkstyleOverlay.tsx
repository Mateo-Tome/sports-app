// app/components/overlays/WrestlingFolkstyleOverlay.tsx
import React from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayProps } from './types';

export default function WrestlingFolkstyleOverlay({
  isRecording,
  onEvent,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isLandscape = dims.width > dims.height;

  // ---- Layout paddings (keeps clear of Back + Start/Stop) ----
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  // ---- Available vertical space for each side's column ----
  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);

  // We want a 2x3 grid per side (6 buttons). Title takes ~28px.
  const TITLE_H = 28;
  const ROWS = 3;
  const GAP = 10;

  // Compute a circle size that guarantees all rows fit with no scroll:
  // availableHeight >= TITLE_H + ROWS*SIZE + (ROWS-1)*GAP
  const maxSize = Math.floor(
    (availableHeight - TITLE_H - (ROWS - 1) * GAP)
      / ROWS
  );

  // Clamp to a reasonable range (will shrink in landscape if needed)
  const SIZE = Math.max(36, Math.min(60, maxSize));

  // 2 columns per side → fixed column width so right side can anchor to the edge
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  // Colors (green = "my kid", red = opponent)
  const GREEN = '#22c55e';
  const RED = '#ef4444';

  // Flip which side is "my kid"
  const [myKidSide, setMyKidSide] = React.useState<'left' | 'right'>('left');

  const leftActor  = myKidSide === 'left'  ? 'home' : 'opponent';
  const rightActor = myKidSide === 'right' ? 'home' : 'opponent';
  const leftColor  = myKidSide === 'left'  ? GREEN : RED;
  const rightColor = myKidSide === 'right' ? GREEN : RED;
  const leftTitle  = myKidSide === 'left'  ? 'My Kid' : 'Opponent';
  const rightTitle = myKidSide === 'right' ? 'My Kid' : 'Opponent';

  const Circle = ({
    label,
    actor,
    keyName,
    value,
    bg,
  }: {
    label: string;
    actor: 'home' | 'opponent' | 'neutral';
    keyName: string;
    value?: number;
    bg: string;
  }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => onEvent({ key: keyName, label, actor, value })}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        // grid gaps are handled by the parent "gap"
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
      {/* Title pill */}
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

      {/* 2x3 grid: gap handles both row & column space; no ScrollView = always visible */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: COL_W,
          gap: GAP,
        }}
      >
        {/* Folkstyle: TAKEDOWN is 3 points now (T3) */}
        <Circle label="T3"  actor={leftActor as any}  keyName="takedown3" value={3} bg={leftColor} />
        <Circle label="E1"  actor={leftActor as any}  keyName="escape1"   value={1} bg={leftColor} />
        <Circle label="R2"  actor={leftActor as any}  keyName="reversal2" value={2} bg={leftColor} />
        <Circle label="NF2" actor={leftActor as any}  keyName="nearfall2" value={2} bg={leftColor} />
        <Circle label="NF3" actor={leftActor as any}  keyName="nearfall3" value={3} bg={leftColor} />
        <Circle label="ST"  actor={leftActor as any}  keyName="stalling"         bg={leftColor} />
      </View>
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
        alignItems: 'flex-end',
        width: COL_W,
      }}
    >
      {/* Title pill */}
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

      {/* mirrored 2x3 grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: COL_W,
          gap: GAP,
          justifyContent: 'flex-end',
        }}
      >
        <Circle label="T3"  actor={rightActor as any} keyName="takedown3" value={3} bg={rightColor} />
        <Circle label="E1"  actor={rightActor as any} keyName="escape1"   value={1} bg={rightColor} />
        <Circle label="R2"  actor={rightActor as any} keyName="reversal2" value={2} bg={rightColor} />
        <Circle label="NF2" actor={rightActor as any} keyName="nearfall2" value={2} bg={rightColor} />
        <Circle label="NF3" actor={rightActor as any} keyName="nearfall3" value={3} bg={rightColor} />
        <Circle label="ST"  actor={rightActor as any} keyName="stalling"        bg={rightColor} />
      </View>
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}
    >
      {/* Flip sides control (centered above columns) */}
      <View
        style={{
          position: 'absolute',
          top: -36,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => setMyKidSide((s) => (s === 'left' ? 'right' : 'left'))}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            Flip Sides (My Kid: {myKidSide.toUpperCase()})
          </Text>
        </TouchableOpacity>
      </View>

      <LeftGrid />
      <RightGrid />
    </View>
  );
}







