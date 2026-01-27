// app/record/camera.tsx
// Fast open, zero-overlap UI, segmented recording, highlights, robust remounts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import type { CameraView } from 'expo-camera';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import ZoomableCameraView from '../../components/ZoomableCameraView';

import { useLocalSearchParams, useNavigation } from 'expo-router';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HighlightButton from '../../components/HighlightButton';
import type { OverlayEvent } from '../../components/overlays/types';

// ✅ centralized recording overlay registry (+ preroll)
import { getRecordingOverlay } from '../../components/overlays/RecordingOverlayRegistry';

// ✅ extracted recording helpers
import {
  Actor,
  finalizeRecording,
  MatchEvent,
} from '../../lib/recording/finalizeRecording';

// ✅ segmented recording manager
import {
  startNewSegment,
  stopCurrentSegment,
} from '../../lib/recording/segmentManager';

const CURRENT_ATHLETE_KEY = 'currentAthleteName';

const paramToStr = (v: unknown, fallback = '') =>
  Array.isArray(v) ? String(v[0] ?? fallback) : v == null ? fallback : String(v);

function makeEventId() {
  // Prefer UUID if available
  const anyCrypto: any = (globalThis as any).crypto;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();

  // Fallback: stable enough for local event identity
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function CameraScreen() {
  const params = useLocalSearchParams<{
    athlete?: string | string[];
    sport?: string | string[];
    style?: string | string[];
  }>();

  const athleteParamIncluded = typeof params.athlete !== 'undefined';
  const athleteParam = paramToStr(params.athlete, 'Unassigned');

  // defaults if nothing passed in
  const sportParam = paramToStr(params.sport, 'wrestling');
  const styleParam = paramToStr(params.style, 'folkstyle');

  // normalized for comparisons / registry lookup
  const sportNorm = sportParam.toLowerCase();
  const styleNorm = (styleParam || 'default').toLowerCase();

  // include original for saving payloads / folder names
  const sportKey = `${sportParam}:${styleParam || 'unknown'}`;

  // look up overlay + preroll
  let { Overlay: ActiveOverlay, preRollSec } = getRecordingOverlay(sportNorm, styleNorm);

  // 🔧 If we're on baseball but don't find a matching overlay, default to hitting
  if (sportNorm === 'baseball' && !ActiveOverlay) {
    const fallback = getRecordingOverlay('baseball', 'hitting');
    ActiveOverlay = fallback.Overlay;
    preRollSec = fallback.preRollSec;
  }

  console.log('[CameraScreen overlay]', {
    sportParam,
    styleParam,
    sportNorm,
    styleNorm,
    hasOverlay: !!ActiveOverlay,
    preRollSec,
  });

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [startMs, setStartMs] = useState<number | null>(null);
  const pauseStartedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);

  const [athlete, setAthlete] = useState<string>('Unassigned');
  const eventsRef = useRef<MatchEvent[]>([]);
  const scoreRef = useRef<{ home: number; opponent: number }>({
    home: 0,
    opponent: 0,
  });
  const [score, setScore] = useState(scoreRef.current);

  const [markers, setMarkers] = useState<number[]>([]);
  const HILITE_DURATION_SEC = 10;

  const segmentsRef = useRef<string[]>([]);
  const segmentActiveRef = useRef(false);
  const recordPromiseRef = useRef<Promise<any> | null>(null);

  const camOpacity = useRef(new Animated.Value(0)).current;
  const fadeInCamera = () => {
    Animated.timing(camOpacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // --- FFmpeg warmup
  useEffect(() => {
    (async () => {
      try {
        const s = await FFmpegKit.execute('-hide_banner -version');
        if (ReturnCode.isSuccess(await s.getReturnCode())) {
          const head = (await s.getAllLogsAsString()).split('\n')[0];
          console.log('[FFmpeg OK]', head);
        }
      } catch {}
    })();
  }, []);

  // --- athlete initial state
  useEffect(() => {
    (async () => {
      if (athleteParamIncluded) {
        setAthlete((athleteParam || '').trim() || 'Unassigned');
      } else {
        try {
          const last = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
          setAthlete((last || '').trim() || 'Unassigned');
        } catch {
          setAthlete('Unassigned');
        }
      }
    })();
  }, [athleteParamIncluded, athleteParam]);

  // --- camera permissions and mount
  useEffect(() => {
    (async () => {
      if (!permission) return;

      if (!permission.granted && permission.canAskAgain) {
        try {
          const result = await requestPermission();
          if (result.granted) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            setShouldRenderCamera(true);
          }
        } catch (e) {
          console.warn('[permission error]', e);
        }
      } else if (permission.granted) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        setShouldRenderCamera(true);
      }
    })();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isFocused) {
      setCameraReady(false);
      setShouldRenderCamera(false);
      camOpacity.setValue(0);
    } else if (isFocused && permission?.granted) {
      const timer = setTimeout(() => setShouldRenderCamera(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isFocused, permission?.granted, camOpacity]);

  // stop recording if we blur
  useEffect(() => {
    if (!isFocused && isRecording) {
      try {
        (cameraRef.current as any)?.stopRecording?.();
      } catch {}
      setIsRecording(false);
      setIsPaused(false);
      segmentActiveRef.current = false;
    }
  }, [isFocused, isRecording]);

  // mic permissions once focused
  useEffect(() => {
    if (isFocused && permission?.granted && !micPerm?.granted) {
      (async () => {
        try {
          await requestMicPerm();
        } catch {}
      })();
    }
  }, [isFocused, permission?.granted, micPerm?.granted, requestMicPerm]);

  // cleanup on unmount
  useEffect(
    () => () => {
      try {
        (cameraRef.current as any)?.stopRecording?.();
      } catch {}
    },
    [],
  );

  /**
   * ✅ Returns the timestamp (seconds) we write into events.
   * We subtract preRollSec so the pill can appear earlier.
   * (Real seeking/scoring still uses this stored time; playback will also shift display.)
   */
  const getCurrentTSec = () => {
    const start = startMs ?? Date.now();
    const pausedNow =
      isPaused && pauseStartedAtRef.current
        ? Date.now() - pauseStartedAtRef.current
        : 0;

    const effectiveElapsedMs =
      Date.now() - start - totalPausedMsRef.current - pausedNow;

    const rawSec = effectiveElapsedMs / 1000;

    // ✅ Pre-roll shift
    const shifted = rawSec - (Number.isFinite(preRollSec) ? preRollSec : 0);

    // Keep behavior similar to before (integer seconds, never negative)
    return Math.max(0, Math.round(shifted));
  };

  const handleOverlayEvent = (evt: OverlayEvent) => {
    if (!isRecording || isPaused) return;

    const t = getCurrentTSec();

    // Normalize event type: prefer key, fall back to kind
    const kind = String(evt.key ?? evt.kind ?? 'unknown');

    const points = Number.isFinite(evt.value) ? Number(evt.value) : undefined;

    const actor: Actor =
      evt.actor === 'home' || evt.actor === 'opponent' ? evt.actor : 'neutral';

    // only increment scoreboard for positive point events
    if (typeof points === 'number' && points > 0) {
      if (actor === 'home') {
        scoreRef.current = {
          ...scoreRef.current,
          home: scoreRef.current.home + points,
        };
      } else if (actor === 'opponent') {
        scoreRef.current = {
          ...scoreRef.current,
          opponent: scoreRef.current.opponent + points,
        };
      }
      setScore(scoreRef.current);
    }

    const eventId = makeEventId();

    // Keep meta clean + stable: prefer evt.meta, don’t store whole evt blob
    const meta =
      evt && typeof evt.meta === 'object' && evt.meta ? { ...evt.meta } : {};

    // ✅ Store preroll used at record-time so playback can be perfect per-clip/per-event later
    if (typeof meta.preRollSec !== 'number') {
      meta.preRollSec = Number.isFinite(preRollSec) ? preRollSec : 0;
    }

    const next: MatchEvent = {
      eventId,
      t,
      kind,
      key: evt.key,
      label: evt.label,
      points,
      actor,
      meta,
      scoreAfter: { ...scoreRef.current },
    };

    eventsRef.current = [...eventsRef.current, next];
  };

  const handleStart = async () => {
    if (isRecording || isProcessing) return;
    if (!cameraReady || !cameraRef.current) {
      Alert.alert('Camera not ready', 'Give it a moment, then tap Start.');
      return;
    }
    if (!micPerm?.granted) {
      const r = await requestMicPerm();
      if (!r?.granted) {
        Alert.alert('Microphone needed', 'Enable microphone to record audio.');
        return;
      }
    }

    eventsRef.current = [];
    scoreRef.current = { home: 0, opponent: 0 };
    setScore(scoreRef.current);

    setStartMs(Date.now());
    totalPausedMsRef.current = 0;
    pauseStartedAtRef.current = null;
    setIsPaused(false);

    setIsRecording(true);
    setMarkers([]);
    segmentsRef.current = [];

    try {
      await AsyncStorage.setItem(
        CURRENT_ATHLETE_KEY,
        (athlete || 'Unassigned').trim(),
      );
    } catch {}

    await startNewSegment(
      cameraRef,
      cameraReady,
      segmentsRef,
      segmentActiveRef,
      recordPromiseRef,
    );
  };

  const handlePause = async () => {
    if (!isRecording || isPaused) return;
    pauseStartedAtRef.current = Date.now();
    setIsPaused(true);
    await stopCurrentSegment(cameraRef, segmentActiveRef);
  };

  const handleResume = async () => {
    if (!isRecording || !isPaused) return;
    if (pauseStartedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
    }
    pauseStartedAtRef.current = null;
    setIsPaused(false);
    await startNewSegment(
      cameraRef,
      cameraReady,
      segmentsRef,
      segmentActiveRef,
      recordPromiseRef,
    );
  };

  const handleStop = async () => {
    if (!isRecording || isProcessing) return;

    if (isPaused && pauseStartedAtRef.current) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
    }
    pauseStartedAtRef.current = null;

    await stopCurrentSegment(cameraRef, segmentActiveRef);

    const segmentsToProcess = segmentsRef.current;
    const chosenAthlete = (athlete || '').trim() || 'Unassigned';
    const currentMarkers = [...markers];
    const currentEvents = [...eventsRef.current];
    const finalScore = { ...scoreRef.current };

    setIsRecording(false);
    setIsPaused(false);
    setIsProcessing(true);

    try {
      await finalizeRecording(
        segmentsToProcess,
        chosenAthlete,
        sportKey,
        currentMarkers,
        currentEvents,
        finalScore,
      );
    } catch (error) {
      Alert.alert(
        'A critical error occurred',
        'The recording was interrupted during file processing. Please check logs.',
      );
      console.error('Finalize Recording Error:', error);
    } finally {
      setIsProcessing(false);
      segmentsRef.current = [];
      setMarkers([]);
      setCameraReady(true);
    }
  };

  const addHighlight = () => {
    if (!isRecording || isPaused) return;

    // highlight marker should ALSO include lead-up (same preroll idea)
    const t = Math.max(
      0,
      (() => {
        const start = startMs ?? Date.now();
        const pausedNow =
          isPaused && pauseStartedAtRef.current
            ? Date.now() - pauseStartedAtRef.current
            : 0;

        const effectiveElapsed =
          Date.now() - start - totalPausedMsRef.current - pausedNow;

        const rawSec = effectiveElapsed / 1000;
        const shifted = rawSec - (Number.isFinite(preRollSec) ? preRollSec : 0);

        return Math.round(shifted) - HILITE_DURATION_SEC;
      })(),
    );

    setMarkers((m) => [...m, t]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {isFocused && shouldRenderCamera ? (
        <>
          <Animated.View style={{ flex: 1, opacity: camOpacity }}>
            <ZoomableCameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              mode="video"
              onCameraReady={() => {
                console.log('[camera ready]');
                setCameraReady(true);
                fadeInCamera();
              }}
              onMountError={(e: any) => {
                const msg =
                  e?.message ||
                  (e as any)?.nativeEvent?.message ||
                  'Camera mount error';
                console.warn('[camera mount error]', e);
                Alert.alert('Camera error', msg);
                setCameraReady(false);
                setTimeout(() => {
                  setShouldRenderCamera(false);
                  setTimeout(() => setShouldRenderCamera(true), 500);
                }, 1000);
              }}
            />
          </Animated.View>

          {cameraReady && !isProcessing && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              }}
              pointerEvents={isPaused ? ('none' as any) : ('box-none' as any)}
            >
              {ActiveOverlay ? (
                <ActiveOverlay
                  isRecording={isRecording}
                  onEvent={handleOverlayEvent}
                  getCurrentTSec={getCurrentTSec}
                  sport={sportParam}
                  style={styleParam}
                  score={score}
                />
              ) : (
                <Text
                  style={{
                    color: 'white',
                    position: 'absolute',
                    top: insets.top + 12,
                    left: 12,
                  }}
                >
                  Plain camera
                </Text>
              )}

              {isRecording && isPaused && (
                <View
                  style={{
                    position: 'absolute',
                    top: insets.top + 12,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontWeight: '900',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                    }}
                  >
                    Paused
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: 'black',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 18 }}>
            {permission?.granted
              ? 'Preparing camera…'
              : 'Waiting for camera permissions...'}
          </Text>
        </View>
      )}

      {isProcessing && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{ color: 'white', marginTop: 20, fontWeight: '700' }}>
            Saving and processing video...
          </Text>
          <Text style={{ color: 'gray', marginTop: 5, fontSize: 12 }}>
            This may take a moment depending on recording length.
          </Text>
        </View>
      )}

      {/* Hide Back button while recording */}
      {!isRecording && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 12,
            zIndex: 800,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (isProcessing) {
                Alert.alert(
                  'Please Wait',
                  'Recording is currently being saved and processed.',
                  [{ text: 'OK' }],
                );
              } else {
                (navigation as any)?.goBack?.();
              }
            }}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            disabled={isProcessing}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.35)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isRecording && !isProcessing && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 600,
          }}
        >
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.35)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
              {cameraReady ? 'Ready' : 'Opening camera…'} — {athlete || 'Unassigned'}
            </Text>
          </View>
        </View>
      )}

      {/* Bottom controls row with HighlightButton on the right */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 16,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {!isRecording ? (
          <>
            <TouchableOpacity
              onPress={handleStart}
              disabled={!cameraReady || isProcessing}
              style={{
                opacity: cameraReady && !isProcessing ? 1 : 0.5,
                paddingVertical: 12,
                paddingHorizontal: 20,
                backgroundColor: 'red',
                borderRadius: 999,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Start</Text>
            </TouchableOpacity>

            {/* star shown but disabled before recording */}
            <View style={{ marginLeft: 6 }}>
              <HighlightButton onPress={addHighlight} disabled={true} count={markers.length} />
            </View>
          </>
        ) : (
          <>
            {!isPaused ? (
              <TouchableOpacity
                onPress={handlePause}
                disabled={isProcessing}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'white',
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleResume}
                disabled={isProcessing}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: 'white',
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: 'black', fontWeight: '800' }}>Resume</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleStop}
              disabled={isProcessing}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 20,
                backgroundColor: 'white',
                borderRadius: 999,
              }}
            >
              <Text style={{ color: 'black', fontWeight: '600' }}>Stop</Text>
            </TouchableOpacity>

            {/* star at far right when recording; disabled if paused/processing */}
            <View style={{ marginLeft: 6 }}>
              <HighlightButton onPress={addHighlight} disabled={isPaused || isProcessing} count={markers.length} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
