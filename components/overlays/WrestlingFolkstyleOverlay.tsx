// app/components/overlays/WrestlingFolkstyleOverlay.tsx
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayProps } from './types';

export default function WrestlingFolkstyleOverlay({
  isRecording,
  onEvent,
  getCurrentTSec, // accepted for future use
  sport,
  style,
}: OverlayProps) {
  const insets = useSafeAreaInsets();

  // Layout tuned for notch/punch-hole:
  const EDGE_L = insets.left + 12;
  const EDGE_R = insets.right + 12;
  const TOP = insets.top + 48;       // leaves room for Back pill
  const BOTTOM = insets.bottom + 96; // leaves room for Start/Stop

  const COL_W = 150;
  const BTN_H = 40;
  const BTN_FONT = 13;
  const GAP = 6;

  const ACTIVE = isRecording;

  const Btn = ({
    label, actor, keyName, value,
  }: {
    label: string;
    actor: 'home' | 'opponent' | 'neutral';
    keyName: string;
    value?: number;
  }) => (
    <TouchableOpacity
      disabled={!ACTIVE}
      onPress={() => onEvent({ key: keyName, label, actor, value })}
      style={{
        height: BTN_H,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: ACTIVE ? 2 : 1,                     // thicker when recording
        borderColor: 'rgba(255,255,255,0.98)',
        borderRadius: 10,
        marginBottom: GAP,
        paddingHorizontal: 8,
        backgroundColor: 'transparent',                  // still no fill
        opacity: ACTIVE ? 1 : 0.35,                      // less transparent when recording
      }}
    >
      <Text style={{ color: 'white', fontSize: BTN_FONT, fontWeight: ACTIVE ? '700' : '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}
    >
      {/* LEFT — Home */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, width: COL_W }}>
        <Text style={{ color: 'white', fontWeight: '700', marginBottom: 4 }}>Home</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <Btn label="Takedown (+3)" actor="home"     keyName="takedown2" value={2} />
          <Btn label="Escape (+1)"   actor="home"     keyName="escape1"   value={1} />
          <Btn label="Reversal (+2)" actor="home"     keyName="reversal2" value={2} />
          <Btn label="Near Fall (+2)"actor="home"     keyName="nearfall2" value={2} />
          <Btn label="Near Fall (+3)"actor="home"     keyName="nearfall3" value={3} />
          <Btn label="Stalling"      actor="home"     keyName="stalling" />
        </ScrollView>
      </View>

      {/* RIGHT — Opponent */}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, width: COL_W }}>
        <Text style={{ color: 'white', fontWeight: '700', marginBottom: 4, textAlign: 'right' }}>Opponent</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <Btn label="Takedown (+3)" actor="opponent" keyName="takedown2" value={2} />
          <Btn label="Escape (+1)"   actor="opponent" keyName="escape1"   value={1} />
          <Btn label="Reversal (+2)" actor="opponent" keyName="reversal2" value={2} />
          <Btn label="Near Fall (+2)"actor="opponent" keyName="nearfall2" value={2} />
          <Btn label="Near Fall (+3)"actor="opponent" keyName="nearfall3" value={3} />
          <Btn label="Stalling"      actor="opponent" keyName="stalling" />
        </ScrollView>
      </View>
    </View>
  );
}





