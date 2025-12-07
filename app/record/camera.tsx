// app/record/camera.tsx
// Fast open, zero-overlap UI, segmented recording, highlights, robust remounts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import type { CameraView } from 'expo-camera';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import ZoomableCameraView from '../../components/ZoomableCameraView';

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { JSX, useEffect, useRef, useState } from 'react';
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
import BaseballHittingOverlay from '../../components/overlays/BaseballHittingOverlay';
import type {
  OverlayEvent,
  OverlayProps,
} from '../../components/overlays/types';
import WrestlingFolkstyleOverlay from '../../components/overlays/WrestlingFolkstyleOverlay';

// ✅ NEW: use the extracted stitcher helper
import { stitchSegmentsWithFallback } from '../../lib/recording/segmentStitcher';

const CURRENT_ATHLETE_KEY = 'currentAthleteName';

const VIDEOS_DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = VIDEOS_DIR + 'index.json';
const HIGHLIGHTS_SPORT = 'highlights';
const SEG_DIR = FileSystem.cacheDirectory + 'segments/';

// ---- Overlay registry (EASY EXTENSION POINT) -----------------

type OverlayComponent = (props: OverlayProps) => JSX.Element;

const overlayRegistry: Record<string, OverlayComponent> = {
  'wrestling:folkstyle': WrestlingFolkstyleOverlay,
  'baseball:hitting': BaseballHittingOverlay,
  // later:
  // 'baseball:pitching': BaseballPitchingOverlay,
  // 'basketball:default': BasketballOverlay,
};

// --- utils
const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {}
};

const slug = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown';

const tsStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
};

const paramToStr = (v: unknown, fallback = '') =>
  Array.isArray(v) ? String(v[0] ?? fallback) : v == null ? fallback : String(v);

const q = (p: string) => `"${String(p).replace(/"/g, '\\"')}"`;

// --- index/media
type VideoMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  createdAt: number;
  assetId?: string;
};

async function readIndex(): Promise<VideoMeta[]> {
  try {
    const info = (await FileSystem.getInfoAsync(INDEX_PATH)) as any;
    if (!info?.exists) return [];
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeIndexAtomic(list: VideoMeta[]) {
  const tmp = INDEX_PATH + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(list));
  try {
    await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true });
  } catch {}
  await FileSystem.moveAsync({ from: tmp, to: INDEX_PATH });
}

async function appendVideoIndex(entry: VideoMeta) {
  await ensureDir(VIDEOS_DIR);
  const list = await readIndex();
  list.unshift(entry);
  await writeIndexAtomic(list);
}

async function importToPhotosAndAlbums(
  fileUri: string,
  athlete: string,
  sport: string,
) {
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) return undefined;
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    const athleteAlbum = athlete?.trim() || 'Unassigned';
    const sportAlbum = `${athleteAlbum} - ${sport?.trim() || 'unknown'}`;

    let a = await MediaLibrary.getAlbumAsync(athleteAlbum);
    if (!a) a = await MediaLibrary.createAlbumAsync(athleteAlbum, asset, false);
    else await MediaLibrary.addAssetsToAlbumAsync([asset], a, false);

    let s = await MediaLibrary.getAlbumAsync(sportAlbum);
    if (!s) s = await MediaLibrary.createAlbumAsync(sportAlbum, asset, false);
    else await MediaLibrary.addAssetsToAlbumAsync([asset], s, false);

    return asset.id;
  } catch {
    return undefined;
  }
}

const saveToAppStorage = async (
  srcUri?: string | null,
  athleteRaw?: string,
  sportRaw?: string,
) => {
  if (!srcUri) {
    Alert.alert('No video URI', 'Recording did not return a file path.');
    return {
      appUri: null as string | null,
      assetId: undefined as string | undefined,
    };
  }
  const athlete = (athleteRaw || '').trim() || 'Unassigned';
  const sport = (sportRaw || '').trim() || 'unknown';
  const dir = `${VIDEOS_DIR}${slug(athlete)}/${slug(sport)}/`;
  await ensureDir(dir);
  const ext = srcUri.split('.').pop()?.split('?')[0] || 'mp4';
  const filename = `match_${tsStamp()}.${ext}`;
  const destUri = dir + filename;

  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  try {
    await FileSystem.deleteAsync(srcUri, { idempotent: true });
  } catch {}

  const displayName = `${athlete} - ${sport} - ${new Date().toLocaleString()}`;
  const assetId = await importToPhotosAndAlbums(destUri, athlete, sport);
  await appendVideoIndex({
    uri: destUri,
    displayName,
    athlete,
    sport,
    createdAt: Date.now(),
    assetId,
  });

  return { appUri: destUri, assetId };
};

