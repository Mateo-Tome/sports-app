import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { getOverlayFor } from '../../components/overlays';
import type { OverlayEvent } from '../../components/overlays/types';

export default function CameraScreen() {
  const { sport = 'wrestling', style = 'folkstyle' } =
    useLocalSearchParams<{ sport?: string; style?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // timing state for -3s bias
  const [isRecording, setIsRecording] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const getCurrentTSec = () => {
    if (!startMs) return 0;
    const raw = Math.round((Date.now() - startMs) / 1000) - 3;
    return raw < 0 ? 0 : raw;
    };
  const onEvent = (evt: OverlayEvent) => setEvents(prev => [...prev, { ...evt, t: getCurrentTSec() }]);

  const Overlay = getOverlayFor(sport, style);

  if (!permission) return <View style={{ flex: 1 }} />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Text>We need camera permission</Text>
        <TouchableOpacity onPress={requestPermission} style={{ padding: 12, borderWidth: 1, borderRadius: 8 }}>
          <Text>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleStart = async () => {
    try {
      setEvents([]);
      setIsRecording(true);
      setStartMs(Date.now());
      // later: cameraRef.current?.recordAsync(...)
    } catch (e: any) {
      Alert.alert('Record error', e?.message ?? String(e));
    }
  };

  const handleStop = async () => {
    try {
      setIsRecording(false);
      // later: cameraRef.current?.stopRecording()
      Alert.alert('Stopped', `Captured ${events.length} events`);
      // later: save a sidecar JSON with these events
    } catch (e: any) {
      Alert.alert('Stop error', e?.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* top label */}
      <View style={{ position: 'absolute', top: 40, left: 16, right: 16, padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Text style={{ color: 'white' }}>{sport} — {style}</Text>
      </View>

      {/* overlay host */}
      <View style={{ position: 'absolute', bottom: 100, left: 16, right: 16 }}>
        {Overlay ? (
          <Overlay
            isRecording={isRecording}
            onEvent={onEvent}
            getCurrentTSec={getCurrentTSec}
            sport={sport}
            style={style}
          />
        ) : (
          <Text style={{ color: 'white' }}>No overlay registered for {sport}:{style}</Text>
        )}
      </View>

      {/* controls */}
      <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
        {!isRecording ? (
          <TouchableOpacity onPress={handleStart} style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'red', borderRadius: 999 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleStop} style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'white', borderRadius: 999 }}>
            <Text style={{ color: 'black', fontWeight: '600' }}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

