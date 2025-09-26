import React from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayProps } from './types';

export default function WrestlingFolkstyleOverlay({
  isRecording,
  onEvent,
  getCurrentTSec: _getCurrentTSec,
  sport: _sport,
  style: _style,
  score, // ⬅️ NEW
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW } = dims;
  

  // ---- Layout paddings (keeps clear of Back + Start/Stop) ----
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  // ---- Available vertical space for each side's column ----
  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);

  const TITLE_H = 28;
  const ROWS = 3;
  const GAP = 10;

  // Compute a circle size that guarantees all rows fit with no scroll:
  const maxSize = Math.floor((availableHeight - TITLE_H - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(36, Math.min(60, maxSize));

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

  // Live score mapped to each column
  const leftScore  = leftActor  === 'home' ? (score?.home ?? 0) : (score?.opponent ?? 0);
  const rightScore = rightActor === 'home' ? (score?.home ?? 0) : (score?.opponent ?? 0);

  // Near-fall chooser state (which side requested it)
  const [nfFor, setNfFor] = React.useState<null | 'left' | 'right'>(null);

  const fire = (
    actor: 'home' | 'opponent' | 'neutral',
    key: string,
    label: string,
    value?: number
  ) => {
    if (!isRecording) return;
    onEvent({ key, label, actor, value });
  };

  const openNF = (side: 'left' | 'right') => {
    if (!isRecording) return;
    setNfFor(side);
  };

  const NFChooserClose = ({ onClose }: { onClose: () => void }) => (
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

  const NFSeparator = () => (
    <View
      style={{
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 6,
      }}
    />
  );

  const NFChooser = () => {
    if (!nfFor) return null;
    const actor = nfFor === 'left' ? leftActor : rightActor;
    const color = nfFor === 'left' ? leftColor : rightColor;
    const title = nfFor === 'left' ? leftTitle : rightTitle;

    const Chip = ({ v }: { v: 2 | 3 | 4 }) => (
      <TouchableOpacity
        onPress={() => {
          fire(actor as any, 'nearfall', `NF${v}`, v);
          setNfFor(null);
        }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 6,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>{v}</Text>
      </TouchableOpacity>
    );

    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 6,
          left: EDGE_L,
          right: EDGE_R,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            maxWidth: screenW - (EDGE_L + EDGE_R),
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.65)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            borderRadius: 999,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800', marginRight: 8 }}>
            {title}: NF points
          </Text>
          <NFChooserClose onClose={() => setNfFor(null)} />
          <NFSeparator />
          <Chip v={2} />
          <Chip v={3} />
          <Chip v={4} />
        </View>
      </View>
    );
  };

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
      onPress={() => (onPressOverride ? onPressOverride() : fire(actor, keyName, label, value))}
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
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const ScorePill = ({ value, border }: { value: number; border: string }) => (
    <View
      style={{
        marginTop: 10,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: border,
      }}
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

      {/* Grid (T3 / E1 / R2 / NF / ST) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP }}>
        <Circle label="T3" actor={leftActor as any} keyName="takedown" value={3} bg={leftColor} />
        <Circle label="E1" actor={leftActor as any} keyName="escape" value={1} bg={leftColor} />
        <Circle label="R2" actor={leftActor as any} keyName="reversal" value={2} bg={leftColor} />
        <Circle
          label="NF"
          actor={leftActor as any}
          keyName="nearfall"
          bg={leftColor}
          onPressOverride={() => openNF('left')}
        />
        <Circle label="ST" actor={leftActor as any} keyName="stalling" bg={leftColor} />
      </View>

      {/* push the score to the bottom of the column */}
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

      {/* mirrored grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: COL_W,
          gap: GAP,
          justifyContent: 'flex-end',
        }}
      >
        <Circle label="T3" actor={rightActor as any} keyName="takedown" value={3} bg={rightColor} />
        <Circle label="E1" actor={rightActor as any} keyName="escape" value={1} bg={rightColor} />
        <Circle label="R2" actor={rightActor as any} keyName="reversal" value={2} bg={rightColor} />
        <Circle
          label="NF"
          actor={rightActor as any}
          keyName="nearfall"
          bg={rightColor}
          onPressOverride={() => openNF('right')}
        />
        <Circle label="ST" actor={rightActor as any} keyName="stalling" bg={rightColor} />
      </View>

      <View style={{ flex: 1 }} />
      <ScorePill value={rightScore} border={rightColor} />
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

      {/* NF chooser */}
      <NFChooser />

      <LeftGrid />
      <RightGrid />
    </View>
  );
}











