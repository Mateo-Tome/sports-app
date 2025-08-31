import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { OverlayProps } from './types';

export default function WrestlingGrecoOverlay({ isRecording, onEvent }: OverlayProps) {
  const Btn = ({ label, actor, keyName, value }:
    { label: string; actor: 'home' | 'opponent'; keyName: string; value?: number }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => onEvent({ key: keyName, label, actor, value })}
      style={{ paddingVertical: 14, paddingHorizontal: 10, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.95)', marginBottom: 8, alignItems: 'center',
        opacity: isRecording ? 1 : 0.6 }}
    >
      <Text style={{ fontSize: 16, color: 'black' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', marginBottom: 8, fontWeight: '600' }}>Home</Text>
        <Btn label="Takedown (2)" actor="home" keyName="takedown2" value={2} />
        <Btn label="Takedown (4)" actor="home" keyName="takedown4" value={4} />
        <Btn label="Exposure (2)" actor="home" keyName="exposure2" value={2} />
        <Btn label="Step-Out (1)" actor="home" keyName="stepout1" value={1} />
        <Btn label="Passivity"    actor="home" keyName="passivity" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', marginBottom: 8, fontWeight: '600' }}>Opponent</Text>
        <Btn label="Takedown (2)" actor="opponent" keyName="takedown2" value={2} />
        <Btn label="Takedown (4)" actor="opponent" keyName="takedown4" value={4} />
        <Btn label="Exposure (2)" actor="opponent" keyName="exposure2" value={2} />
        <Btn label="Step-Out (1)" actor="opponent" keyName="stepout1" value={1} />
        <Btn label="Passivity"    actor="opponent" keyName="passivity" />
      </View>
    </View>
  );
}

