// app/record/camera.tsx
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraView as CameraViewRef } from 'expo-camera';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HighlightButton from '../../components/HighlightButton';
import { getRecordingOverlay } from '../../components/overlays/RecordingOverlayRegistry';
import { startNewSegment, stopCurrentSegment } from '../../lib/recording/segmentManager';

// Types
import type { OverlayEvent } from '../../components/overlays/types';
import type { Actor, MatchEvent } from '../../lib/recording/finalizeRecording';

const CURRENT_ATHLETE_KEY = 'currentAthleteName';
const READY_WATCHDOG_MS = 2200;

export default function CameraScreen() {
  const params = useLocalSearchParams<{ athlete?: string; sport?: string; style?: string }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const sportParam = params.sport || 'wrestling';
  const styleParam = params.style || 'folkstyle';

  // --- Permissions & Lifecycle ---
  const [permission, requestPermission] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  
  const [cameraReady, setCameraReady] = useState(false);
  const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [athlete, setAthlete] = useState('Unassigned');
  const [score, setScore] = useState({ home: 0, opponent: 0 });
  const [markers, setMarkers] = useState<number[]>([]);

  // --- Refs ---
  const cameraRef = useRef<CameraViewRef>(null);
  const eventsRef = useRef<MatchEvent[]>([]);
  const scoreRef = useRef({ home: 0, opponent: 0 });
  const segmentsRef = useRef<string[]>([]);
  const segmentActiveRef = useRef(false);
  const recordPromiseRef = useRef<Promise<any> | null>(null);
  const camOpacity = useRef(new Animated.Value(0)).current;

  // Timing
  const startMs = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);

  // --- 1. Overlay Resolution ---
  const { ActiveOverlay, preRollSec } = useMemo(() => {
    let res = getRecordingOverlay(sportParam.toLowerCase(), styleParam.toLowerCase());
    if (!res.Overlay && sportParam.toLowerCase() === 'baseball') {
      res = getRecordingOverlay('baseball', 'hitting');
    }
    return { ActiveOverlay: res.Overlay, preRollSec: res.preRollSec || 3 };
  }, [sportParam, styleParam]);

  // --- 2. Advanced Mounting Logic (Focus Effect) ---
  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!isCancelled && permission?.granted) {
          setShouldRenderCamera(true);
        }
      });

      return () => {
        isCancelled = true;
        task.cancel();
        setShouldRenderCamera(false);
        setCameraReady(false);
        // Clean up any stray recording
        if (segmentActiveRef.current) stopCurrentSegment(cameraRef, segmentActiveRef);
      };
    }, [permission])
  );

  // --- 3. Recording Functions ---
  const getCurrentTSec = useCallback(() => {
    if (!startMs.current) return 0;
    const pausedNow = isPaused && pauseStartedAtRef.current ? Date.now() - pauseStartedAtRef.current : 0;
    const elapsed = Date.now() - startMs.current - totalPausedMsRef.current - pausedNow;
    return Math.max(0, Math.round(elapsed / 1000 - preRollSec));
  }, [isPaused, preRollSec]);

  const handleStart = async () => {
    if (!cameraReady || isTransitioning) return;
    setIsTransitioning(true);
    
    eventsRef.current = [];
    scoreRef.current = { home: 0, opponent: 0 };
    setScore({ home: 0, opponent: 0 });
    setMarkers([]);
    segmentsRef.current = [];
    startMs.current = Date.now();
    totalPausedMsRef.current = 0;

    try {
      await startNewSegment(cameraRef, true, segmentsRef, segmentActiveRef, recordPromiseRef);
      setIsRecording(true);
    } catch (e) {
      Alert.alert("Error", "Could not start camera hardware.");
    } finally {
      setIsTransitioning(false);
    }
  };

  const handlePause = async () => {
    if (!isRecording || isPaused || isTransitioning) return;
    setIsTransitioning(true);
    pauseStartedAtRef.current = Date.now();
    
    try {
      await stopCurrentSegment(cameraRef, segmentActiveRef);
      setIsPaused(true);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleResume = async () => {
    if (!isPaused || isTransitioning) return;
    setIsTransitioning(true);
    
    if (pauseStartedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
    }
    pauseStartedAtRef.current = null;

    try {
      await startNewSegment(cameraRef, true, segmentsRef, segmentActiveRef, recordPromiseRef);
      setIsPaused(false);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleStop = async () => {
    if (isProcessing || isTransitioning) return;
    setIsProcessing(true);
    setIsTransitioning(true);

    try {
      await stopCurrentSegment(cameraRef, segmentActiveRef);
      const mod = await import('../../lib/recording/finalizeRecording');
      await mod.finalizeRecording(
        segmentsRef.current,
        athlete,
        `${sportParam}:${styleParam}`,
        markers,
        eventsRef.current,
        scoreRef.current
      );
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', 'The recording was interrupted.');
    } finally {
      setIsProcessing(false);
      setIsTransitioning(false);
    }
  };

  const handleOverlayEvent = (evt: OverlayEvent) => {
    if (!isRecording || isPaused) return;
    const t = getCurrentTSec();
    const actor = (evt as any).actor as Actor;
    const points = (evt as any).value as number;

    if (points) {
      if (actor === 'home') scoreRef.current.home += points;
      if (actor === 'opponent') scoreRef.current.opponent += points;
      setScore({ ...scoreRef.current });
    }

    eventsRef.current.push({
      eventId: `e_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      t,
      kind: (evt as any).kind || 'score',
      label: (evt as any).label,
      actor,
      scoreAfter: { ...scoreRef.current },
      meta: { ...(evt as any).meta, preRollSec }
    });
  };

  return (
    <View style={styles.container}>
      {shouldRenderCamera ? (
        <Animated.View style={{ flex: 1, opacity: camOpacity }}>
          <CameraView
            key={remountKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="video"
            onCameraReady={() => {
              setCameraReady(true);
              Animated.timing(camOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
            }}
          />
        </Animated.View>
      ) : (
        <View style={styles.centered}><ActivityIndicator color="white" /></View>
      )}

      {/* Sport Overlay */}
      {cameraReady && ActiveOverlay && !isProcessing && (
        <View style={StyleSheet.absoluteFill} pointerEvents={isPaused ? "none" : "box-none"}>
          <ActiveOverlay
            isRecording={isRecording}
            onEvent={handleOverlayEvent}
            getCurrentTSec={getCurrentTSec}
            sport={sportParam}
            style={styleParam}
            score={score}
          />
        </View>
      )}

      {/* Top Indicators */}
      {isPaused && (
        <View style={[styles.topIndicator, { top: insets.top + 60 }]}>
          <Text style={styles.indicatorText}>PAUSED</Text>
        </View>
      )}

      {/* Processing Loader */}
      {isProcessing && (
        <View style={styles.overlayLoader}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loaderText}>Processing Movie...</Text>
        </View>
      )}

      {/* Navigation / Back */}
      {!isRecording && (
        <TouchableOpacity 
          style={[styles.backBtn, { top: insets.top + 10 }]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>✕ Close</Text>
        </TouchableOpacity>
      )}

      {/* Main Control Bar */}
      <View style={[styles.controls, { bottom: insets.bottom + 30 }]}>
        {!isRecording ? (
          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.recordBtnOuter, (!cameraReady || isTransitioning) && { opacity: 0.5 }]} 
              onPress={handleStart}
              disabled={!cameraReady || isTransitioning}
            >
              <View style={styles.recordBtnInner} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.row}>
            {/* Pause/Resume Toggle */}
            <TouchableOpacity 
              style={styles.pauseBtn} 
              onPress={isPaused ? handleResume : handlePause}
              disabled={isTransitioning}
            >
              <View style={isPaused ? styles.playIcon : styles.pauseIconRow}>
                {!isPaused && <><View style={styles.pauseBar}/><View style={styles.pauseBar}/></>}
              </View>
              <Text style={styles.controlLabel}>{isPaused ? 'RESUME' : 'PAUSE'}</Text>
            </TouchableOpacity>

            {/* Stop Button */}
            <TouchableOpacity 
              style={styles.stopBtn} 
              onPress={handleStop}
              disabled={isTransitioning}
            >
              <View style={styles.stopIcon} />
              <Text style={styles.controlLabel}>STOP</Text>
            </TouchableOpacity>
            
            <HighlightButton 
              count={markers.length} 
              onPress={() => setMarkers(prev => [...prev, getCurrentTSec() - 10])}
              disabled={isPaused || isTransitioning}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  loaderText: { color: 'white', marginTop: 15, fontWeight: 'bold' },
  topIndicator: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,165,0,0.8)', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 10 },
  indicatorText: { color: 'white', fontWeight: '900', fontSize: 12 },
  controls: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  
  // Record Button (Classic Circle)
  recordBtnOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  recordBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF3B30' },
  
  // Pause/Resume Button
  pauseBtn: { alignItems: 'center', justifyContent: 'center' },
  pauseIconRow: { flexDirection: 'row', gap: 6, height: 30, alignItems: 'center' },
  pauseBar: { width: 6, height: 24, backgroundColor: '#FFF', borderRadius: 2 },
  playIcon: { width: 0, height: 0, borderTopWidth: 12, borderTopColor: 'transparent', borderBottomWidth: 12, borderBottomColor: 'transparent', borderLeftWidth: 20, borderLeftColor: '#FFF', marginLeft: 5 },
  
  // Stop Button
  stopBtn: { alignItems: 'center', justifyContent: 'center' },
  stopIcon: { width: 24, height: 24, backgroundColor: '#FFF', borderRadius: 4 },
  
  controlLabel: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: 8 },
  backBtn: { position: 'absolute', left: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
});