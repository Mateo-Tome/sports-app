// app/(tabs)/recordingScreen.tsx

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
  Dimensions,
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
import { useRecordingStartGuard } from '../../src/hooks/useRecordingStartGuard';

import type {
  MatchEvent,
  RecordingOrientationKind,
} from '../../lib/recording/finalizeRecording';

type RouteParams = {
  athlete?: string | string[];
  athleteId?: string | string[];
  sport?: string | string[];
  style?: string | string[];
  stroke?: string | string[];
  distance?: string | string[];
  raceLabel?: string | string[];
  swimRace?: string | string[];
};

const CAMERA_READY_SETTLE_MS = 900;
const CAMERA_READY_TIMEOUT_MS = 6500;
const MAX_CAMERA_REMOUNTS = 2;

function paramToStr(v: unknown, fallback: string) {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = raw == null ? '' : String(raw);
  const t = s.trim();
  return t.length ? t : fallback;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function startFailureMessage(reason?: string) {
  if (reason === 'camera-not-ready') return 'Camera was not ready yet. Please try again.';
  if (reason === 'segment-dir-failed') return 'Could not prepare recording storage.';
  if (reason === 'no-recording-api') return 'This device camera does not support recording here.';
  if (reason === 'start-exception') return 'Camera hardware failed to start recording.';
  if (reason === 'settled-immediately') return 'Camera stopped immediately. Please try again.';
  return 'Could not start recording.';
}

export default function CameraScreen() {
  const params = useLocalSearchParams<RouteParams>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const sportParam = useMemo(() => paramToStr(params.sport, 'wrestling'), [params.sport]);
  const styleParam = useMemo(() => paramToStr(params.style, 'folkstyle'), [params.style]);
  const athleteName = useMemo(() => paramToStr(params.athlete, 'Unassigned'), [params.athlete]);
  const athleteId = useMemo(() => paramToStr(params.athleteId, ''), [params.athleteId]);
  const rawSwimRace = useMemo(() => paramToStr(params.swimRace, ''), [params.swimRace]);

  const parsedSwimRace = useMemo(() => {
    try {
      return rawSwimRace ? JSON.parse(rawSwimRace) : null;
    } catch {
      return null;
    }
  }, [rawSwimRace]);

  const strokeParam = useMemo(
    () => paramToStr(params.stroke, parsedSwimRace?.stroke ?? ''),
    [params.stroke, parsedSwimRace],
  );

  const distanceParam = useMemo(
    () => paramToStr(params.distance, parsedSwimRace?.distance ?? ''),
    [params.distance, parsedSwimRace],
  );

  const raceLabelParam = useMemo(
    () => paramToStr(params.raceLabel, parsedSwimRace?.raceLabel ?? ''),
    [params.raceLabel, parsedSwimRace],
  );

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [cameraReady, setCameraReady] = useState(false);
  const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const camOpacity = useRef(new Animated.Value(0)).current;

  const [zoom, setZoom] = useState(0);
  const baseZoomRef = useRef(0);

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

  const recordingOrientationRef = useRef<RecordingOrientationKind>('unknown');
  const recordingViewportRef = useRef({ width: 0, height: 0 });

  const cameraReadyAtRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const closingRef = useRef(false);

  const { orientation } = useRecordingStartGuard();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (!shouldRenderCamera || cameraReady || isRecording || isProcessing) return;

    const timeout = setTimeout(() => {
      if (!mountedRef.current || cameraReady || isRecording || isProcessing) return;

      setCameraRetryCount((count) => {
        if (count >= MAX_CAMERA_REMOUNTS) {
          console.log('[camera] ready timeout, max remounts reached');
          return count;
        }

        console.log('[camera] ready timeout, remounting camera', count + 1);

        setCameraReady(false);
        cameraReadyAtRef.current = null;
        cameraRef.current = null;
        camOpacity.setValue(0);
        setShouldRenderCamera(false);

        setTimeout(() => {
          if (!mountedRef.current) return;
          setRemountKey((k) => k + 1);
          setShouldRenderCamera(true);
        }, 250);

        return count + 1;
      });
    }, CAMERA_READY_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [shouldRenderCamera, cameraReady, isRecording, isProcessing, camOpacity]);

  const safeStopActiveSegment = useCallback(
    async (context: string) => {
      try {
        const stopped = await stopCurrentSegment(cameraRef, segmentActiveRef);

        if (!stopped) {
          console.warn(`[camera] stop segment timed out during ${context}`);
        }

        return stopped;
      } catch (e) {
        console.log(`[camera] stop segment failed during ${context}`, e);
        return false;
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      closingRef.current = false;

      const enterLandscapeThenMountCamera = async () => {
        setShouldRenderCamera(false);
        setCameraReady(false);
        setCameraRetryCount(0);
        cameraReadyAtRef.current = null;
        camOpacity.setValue(0);

        try {
          await ScreenOrientation.lockAsync(
            Platform.OS === 'ios'
              ? ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
              : ScreenOrientation.OrientationLock.LANDSCAPE,
          );

          const afterLock = await ScreenOrientation.getOrientationAsync();
          console.log('[camera] after landscape lock orientation=', afterLock);
        } catch (e) {
          console.log('[camera] failed to lock landscape', e);
        }

        const waitUntilLandscape = async () => {
          const start = Date.now();

          while (!cancelled) {
            const win = Dimensions.get('window');

            if (win.width > win.height) return true;

            if (Date.now() - start > 3500) {
              console.log('[camera] landscape wait timed out', win);
              return false;
            }

            await sleep(80);
          }

          return false;
        };

        await waitUntilLandscape();
        if (cancelled) return;

        setRemountKey((k) => k + 1);

        InteractionManager.runAfterInteractions(() => {
          if (!cancelled && cameraPermission?.granted) {
            setShouldRenderCamera(true);
          }
        });
      };

      if (cameraPermission?.granted) {
        enterLandscapeThenMountCamera();
      }

      return () => {
        cancelled = true;
        closingRef.current = true;

        setShouldRenderCamera(false);
        setCameraReady(false);
        cameraReadyAtRef.current = null;
        camOpacity.setValue(0);

        (async () => {
          if (segmentActiveRef.current) {
            await safeStopActiveSegment('screen cleanup');
          }

          try {
            await ScreenOrientation.unlockAsync();
          } catch (e) {
            console.log('[camera] failed to unlock orientation', e);
          }
        })();
      };
    }, [cameraPermission?.granted, camOpacity, safeStopActiveSegment]),
  );

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

  const getCurrentTSec = useCallback(() => {
    if (!startMs.current) return 0;

    const pausedNow =
      isPaused && pauseStartedAtRef.current ? Date.now() - pauseStartedAtRef.current : 0;

    const elapsed = Date.now() - startMs.current - totalPausedMsRef.current - pausedNow;

    return Math.max(0, elapsed / 1000 - preRollSec);
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

  const captureRecordingSnapshot = () => {
    const win = Dimensions.get('window');
    const isLandscapeViewport = win.width > win.height;

    recordingOrientationRef.current = isLandscapeViewport ? 'landscape' : 'portrait';

    recordingViewportRef.current = {
      width: win.width,
      height: win.height,
    };

    console.log('[camera] recording snapshot', {
      sensorOrientation: orientation,
      savedOrientation: recordingOrientationRef.current,
      viewport: recordingViewportRef.current,
      platform: Platform.OS,
    });
  };

  const waitForCameraSettled = async () => {
    const readyAt = cameraReadyAtRef.current;

    if (!readyAt) {
      return false;
    }

    const elapsed = Date.now() - readyAt;
    const remaining = CAMERA_READY_SETTLE_MS - elapsed;

    if (remaining > 0) {
      await sleep(remaining);
    }

    return !!cameraRef.current && !!cameraReadyAtRef.current;
  };

  const handleStart = async () => {
    const hasPermissions = await ensureRecordingPermissions();
    if (!hasPermissions) return;
    if (!cameraReady || isTransitioning || isProcessing) return;

    setIsTransitioning(true);

    try {
      const settled = await waitForCameraSettled();

      if (!settled) {
        Alert.alert('Camera not ready', 'Please wait a second and try again.');
        return;
      }

      captureRecordingSnapshot();

      eventsRef.current = [];
      scoreRef.current = { home: 0, opponent: 0 };
      setScore({ home: 0, opponent: 0 });
      setMarkers([]);
      segmentsRef.current = [];
      startMs.current = Date.now();
      totalPausedMsRef.current = 0;
      pauseStartedAtRef.current = null;

      const started = await startNewSegment(
        cameraRef,
        cameraReady,
        segmentsRef,
        segmentActiveRef,
        recordPromiseRef,
      );

      if (!started.ok) {
        console.log('[camera] start segment failed', started);
        Alert.alert('Camera error', startFailureMessage(started.reason));
        return;
      }

      setIsRecording(true);
      setIsPaused(false);
    } catch (e) {
      console.log('[camera] start recording failed', e);
      Alert.alert('Error', 'Could not start camera hardware.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handlePause = async () => {
    if (!isRecording || isPaused || isTransitioning || isProcessing) return;

    setIsTransitioning(true);
    pauseStartedAtRef.current = Date.now();

    try {
      const stopped = await safeStopActiveSegment('pause');

      if (!stopped) {
        pauseStartedAtRef.current = null;
        Alert.alert('Pause failed', 'The camera was still finishing the current clip. Try again.');
        return;
      }

      setIsPaused(true);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleResume = async () => {
    if (!isPaused || isTransitioning || isProcessing) return;

    setIsTransitioning(true);

    try {
      const settled = await waitForCameraSettled();

      if (!settled) {
        Alert.alert('Camera not ready', 'Please wait a second and try again.');
        return;
      }

      if (pauseStartedAtRef.current) {
        totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
      }

      pauseStartedAtRef.current = null;

      const started = await startNewSegment(
        cameraRef,
        cameraReady,
        segmentsRef,
        segmentActiveRef,
        recordPromiseRef,
      );

      if (!started.ok) {
        console.log('[camera] resume segment failed', started);
        Alert.alert('Resume failed', startFailureMessage(started.reason));
        return;
      }

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
      const stopped = await safeStopActiveSegment('stop');

      if (!stopped) {
        Alert.alert(
          'Save warning',
          'The camera took too long to finish the last segment. The saved video may be missing the last few seconds.',
        );
      }

      await sleep(800);

      const mod = await import('../../lib/recording/finalizeRecording');

      await mod.finalizeRecording(
        segmentsRef.current,
        athleteName,
        `${sportParam}:${styleParam}`,
        markers,
        eventsRef.current,
        scoreRef.current,
        {
          recordingOrientation: recordingOrientationRef.current,
          windowOrientation: recordingOrientationRef.current,
          viewportWidth: recordingViewportRef.current.width,
          viewportHeight: recordingViewportRef.current.height,
          orientationOverride: 0,
          athleteId,
        } as any,
      );

      setIsRecording(false);
      setIsPaused(false);

      try {
        await ScreenOrientation.unlockAsync();
      } catch { }

      navigation.goBack();
    } catch (error) {
      console.log('[camera] save failed', error);
      Alert.alert('Save failed', 'The recording was interrupted.');
    } finally {
      setIsProcessing(false);
      setIsTransitioning(false);
    }
  };

  const handleClose = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
  
    console.log('[camera] manual close start');
  
    try {
      setShouldRenderCamera(false);
      setCameraReady(false);
      cameraReadyAtRef.current = null;
      cameraRef.current = null;
      camOpacity.setValue(0);
  
      await sleep(500);
  
      if (segmentActiveRef.current) {
        await safeStopActiveSegment('manual close');
      }
  
      console.log('[camera] manual close unlock orientation');
      await ScreenOrientation.unlockAsync().catch(() => {});
  
      await sleep(250);
  
      console.log('[camera] manual close goBack');
      navigation.goBack();
    } finally {
      closingRef.current = false;
    }
  };

  const showWaitingForCamera = cameraPermission?.granted && !shouldRenderCamera && !isProcessing;
  const showReadyHud = cameraReady && !isRecording && !isProcessing;
  const recordDisabled = !cameraReady || isTransitioning || isProcessing;
  const cameraHasFailedToReady =
    shouldRenderCamera && !cameraReady && cameraRetryCount >= MAX_CAMERA_REMOUNTS;

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
                  console.log('[camera] ready');
                  cameraReadyAtRef.current = Date.now();
                  setCameraReady(true);
                  setCameraRetryCount(0);

                  Animated.timing(camOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                  }).start();
                }}
                onMountError={(error) => {
                  console.log('[camera] mount error', error);

                  setCameraReady(false);
                  cameraReadyAtRef.current = null;
                  cameraRef.current = null;
                  camOpacity.setValue(0);
                  setShouldRenderCamera(false);

                  setTimeout(() => {
                    if (!mountedRef.current) return;
                    setRemountKey((k) => k + 1);
                    setShouldRenderCamera(true);
                  }, 500);
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
                <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                  <ActivityIndicator color="white" style={{ marginBottom: 18 }} />
                  <Text style={styles.openingText}>Opening camera…</Text>
                </View>
              )}
            </View>
          )}

          {!isRecording && (
            <TouchableOpacity
              style={[styles.backBtn, { top: insets.top + 10 }]}
              onPress={handleClose}
            >
              <Text style={styles.backBtnText}>✕ CLOSE</Text>
            </TouchableOpacity>
          )}

          {showWaitingForCamera && (
            <View style={styles.loadingNoteWrap} pointerEvents="none">
              <View style={styles.loadingNotePill}>
                <Text style={styles.loadingNoteText}>Preparing camera</Text>
              </View>
            </View>
          )}

          {cameraHasFailedToReady && (
            <View style={styles.cameraRetryWrap}>
              <View style={styles.cameraRetryPill}>
                <Text style={styles.cameraRetryText}>Camera is taking longer than expected.</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setCameraRetryCount(0);
                    setCameraReady(false);
                    cameraReadyAtRef.current = null;
                    cameraRef.current = null;
                    camOpacity.setValue(0);
                    setShouldRenderCamera(false);

                    setTimeout(() => {
                      setRemountKey((k) => k + 1);
                      setShouldRenderCamera(true);
                    }, 250);
                  }}
                >
                  <Text style={styles.retryButtonText}>TRY AGAIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showReadyHud && (
            <View style={styles.centerHudWrap} pointerEvents="none">
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
                stroke={strokeParam}
                distance={distanceParam}
                raceLabel={raceLabelParam}
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
                style={[styles.recordBtnOuter, recordDisabled && styles.recordBtnDisabled]}
                onPress={handleStart}
                disabled={recordDisabled}
              >
                <View style={styles.recordBtnInner} />
              </TouchableOpacity>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={isPaused ? handleResume : handlePause}
                  disabled={isTransitioning || isProcessing}
                >
                  <Text style={styles.controlLabel}>{isPaused ? 'RESUME' : 'PAUSE'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={handleStop}
                  disabled={isTransitioning || isProcessing}
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

  centerHudWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '25%',
    alignItems: 'center',
    zIndex: 10,
  },

  loadingNoteWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '36%',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingNotePill: {
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadingNoteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  openingText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
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

  cameraRetryWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '42%',
    alignItems: 'center',
    zIndex: 50,
  },
  cameraRetryPill: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cameraRetryText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'white',
  },
  retryButtonText: {
    color: 'black',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
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
  recordBtnDisabled: {
    opacity: 0.35,
  },
  recordBtnInner: { width: 58, height: 58, borderRadius: 30, backgroundColor: '#FF3B30' },
  stopIcon: { width: 30, height: 30, backgroundColor: 'white', borderRadius: 4 },
  controlBtn: { padding: 10, minWidth: 90, alignItems: 'center' },
  stopBtn: { padding: 10 },
  controlLabel: { color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});