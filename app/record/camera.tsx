// app/record/camera.tsx
//
// STABLE BUILD: overlay mounts only AFTER camera is on screen
//
// Changes vs. your last debug build:
// - Uses InteractionManager to wait for nav transitions
// - Mounts CameraView first; mounts overlay only after CameraView onLayout (+ small delay)
// - Keeps safe-area spacing; allows rotation (no orientation lock)
// - NOW: real video recording via recordAsync()/stopRecording()

import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WrestlingFolkstyleOverlay from '../../components/overlays/WrestlingFolkstyleOverlay';
import type { OverlayEvent } from '../../components/overlays/types';


const saveToAppStorage = async (srcUri?: string | null) => {
  if (!srcUri) return null;
  try {
    const dir = FileSystem.documentDirectory + 'videos/';
    // make sure the folder exists
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    // simple filename; you can improve later
    const ext = srcUri.split('.').pop()?.split('?')[0] || 'mp4';
    const destUri = `${dir}match_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: srcUri, to: destUri });
    return destUri; // this is your persistent app-local file
  } catch (e: any) {
    console.log('saveToAppStorage error:', e);
    Alert.alert('Save failed', String(e?.message ?? e));
    return null;
  }
};


export default function CameraScreen() {
  const { sport = 'wrestling', style = 'folkstyle' } =
    useLocalSearchParams<{ sport?: string; style?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  // If you want to capture AUDIO too, uncomment the next line and request mic permission as well
   const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);

  // Focus + staged mount flags
  const isFocused = useIsFocused();
  const [mountCam, setMountCam] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  // recording state
  const [isRecording, setIsRecording] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const insets = useSafeAreaInsets();

  // Wait for screen focus + transitions to finish before mounting camera
  useEffect(() => {
    let cancelled = false;
    let interaction: { cancel?: () => void } | null = null;

    if (isFocused && permission?.granted) {
      setShowOverlay(false); // hide overlay when (re)entering
      interaction = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) {
          setCamKey((k) => k + 1); // clean camera mount each focus
          setMountCam(true);
        }
      });
    } else {
      setMountCam(false);
      setShowOverlay(false);
    }

    return () => {
      cancelled = true;
      interaction?.cancel?.();
    };
  }, [isFocused, permission?.granted]);

  // Camera ready → then show overlay (tiny delay to avoid mount race)
  const handleCameraLayout = () => {
    // Guard against duplicate calls
    setShowOverlay((prev) => {
      if (prev) return prev;
      setTimeout(() => setShowOverlay(true), 60);
      return prev;
    });
  };

  const getCurrentTSec = () => {
    if (!startMs) return 0;
    const raw = Math.round((Date.now() - startMs) / 1000) - 3; // 3s lookback
    return raw < 0 ? 0 : raw;
  };

  const onEvent = (evt: OverlayEvent) =>
    setEvents((prev) => [...prev, { ...evt, t: getCurrentTSec() }]);

  // Hide nav header safely
  const navigation = useNavigation();
  useEffect(() => {
    try { (navigation as any)?.setOptions?.({ headerShown: false }); } catch {}
    return () => { try { (navigation as any)?.setOptions?.({ headerShown: true }); } catch {} };
  }, [navigation]);

  // Stop recording if the component unmounts mid-record (safety)
  useEffect(() => {
    return () => {
      try { (cameraRef.current as any)?.stopRecording?.(); } catch {}
    };
  }, []);

  if (!permission) return <View style={{ flex: 1, backgroundColor: 'black' }} />;
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

  // If using audio, consider prompting for mic permission before starting:
  // if (micPerm && !micPerm.granted) { await requestMicPerm(); }

  const handleStart = async () => {
    if (isRecording) return; // ignore double-taps

    if (!micPerm?.granted) {
      const r = await requestMicPerm();
      if (!r?.granted) {
        Alert.alert('Microphone needed', 'Enable microphone to record audio.');
        return; // bail before flipping state
      }
    }


    setEvents([]);
    setVideoUri(null);
    setIsRecording(true);
    setStartMs(Date.now());

    try {
      const recPromise = (cameraRef.current as any)?.recordAsync?.({
        // You can tweak options later (e.g., maxDuration, quality)
        mute: false,  
      });

      recPromise
      ?.then(async (res: any) => {
        const uri = typeof res === 'string' ? res : res?.uri;
        setVideoUri(uri ?? null);
    
        // ⬇️ Save a copy into the app's private storage
        const appUri = await saveToAppStorage(uri);
    
        Alert.alert(
          'Recording saved',
          `In-app file: ${appUri ?? 'n/a'}\nTemp: ${uri ?? 'n/a'}`
        );
      })
      .catch((e: any) => {
        console.log('recordAsync error:', e);
        Alert.alert('Recording error', String(e?.message ?? e));
      });
    } catch (e: any) {
      console.log('recordAsync threw:', e);
      Alert.alert('Recording error (thrown)', String(e?.message ?? e));
    }
  };

  const handleStop = async () => {
    if (!isRecording) return;
    try { (cameraRef.current as any)?.stopRecording?.(); } catch {}
    setIsRecording(false);
  };

  const isFolkstyle =
    String(sport).toLowerCase() === 'wrestling' &&
    String(style).toLowerCase() === 'folkstyle';

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {/* Camera mounts only after focus + transitions complete */}
      {permission.granted && isFocused && mountCam ? (
        <CameraView
          key={camKey}
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          mode="video"               // IMPORTANT for recording
          onLayout={handleCameraLayout}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: 'black' }} />
      )}

      {/* Back button (safe-area; hidden while recording) */}
      {!isRecording && (
        <View style={{ position: 'absolute', top: insets.top + 8, left: insets.left + 8 }}>
          <TouchableOpacity
            onPress={() => (navigation as any)?.goBack?.()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen overlay host (transparent) — mounts AFTER camera is laid out */}
      {showOverlay && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        >
          {isFolkstyle ? (
            <WrestlingFolkstyleOverlay
              isRecording={isRecording}
              onEvent={onEvent}
              getCurrentTSec={getCurrentTSec}
              sport={String(sport)}
              style={String(style)}
            />
          ) : (
            <Text style={{ color: 'white', position: 'absolute', top: insets.top + 12, left: insets.left + 12 }}>
              No overlay registered for {String(sport)}:{String(style)}
            </Text>
          )}
        </View>
      )}

      {/* Record / Stop (safe-area aware) */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 16,
          left: insets.left,
          right: insets.right,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {!isRecording ? (
          <TouchableOpacity
            onPress={handleStart}
            style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'red', borderRadius: 999 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStop}
            style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'white', borderRadius: 999 }}
          >
            <Text style={{ color: 'black', fontWeight: '600' }}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}















