import { useFocusEffect } from '@react-navigation/native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraView as CameraViewRef,
} from 'expo-camera';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
  type PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HighlightButton from '../../components/HighlightButton';
import { getRecordingOverlay } from '../../components/overlays/RecordingOverlayRegistry';
import { startNewSegment, stopCurrentSegment } from '../../lib/recording/segmentManager';

// Types
import type { MatchEvent } from '../../lib/recording/finalizeRecording';

type RouteParams = {
  athlete?: string | string[];
  sport?: string | string[];
  style?: string | string[];
};

function paramToStr(v: unknown, fallback: string) {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = raw == null ? '' : String(raw);
  const t = s.trim();
  return t.length ? t : fallback;
}

export default function CameraScreen() {
  const params = useLocalSearchParams<RouteParams>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Normalize route params
  const sportParam = useMemo(() => paramToStr(params.sport, 'wrestling'), [params.sport]);
  const styleParam = useMemo(() => paramToStr(params.style, 'folkstyle'), [params.style]);
  const athleteName = useMemo(() => paramToStr(params.athlete, 'Unassigned'), [params.athlete]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [cameraReady, setCameraReady] = useState(false);
  const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
  const [remountKey] = useState(0);

  // --- Animations ---
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const camOpacity = useRef(new Animated.Value(0)).current;

  // --- Zoom State ---
  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0);

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

  const startMs = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);

  // Auto-request camera permission on mount
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  // Lock the camera screen while focused.
  // Android gets a fixed landscape side to reduce ambiguous rotation metadata.
  // iPhone keeps the old generic landscape behavior for safety.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const lockOrientation = async () => {
        try {
          if (Platform.OS === 'android') {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
            );
          } else {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.LANDSCAPE,
            );
          }
        } catch (e) {
          console.log('[camera] failed to lock landscape', e);
        }
      };

      lockOrientation();

      return () => {
        mounted = false;
        const unlockOrientation = async () => {
          try {
            await ScreenOrientation.unlockAsync();
          } catch (e) {
            console.log('[camera] failed to unlock orientation', e);
          }
        };
        if (mounted === false) {
          unlockOrientation();
        }
      };
    }, []),
  );

  // Pulse effect for the "Ready" indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    if (cameraReady && !isRecording) pulse.start();
    return () => pulse.stop();
  }, [cameraReady, isRecording, pulseAnim]);

  // --- Zoom Logic ---
  const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    let newZoom = baseZoomRef.current + (event.nativeEvent.scale - 1) * 0.2;
    newZoom = Math.max(0, Math.min(newZoom, 1));
    if (Math.abs(newZoom - zoom) > 0.002) setZoom(newZoom);
  };

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) baseZoomRef.current = zoom;
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
        if (!isCancelled && cameraPermission?.granted) {
          setShouldRenderCamera(true);
        }
      });

      return () => {
        isCancelled = true;
        task.cancel();

        setShouldRenderCamera(false);
        setCameraReady(false);
        camOpacity.setValue(0);

        if (segmentActiveRef.current) {
          stopCurrentSegment(cameraRef, segmentActiveRef);
        }
      };
    }, [cameraPermission, camOpacity]),
  );

  const getCurrentTSec = useCallback(() => {
    if (!startMs.current) return 0;
    const pausedNow =
      isPaused && pauseStartedAtRef.current ? Date.now() - pauseStartedAtRef.current : 0;
    const elapsed = Date.now() - startMs.current - totalPausedMsRef.current - pausedNow;
    return Math.max(0, Math.round(elapsed / 1000 - preRollSec));
  }, [isPaused, preRollSec]);

  const ensureRecordingPermissions = useCallback(async () => {
    let camGranted = !!cameraPermission?.granted;
    let micGranted = !!microphonePermission?.granted;

    if (!camGranted) {
      const camResp = await requestCameraPermission();
      camGranted = !!camResp.granted;
    }

    if (!micGranted) {
      const micResp = await requestMicrophonePermission();
      micGranted = !!micResp.granted;
    }

    if (!camGranted) {
      Alert.alert('Camera permission', 'Please enable camera access to record.');
      return false;
    }

    if (!micGranted) {
      Alert.alert('Microphone permission', 'Please enable microphone access to record audio.');
      return false;
    }

    return true;
  }, [
    cameraPermission,
    microphonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  const handleStart = async () => {
    const hasPermissions = await ensureRecordingPermissions();
    if (!hasPermissions) return;
    if (!cameraReady || isTransitioning) return;

    setIsTransitioning(true);

    await new Promise((r) => setTimeout(r, 300));

    eventsRef.current = [];
    scoreRef.current = { home: 0, opponent: 0 };
    setScore({ home: 0, opponent: 0 });
    setMarkers([]);
    segmentsRef.current = [];
    startMs.current = Date.now();
    totalPausedMsRef.current = 0;
    pauseStartedAtRef.current = null;

    try {
      await startNewSegment(cameraRef, true, segmentsRef, segmentActiveRef, recordPromiseRef);
      setIsRecording(true);
      setIsPaused(false);
    } catch (e) {
      Alert.alert('Error', 'Could not start camera hardware.');
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

      await new Promise((r) => setTimeout(r, 800));

      const mod = await import('../../lib/recording/finalizeRecording');
      await mod.finalizeRecording(
        segmentsRef.current,
        athleteName,
        `${sportParam}:${styleParam}`,
        markers,
        eventsRef.current,
        scoreRef.current,
      );

      try {
        await ScreenOrientation.unlockAsync();
      } catch {}

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
                  Animated.timing(camOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                  }).start();
                }}
              />
            </Animated.View>
          ) : (
            <View style={styles.centered}>
              {!cameraPermission?.granted ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator color="white" style={{ marginBottom: 20 }} />
                  <TouchableOpacity style={styles.hudPill} onPress={requestCameraPermission}>
                    <Text style={styles.hudStatusText}>TAP TO ENABLE CAMERA</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ActivityIndicator color="white" />
              )}
            </View>
          )}

          {!isRecording && (
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 10 }]}
              onPress={async () => {
                try {
                  await ScreenOrientation.unlockAsync();
                } catch {}
                navigation.goBack();
              }}
            >
              <Text style={styles.backBtnText}>✕ CLOSE</Text>
            </TouchableOpacity>
          )}

          {cameraReady && !isRecording && (
            <View style={styles.centerHudContainer} pointerEvents="none">
              <View style={styles.hudPill}>
                <Text style={styles.hudAthleteName}>{athleteName.toUpperCase()}</Text>
                <View style={styles.hudDivider} />
                <View style={styles.hudStatusRow}>
                  <Animated.View style={[styles.hudPulseDot, { opacity: pulseAnim }]} />
                  <Text style={styles.hudStatusText}>READY TO RECORD</Text>
                </View>
              </View>
            </View>
          )}

          {cameraReady && isRecording && isPaused && !isProcessing && (
            <View style={styles.pausedPillWrap} pointerEvents="none">
              <View style={styles.pausedPill}>
                <View style={styles.pausedDot} />
                <Text style={styles.pausedPillText}>PAUSED</Text>
              </View>
            </View>
          )}

          {cameraReady && ActiveOverlay && !isProcessing && (
            <View style={StyleSheet.absoluteFill} pointerEvents={isPaused ? 'none' : 'box-none'}>
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
                athleteName={athleteName}
              />
            </View>
          )}

          {isProcessing && (
            <View style={styles.overlayLoader}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.loaderText}>SAVING VIDEO...</Text>
            </View>
          )}

          <View style={[styles.controls, { bottom: insets.bottom + 40 }]}>
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
                  onPress={() => setMarkers((p) => [...p, getCurrentTSec()])}
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

  backBtn: {
    position: 'absolute',
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 100,
  },
  backBtnText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  centerHudContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  hudPill: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hudAthleteName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  hudDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 6,
  },
  hudStatusRow: { flexDirection: 'row', alignItems: 'center' },
  hudPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 8,
  },
  hudStatusText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  pausedPillWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  pausedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  pausedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 10,
  },
  pausedPillText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.4,
  },

  overlayLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loaderText: { color: 'white', marginTop: 15, fontWeight: '900', letterSpacing: 2 },

  controls: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  recordBtnOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnInner: { width: 58, height: 58, borderRadius: 30, backgroundColor: '#FF3B30' },
  stopIcon: { width: 30, height: 30, backgroundColor: 'white', borderRadius: 4 },
  controlBtn: { padding: 10, minWidth: 90, alignItems: 'center' },
  stopBtn: { padding: 10 },
  controlLabel: { color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});