// --- sidecar/highlights
type Actor = 'home' | 'opponent' | 'neutral';
type MatchEvent = {
  t: number;
  kind: string;
  points?: number;
  actor: Actor;
  meta?: Record<string, any>;
  scoreAfter?: { home: number; opponent: number };
};

async function writeHighlightSidecar(
  clipUri: string,
  athlete: string,
  fromT: number,
  duration: number,
) {
  try {
    const jsonUri = clipUri.replace(/\.[^/.]+$/, '') + '.json';
    await FileSystem.writeAsStringAsync(
      jsonUri,
      JSON.stringify({
        athlete,
        sport: HIGHLIGHTS_SPORT,
        createdAt: Date.now(),
        source: 'auto-clip',
        window: { t: fromT, duration },
      }),
    );
  } catch {}
}

async function addClipToIndexAndAlbums(clipUri: string, athlete: string) {
  const displayName = `${athlete} - ${HIGHLIGHTS_SPORT} - ${new Date().toLocaleString()}`;
  const assetId = await importToPhotosAndAlbums(
    clipUri,
    athlete,
    HIGHLIGHTS_SPORT,
  );
  await appendVideoIndex({
    uri: clipUri,
    displayName,
    athlete,
    sport: HIGHLIGHTS_SPORT,
    createdAt: Date.now(),
    assetId,
  });
}

async function destForHighlight(athlete: string) {
  const base = `${VIDEOS_DIR}${slug(athlete)}/${slug(HIGHLIGHTS_SPORT)}/`;
  await ensureDir(base);
  return base;
}

const processHighlights = async (
  videoUri: string,
  markers: number[],
  durationSec: number,
  athleteName: string,
) => {
  if (!markers.length) return [];
  const destDir = await destForHighlight(athleteName);
  const results: { url: string; markerTime: number }[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = Math.max(0, markers[i]);
    const outPath = `${destDir}clip_${i + 1}_${tsStamp()}.mp4`;

    let cmd = `-y -ss ${start} -t ${durationSec} -i ${q(
      videoUri,
    )} -c copy ${q(outPath)}`;
    let s = await FFmpegKit.execute(cmd);
    if (ReturnCode.isSuccess(await s.getReturnCode())) {
      await addClipToIndexAndAlbums(outPath, athleteName);
      await writeHighlightSidecar(outPath, athleteName, start, durationSec);
      results.push({ url: outPath, markerTime: start });
      continue;
    }

    cmd = `-y -ss ${start} -t ${durationSec} -i ${q(
      videoUri,
    )} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k ${q(
      outPath,
    )}`;
    s = await FFmpegKit.execute(cmd);
    if (ReturnCode.isSuccess(await s.getReturnCode())) {
      await addClipToIndexAndAlbums(outPath, athleteName);
      await writeHighlightSidecar(outPath, athleteName, start, durationSec);
      results.push({ url: outPath, markerTime: start });
    }
  }
  return results;
};

// ⬇️ we KEEP waitFor (still used), but REMOVE the old concatSegments here
async function waitFor(pred: () => boolean, timeoutMs: number, pollMs = 40) {
  const start = Date.now();
  while (!pred()) {
    await new Promise((r) => setTimeout(r, pollMs));
    if (Date.now() - start > timeoutMs) break;
  }
}

