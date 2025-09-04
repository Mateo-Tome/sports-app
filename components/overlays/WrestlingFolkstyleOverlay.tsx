import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { OverlayProps } from './types';

export default function WrestlingFolkstyleOverlay({ isRecording, onEvent }: OverlayProps) {

  const BTN_H = 44;      // fixed, smaller height
  const BTN_FONT = 14;   // smaller text
  const GAP = 8;         // tighter spacing


  const Btn = ({ label, actor, keyName, value }:
    { label: string; actor: 'home' | 'opponent'; keyName: string; value?: number }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => onEvent({ key: keyName, label, actor, value })}
      style={{
        height: BTN_H,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        marginBottom: GAP,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isRecording ? 1 : 0.6,
      }}
    >
      <Text style={{ fontSize: BTN_FONT, color: 'black' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', marginBottom: 8, fontWeight: '600' }}>Home</Text>
        <Btn label="Takedown (+2)" actor="home" keyName="takedown2" value={2} />
        <Btn label="Escape (+1)"   actor="home" keyName="escape1"   value={1} />
        <Btn label="Reversal (+2)" actor="home" keyName="reversal2" value={2} />
        <Btn label="Near Fall (+2)"actor="home" keyName="nearfall2" value={2} />
        <Btn label="Near Fall (+3)"actor="home" keyName="nearfall3" value={3} />
        <Btn label="Stalling"     actor="home" keyName="stalling" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', marginBottom: 8, fontWeight: '600' }}>Opponent</Text>
        <Btn label="Takedown (+2)" actor="opponent" keyName="takedown2" value={2} />
        <Btn label="Escape (+1)"   actor="opponent" keyName="escape1"   value={1} />
        <Btn label="Reversal (+2)" actor="opponent" keyName="reversal2" value={2} />
        <Btn label="Near Fall (+2)"actor="opponent" keyName="nearfall2" value={2} />
        <Btn label="Near Fall (+3)"actor="opponent" keyName="nearfall3" value={3} />
        <Btn label="Stalling"     actor="opponent" keyName="stalling" />
      </View>
    </View>
  );
}

