// app/record/camera.tsx
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewRef } from 'expo-camera';
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
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
  State
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HighlightButton from '../../components/HighlightButton';
import { getRecordingOverlay } from '../../components/overlays/RecordingOverlayRegistry';
import { startNewSegment, stopCurrentSegment } from '../../lib/recording/segmentManager';

// Types
import type { MatchEvent } from '../../lib/recording/finalizeRecording';

export default function CameraScreen() {
  const params = useLocalSearchParams<{ athlete?: string; sport?: string; style?: string }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const sportParam = params.sport || 'wrestling';
  const styleParam = params.style || 'folkstyle';

  const [permission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
  const [remountKey] = useState(0);

  // --- Optimized Zoom State ---
  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0); // Tracks zoom level between pinches

  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [score, setScore] = useState({ home: 0, opponent: 0 });
  const [markers, setMarkers] = useState<number[]>([]);

  const cameraRef = useRef<CameraViewRef>(null);
  const eventsRef = useRef<MatchEvent[]>([]);
  const scoreRef = useRef({ home: 0, opponent: 0 });
  const segmentsRef = useRef<string[]>([]);
  const segmentActiveRef = useRef(false);
  const recordPromiseRef = useRef<Promise<any> | null>(null);
  const camOpacity = useRef(new Animated.Value(0)).current;

  const startMs = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);

  // --- Zoom Logic: Smooth & Cinematic ---
  const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    // Multiplier changed to 0.2 for slower, more precise zooming
    let newZoom = baseZoomRef.current + (event.nativeEvent.scale - 1) * 0.2;
    
    // Clamp between 0 (wide) and 1 (max telephoto)
    newZoom = Math.max(0, Math.min(newZoom, 1));
    
    // Only update state if change is meaningful to prevent CPU overload
    if (Math.abs(newZoom - zoom) > 0.002) {
      setZoom(newZoom);
    }
  };

  const onPinchStateChange = (event: any) => {
    // When fingers are lifted, lock in the current zoom as the new baseline
    if (event.nativeEvent.oldState === State.ACTIVE) {
      baseZoomRef.current = zoom;
    }
  };

  const { ActiveOverlay, preRollSec } = useMemo(() => {
    let res = getRecordingOverlay(sportParam.toLowerCase(), styleParam.toLowerCase());
    if (!res.Overlay && sportParam.toLowerCase() === 'baseball') {
      res = getRecordingOverlay('baseball', 'hitting');
    }
    return { ActiveOverlay: res.Overlay, preRollSec: res.preRollSec || 3 };
  }, [sportParam, styleParam]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!isCancelled && permission?.granted) setShouldRenderCamera(true);
      });
      return () => {
        isCancelled = true;
        task.cancel();
        setShouldRenderCamera(false);
        setCameraReady(false);
        if (segmentActiveRef.current) stopCurrentSegment(cameraRef, segmentActiveRef);
      };
    }, [permission])
  );

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
    if (pauseStartedAtRef.current) totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
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
      // Wait for hardware to release the final file segment
      await new Promise(r => setTimeout(r, 600));
      const mod = await import('../../lib/recording/finalizeRecording');
      await mod.finalizeRecording(
        segmentsRef.current,
        'Athlete',
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PinchGestureHandler 
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <View style={styles.container}>
          {shouldRenderCamera ? (
            <Animated.View style={{ flex: 1, opacity: camOpacity }}>
              <CameraView
                key={remountKey}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                mode="video"
                zoom={zoom}
                onCameraReady={() => {
                  setCameraReady(true);
                  Animated.timing(camOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
                }}
              />
            </Animated.View>
          ) : (
            <View style={styles.centered}><ActivityIndicator color="white" /></View>
          )}

          {/* Zoom Indicator - Solid background stops iOS warnings */}
          {zoom > 0 && (
            <View style={styles.zoomIndicator}>
              <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
            </View>
          )}

          {/* Overlays */}
          {cameraReady && ActiveOverlay && !isProcessing && (
            <View style={StyleSheet.absoluteFill} pointerEvents={isPaused ? "none" : "box-none"}>
              <ActiveOverlay
                isRecording={isRecording}
                onEvent={(evt: any) => {
                  if (!isRecording || isPaused) return;
                  const t = getCurrentTSec();
                  if (evt.value) {
                    if (evt.actor === 'home') scoreRef.current.home += evt.value;
                    if (evt.actor === 'opponent') scoreRef.current.opponent += evt.value;
                    setScore({ ...scoreRef.current });
                  }
                  eventsRef.current.push({ ...evt, t, scoreAfter: { ...scoreRef.current } });
                }}
                getCurrentTSec={getCurrentTSec}
                sport={sportParam}
                style={styleParam}
                score={score}
              />
            </View>
          )}

          {isProcessing && (
            <View style={styles.overlayLoader}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.loaderText}>Processing Movie...</Text>
            </View>
          )}

          {/* Controls Bar */}
          <View style={[styles.controls, { bottom: insets.bottom + 30 }]}>
            {!isRecording ? (
              <TouchableOpacity 
                style={styles.recordBtnOuter} 
                onPress={handleStart} 
                disabled={!cameraReady || isTransitioning}
              >
                <View style={styles.recordBtnInner} />
              </TouchableOpacity>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity 
                   style={styles.controlBtn}
                   onPress={isPaused ? handleResume : handlePause} 
                   disabled={isTransitioning}
                >
                  <Text style={styles.controlLabel}>{isPaused ? 'RESUME' : 'PAUSE'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.stopBtn}
                  onPress={handleStop} 
                  disabled={isTransitioning}
                >
                  <View style={styles.stopIcon} />
                </TouchableOpacity>

                <HighlightButton 
                  count={markers.length} 
                  onPress={() => setMarkers(p => [...p, getCurrentTSec()])} 
                />
              </View>
            )}
          </View>
        </View>
      </PinchGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomIndicator: { 
    position: 'absolute', 
    top: 100, 
    right: 20, 
    backgroundColor: 'rgba(20,20,20,0.8)', 
    paddingHorizontal: 12,
    paddingVertical: 6, 
    borderRadius: 20,
    zIndex: 50
  },
  zoomText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  overlayLoader: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1000 
  },
  loaderText: { color: 'white', marginTop: 15, fontWeight: 'bold' },
  controls: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  recordBtnOuter: { width: 75, height: 75, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  recordBtnInner: { width: 55, height: 55, borderRadius: 30, backgroundColor: '#FF3B30' },
  stopIcon: { width: 28, height: 28, backgroundColor: 'white', borderRadius: 4 },
  controlBtn: { padding: 10, minWidth: 80, alignItems: 'center' },
  stopBtn: { padding: 10 },
  controlLabel: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});