// --- screen
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

  // look up overlay, e.g. "wrestling:folkstyle", "baseball:hitting"
  let overlayKey = `${sportNorm}:${styleNorm}`;

  // 🔧 If we're on baseball but don't find a matching overlay, default to hitting
  if (sportNorm === 'baseball' && !overlayRegistry[overlayKey]) {
    overlayKey = 'baseball:hitting';
  }

  const ActiveOverlay = overlayRegistry[overlayKey];

  console.log('[CameraScreen overlay]', {
    sportParam,
    styleParam,
    sportNorm,
    styleNorm,
    overlayKey,
    hasOverlay: !!ActiveOverlay,
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

  const getCurrentTSec = () => {
    const start = startMs ?? Date.now();
    const pausedNow =
      isPaused && pauseStartedAtRef.current
        ? Date.now() - pauseStartedAtRef.current
        : 0;
    const effectiveElapsed =
      Date.now() - start - totalPausedMsRef.current - pausedNow;
    return Math.max(0, Math.round(effectiveElapsed / 1000) - 3);
  };

  const handleOverlayEvent = (evt: OverlayEvent) => {
    if (!isRecording || isPaused) return;
    const t = getCurrentTSec();
    const kind = String(evt.key ?? 'unknown');
    const points = Number.isFinite(evt.value)
      ? Number(evt.value)
      : undefined;
    const actor: Actor =
      evt.actor === 'home' || evt.actor === 'opponent'
        ? evt.actor
        : 'neutral';

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

    eventsRef.current = [
      ...eventsRef.current,
      {
        t,
        kind,
        points,
        actor,
        meta: evt as any,
        scoreAfter: { ...scoreRef.current },
      },
    ];
  };

  const startNewSegment = async () => {
    const cam: any = cameraRef.current;
    if (!cam || !cameraReady) {
      console.warn('[segment] camera not ready');
      return;
    }
    await ensureDir(SEG_DIR);
    segmentActiveRef.current = true;
    recordPromiseRef.current = null;

    try {
      if (typeof cam.startRecording === 'function') {
        // CameraView.startRecording path
        cam.startRecording({
          mute: false,
          onRecordingFinished: async (res: any) => {
            const uri = typeof res === 'string' ? res : res?.uri;
            if (uri) {
              const dest = SEG_DIR + `seg_${tsStamp()}.mp4`;
              try {
                await FileSystem.copyAsync({ from: uri, to: dest });
              } catch {}
              try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
              } catch {}
              segmentsRef.current.push(dest);
            }
            segmentActiveRef.current = false;
          },
          onRecordingError: (e: any) => {
            console.warn('[segment error startRecording]', e);
            segmentActiveRef.current = false;
            Alert.alert(
              'Recording error',
              (e && (e.message || e.toString())) || 'Unknown camera error',
            );
          },
        });
      } else if (typeof cam.recordAsync === 'function') {
        // recordAsync path
        recordPromiseRef.current = cam
          .recordAsync({ mute: false })
          .then(async (res: any) => {
            const uri = typeof res === 'string' ? res : res?.uri;
            if (uri) {
              const dest = SEG_DIR + `seg_${tsStamp()}.mp4`;
              try {
                await FileSystem.copyAsync({ from: uri, to: dest });
              } catch {}
              try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
              } catch {}
              segmentsRef.current.push(dest);
            }
            segmentActiveRef.current = false;
          })
          .catch((e: any) => {
            console.warn('[segment error recordAsync]', e);
            segmentActiveRef.current = false;
            Alert.alert(
              'Recording error',
              (e && (e.message || e.toString())) || 'Unknown camera error',
            );
          });
      } else {
        throw new Error('No recording API found on CameraView');
      }
    } catch (e: any) {
      console.warn('[segment start exception]', e);
      segmentActiveRef.current = false;
      Alert.alert('Recording error', e?.message ?? String(e));
    }
  };

  const stopCurrentSegment = async () => {
    const cam: any = cameraRef.current;
    try {
      cam?.stopRecording?.();
    } catch {}
    await waitFor(() => !segmentActiveRef.current, 2500);
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
        Alert.alert(
          'Microphone needed',
          'Enable microphone to record audio.',
        );
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
    await startNewSegment();
  };

  const handlePause = async () => {
    if (!isRecording || isPaused) return;
    pauseStartedAtRef.current = Date.now();
    setIsPaused(true);
    await stopCurrentSegment();
  };

  const handleResume = async () => {
    if (!isRecording || !isPaused) return;
    if (pauseStartedAtRef.current) {
      totalPausedMsRef.current +=
        Date.now() - pauseStartedAtRef.current;
    }
    pauseStartedAtRef.current = null;
    setIsPaused(false);
    await startNewSegment();
  };

  const handleStop = async () => {
    if (!isRecording || isProcessing) return;

    if (isPaused && pauseStartedAtRef.current) {
      totalPausedMsRef.current +=
        Date.now() - pauseStartedAtRef.current;
    }
    pauseStartedAtRef.current = null;

    await stopCurrentSegment();

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
        return Math.round(effectiveElapsed / 1000) - HILITE_DURATION_SEC;
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
              pointerEvents={
                isPaused ? ('none' as any) : ('box-none' as any)
              }
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
          <Text
            style={{
              color: 'white',
              marginTop: 20,
              fontWeight: '700',
            }}
          >
            Saving and processing video...
          </Text>
          <Text
            style={{ color: 'gray', marginTop: 5, fontSize: 12 }}
          >
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
            <Text style={{ color: 'white', fontWeight: '800' }}>
              Back
            </Text>
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
            <Text
              style={{
                color: 'white',
                fontWeight: '800',
                fontSize: 14,
              }}
            >
              {cameraReady ? 'Ready' : 'Opening camera…'} —{' '}
              {athlete || 'Unassigned'}
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
              <Text
                style={{ color: 'white', fontWeight: '600' }}
              >
                Start
              </Text>
            </TouchableOpacity>

            {/* star shown but disabled before recording */}
            <View style={{ marginLeft: 6 }}>
              <HighlightButton
                onPress={addHighlight}
                disabled={true}
                count={markers.length}
              />
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
                <Text
                  style={{ color: 'white', fontWeight: '700' }}
                >
                  Pause
                </Text>
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
                <Text
                  style={{ color: 'black', fontWeight: '800' }}
                >
                  Resume
                </Text>
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
              <Text
                style={{ color: 'black', fontWeight: '600' }}
              >
                Stop
              </Text>
            </TouchableOpacity>

            {/* star at far right when recording; disabled if paused/processing */}
            <View style={{ marginLeft: 6 }}>
              <HighlightButton
                onPress={addHighlight}
                disabled={isPaused || isProcessing}
                count={markers.length}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

async function finalizeRecording(
  segments: string[],
  chosenAthlete: string,
  sportKey: string,
  markers: number[],
  events: MatchEvent[],
  score: { home: number; opponent: number },
) {
  const HILITE_DURATION_SEC = 10;
  let finalPath: string | null = null;

  if (segments.length === 0) {
    Alert.alert(
      'Nothing recorded',
      'Try recording at least a second before stopping.',
    );
    return;
  }

  if (segments.length === 1) {
    // Single segment: just use it
    finalPath = segments[0];
  } else {
    // ✅ Use the new stitcher with Android fallback
    const { ok, finalPath: stitchedPath } =
      await stitchSegmentsWithFallback(segments);

    if (!ok || !stitchedPath) {
      Alert.alert('Save error', 'Failed to stitch segments.');
      return;
    }

    finalPath = stitchedPath;
  }

  const { appUri, assetId } = await saveToAppStorage(
    finalPath,
    chosenAthlete,
    sportKey,
  );

  let processedClips: { url: string; markerTime: number }[] = [];
  if (appUri && markers.length > 0) {
    processedClips = await processHighlights(
      appUri,
      markers,
      HILITE_DURATION_SEC,
      chosenAthlete,
    );
  }

  if (appUri) {
    const jsonUri = appUri.replace(/\.[^/.]+$/, '') + '.json';
    const payload = {
      athlete: chosenAthlete,
      sport: sportKey.split(':')[0],
      style: sportKey.split(':')[1],
      createdAt: Date.now(),
      events,
      finalScore: score,
      homeIsAthlete: true,
      highlights: markers.map((t) => ({
        t,
        duration: HILITE_DURATION_SEC,
      })),
      processedClips,
    };
    await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(payload));
  }

  // clean up segments
  for (const seg of segments) {
    try {
      await FileSystem.deleteAsync(seg, { idempotent: true });
    } catch {}
  }

  Alert.alert(
    'Recording saved',
    `Athlete: ${chosenAthlete}\nSegments: ${
      segments.length
    }\nHighlights: ${processedClips.length} of ${
      markers.length
    }\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}`,
  );
}
