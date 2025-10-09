// app/record/camera.tsx
// Stable camera + overlay + Photos albums + quick-switch athlete chip + live score + PAUSE/RESUME
// + Highlight markers (Expo Go-safe) with golden gradient button & sparkle pop.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  InteractionManager,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WrestlingFolkstyleOverlay from '../../components/overlays/WrestlingFolkstyleOverlay';
import type { OverlayEvent } from '../../components/overlays/types';

const CURRENT_ATHLETE_KEY = 'currentAthleteName';

type VideoMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string; // e.g., "wrestling:folkstyle"
  createdAt: number;
  assetId?: string;
};

const VIDEOS_DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = VIDEOS_DIR + 'index.json';

const ensureDir = async (dir: string) => { try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {} };
const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
const tsStamp = () => {
  const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
const paramToStr = (v: unknown, fallback = '') => Array.isArray(v) ? String(v[0] ?? fallback) : (v == null ? fallback : String(v));

async function readIndex(): Promise<VideoMeta[]> {
  try {
    const info = await FileSystem.getInfoAsync(INDEX_PATH);
    // @ts-ignore
    if (!(info as any)?.exists) return [];
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
async function writeIndexAtomic(list: VideoMeta[]) {
  const tmp = INDEX_PATH + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(list));
  try { await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true }); } catch {}
  await FileSystem.moveAsync({ from: tmp, to: INDEX_PATH });
}
async function appendVideoIndex(entry: VideoMeta) {
  await ensureDir(VIDEOS_DIR);
  const list = await readIndex();
  list.unshift(entry);
  await writeIndexAtomic(list);
}

async function importToPhotosAndAlbums(fileUri: string, athlete: string, sport: string) {
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) return undefined;
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    const athleteName = (athlete?.trim() || 'Unassigned');
    const sportName = (sport?.trim() || 'unknown');
    const athleteAlbumName = athleteName;
    const sportAlbumName = `${athleteName} — ${sportName}`;
    let a = await MediaLibrary.getAlbumAsync(athleteAlbumName);
    if (!a) a = await MediaLibrary.createAlbumAsync(athleteAlbumName, asset, false);
    else await MediaLibrary.addAssetsToAlbumAsync([asset], a, false);
    let s = await MediaLibrary.getAlbumAsync(sportAlbumName);
    if (!s) s = await MediaLibrary.createAlbumAsync(sportAlbumName, asset, false);
    else await MediaLibrary.addAssetsToAlbumAsync([asset], s, false);
    return asset.id;
  } catch { return undefined; }
}

// Save the mp4 into app storage + update global index + optional Photos import
const saveToAppStorage = async (srcUri?: string | null, athleteRaw?: string, sportRaw?: string) => {
  if (!srcUri) { Alert.alert('No video URI', 'Recording did not return a file path.'); return { appUri: null as string | null }; }
  const athlete = (athleteRaw || '').trim() || 'Unassigned';
  const sport = (sportRaw || '').trim() || 'unknown';
  const dir = `${VIDEOS_DIR}${slug(athlete)}/${slug(sport)}/`; await ensureDir(dir);
  const ext = srcUri.split('.').pop()?.split('?')[0] || 'mp4';
  const filename = `match_${tsStamp()}.${ext}`;
  const destUri = dir + filename;
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  try { await FileSystem.deleteAsync(srcUri, { idempotent: true }); } catch {}
  const displayName = `${athlete} — ${sport} — ${new Date().toLocaleString()}`;
  const assetId = await importToPhotosAndAlbums(destUri, athlete, sport);
  await appendVideoIndex({ uri: destUri, displayName, athlete, sport, createdAt: Date.now(), assetId });
  return { appUri: destUri, assetId };
};

// ---------- Sidecar event & score ----------
type Actor = 'home' | 'opponent' | 'neutral';
type MatchEvent = {
  t: number; // seconds since record start (with preroll)
  kind: string;
  points?: number;
  actor: Actor;
  meta?: Record<string, any>;
  scoreAfter?: { home: number; opponent: number };
};

export default function CameraScreen() {
  // params
  const params = useLocalSearchParams<{ athlete?: string | string[]; sport?: string | string[]; style?: string | string[] }>();
  const athleteParamIncluded = typeof params.athlete !== 'undefined';
  const athleteParam = paramToStr(params.athlete, 'Unassigned');
  const sportParam = paramToStr(params.sport, 'plain');
  const styleParam = paramToStr(params.style, 'none');
  const sportKey = `${sportParam}:${styleParam || 'unknown'}`;
  const isFolkstyle = sportParam.toLowerCase() === 'wrestling' && styleParam.toLowerCase() === 'folkstyle';

  const [permission, requestPermission] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const [mountCam, setMountCam] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);

  // current athlete (chip)
  const [athlete, setAthlete] = useState<string>('Unassigned');

  // events buffer
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const eventsRef = useRef<MatchEvent[]>([]); // authoritative buffer

  // running score
  const [score, setScore] = useState<{ home: number; opponent: number }>({ home: 0, opponent: 0 });
  const scoreRef = useRef<{ home: number; opponent: number }>({ home: 0, opponent: 0 });

  // soft pause bookkeeping
  const [isPaused, setIsPaused] = useState(false);
  const pauseStartedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);

  // highlights (10s windows) + sparkle
  const [markers, setMarkers] = useState<number[]>([]);
  const HILITE_DURATION_SEC = 10;
  const sparkleScale = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  // nav-after-stop flag so Back works while recording
  const goBackAfterStopRef = useRef(false);

  const playSparkle = () => {
    sparkleScale.setValue(0.2);
    sparkleOpacity.setValue(0.0);
    Animated.parallel([
      Animated.timing(sparkleScale, { toValue: 1.4, duration: 320, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(sparkleOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(sparkleOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    });
  };

  // init athlete
  useEffect(() => {
    (async () => {
      if (athleteParamIncluded) setAthlete((athleteParam || '').trim() || 'Unassigned');
      else {
        try { const last = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY); setAthlete((last || '').trim() || 'Unassigned'); }
        catch { setAthlete('Unassigned'); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mount/unmount camera
  useEffect(() => {
    let cancelled = false; let interaction: { cancel?: () => void } | null = null;
    async function prep() {
      if (!permission?.granted) return;
      if (!micPerm?.granted) { try { await requestMicPerm(); } catch {} }
      setShowOverlay(false);
      interaction = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) { setCamKey(k => k + 1); setMountCam(true); }
      });
    }
    if (isFocused && permission?.granted) prep();
    else { setMountCam(false); setShowOverlay(false); }
    return () => { cancelled = true; interaction?.cancel?.(); };
  }, [isFocused, permission?.granted, micPerm?.granted, requestMicPerm]);

  // IMPORTANT: Do NOT mess with headers here. (Selection screen manages its own header/back)

  // If screen loses focus while recording, stop cleanly
  useEffect(() => {
    if (!isFocused && isRecording) {
      try { (cameraRef.current as any)?.stopRecording?.(); } catch {}
      setIsRecording(false);
      setIsPaused(false);
      pauseStartedAtRef.current = null;
    }
  }, [isFocused, isRecording]);

  // On unmount, ensure recording is stopped
  useEffect(() => {
    return () => { try { (cameraRef.current as any)?.stopRecording?.(); } catch {} };
  }, []);

  if (!permission) return <View style={{ flex: 1, backgroundColor: 'black' }} />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: 'white' }}>We need camera permission</Text>
        <TouchableOpacity onPress={requestPermission} style={{ padding: 12, borderWidth: 1, borderRadius: 8, borderColor: 'white' }}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- time helpers (paused-aware) ----
  const getCurrentTSec = () => {
    const start = startMs ?? Date.now();
    const pausedNow = isPaused && pauseStartedAtRef.current ? (Date.now() - pauseStartedAtRef.current) : 0;
    const effectiveElapsed = (Date.now() - start) - totalPausedMsRef.current - pausedNow;
    return Math.max(0, Math.round(effectiveElapsed / 1000) - 3); // -3s preroll
  };

  const handleOverlayEvent = (evt: OverlayEvent) => {
    if (!isRecording || isPaused) return;

    const t = getCurrentTSec();
    const kind = String(evt.key ?? 'unknown');
    const points = Number.isFinite(evt.value) ? Number(evt.value) : undefined;
    const actor: 'home' | 'opponent' | 'neutral' = (evt.actor === 'home' || evt.actor === 'opponent') ? evt.actor : 'neutral';

    // Update running score
    if (typeof points === 'number' && points > 0) {
      if (actor === 'home') scoreRef.current = { ...scoreRef.current, home: scoreRef.current.home + points };
      else if (actor === 'opponent') scoreRef.current = { ...scoreRef.current, opponent: scoreRef.current.opponent + points };
      setScore(scoreRef.current);
    }

    // Buffer event
    const item: MatchEvent = { t, kind, points, actor, meta: evt as any, scoreAfter: { ...scoreRef.current } };
    eventsRef.current = [...eventsRef.current, item];
  };

  // ---- sidecar writer ----
  const writeSidecarJson = async (appUri: string) => {
    try {
      const jsonUri = appUri.replace(/\.[^/.]+$/, '') + '.json';
      const payload = {
        athlete,
        sport: sportParam,
        style: styleParam,
        createdAt: Date.now(),
        events: eventsRef.current,
        finalScore: { ...scoreRef.current },
        homeIsAthlete: true,
        appVersion: 1,
        highlights: markers.map((t) => ({ t, duration: HILITE_DURATION_SEC })),
      };
      await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(payload));
      return jsonUri;
    } catch { return null; }
  };

  // ---- record flow (CameraView) ----
  const handleStart = async () => {
    if (isRecording) return;
    if (!micPerm?.granted) {
      const r = await requestMicPerm();
      if (!r?.granted) { Alert.alert('Microphone needed', 'Enable microphone to record audio.'); return; }
    }
    // reset state
    eventsRef.current = []; setEvents([]);
    scoreRef.current = { home: 0, opponent: 0 }; setScore(scoreRef.current);
    setStartMs(Date.now());
    totalPausedMsRef.current = 0; pauseStartedAtRef.current = null;
    setIsPaused(false); setIsRecording(true);
    setMarkers([]);

    const chosen = (athlete || '').trim() || 'Unassigned';
    try { await AsyncStorage.setItem(CURRENT_ATHLETE_KEY, chosen); } catch {}

    const cam: any = cameraRef.current;
    try {
      if (cam?.startRecording) {
        cam.startRecording({
          mute: false,
          onRecordingFinished: async (res: any) => {
            const uri = typeof res === 'string' ? res : res?.uri;
            if (!uri) { Alert.alert('No file created', 'Recording finished without a URI.'); setIsRecording(false); return; }

            const { appUri, assetId } = await saveToAppStorage(uri, chosen, sportKey);
            if (appUri) await writeSidecarJson(appUri);

            Alert.alert('Recording saved',
              `Athlete: ${chosen}\nSport: ${sportKey}\nHighlights marked: ${markers.length}\n(Clips are referenced in sidecar; cut in a dev build)\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}`);
            setIsRecording(false);
            setIsPaused(false);

            if (goBackAfterStopRef.current) {
              goBackAfterStopRef.current = false;
              (navigation as any)?.goBack?.();
            }
          },
          onRecordingError: (e: any) => {
            const msg = e instanceof Error ? e.message : String(e);
            Alert.alert('Recording error', msg);
            setIsRecording(false);
            setIsPaused(false);
            if (goBackAfterStopRef.current) {
              goBackAfterStopRef.current = false;
              (navigation as any)?.goBack?.();
            }
          },
        });
      } else if (cam?.recordAsync) {
        cam.recordAsync({ mute: false }).then(async (res: any) => {
          const uri = typeof res === 'string' ? res : res?.uri;
          if (!uri) { Alert.alert('No file created', 'Recording finished without a URI.'); setIsRecording(false); return; }
          const { appUri, assetId } = await saveToAppStorage(uri, chosen, sportKey);
          if (appUri) await writeSidecarJson(appUri);
          Alert.alert('Recording saved',
            `Athlete: ${chosen}\nSport: ${sportKey}\nHighlights marked: ${markers.length}\n(Clips are referenced in sidecar; cut in a dev build)\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}`);
          setIsRecording(false);
          setIsPaused(false);
          if (goBackAfterStopRef.current) {
            goBackAfterStopRef.current = false;
            (navigation as any)?.goBack?.();
          }
        }).catch((e: any) => {
          const msg = e instanceof Error ? e.message : String(e);
          Alert.alert('Recording error', msg);
          setIsRecording(false);
          setIsPaused(false);
          if (goBackAfterStopRef.current) {
            goBackAfterStopRef.current = false;
            (navigation as any)?.goBack?.();
          }
        });
      } else {
        throw new Error('No recording API found on CameraView');
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Recording error', msg);
      setIsRecording(false);
      setIsPaused(false);
      if (goBackAfterStopRef.current) {
        goBackAfterStopRef.current = false;
        (navigation as any)?.goBack?.();
      }
    }
  };

  const handleStop = () => {
    if (!isRecording) return;
    if (isPaused && pauseStartedAtRef.current) {
      totalPausedMsRef.current += (Date.now() - pauseStartedAtRef.current);
    }
    pauseStartedAtRef.current = null;
    setIsPaused(false);

    const cam: any = cameraRef.current;
    try { cam?.stopRecording?.(); } catch {}
    setIsRecording(false);
  };

  const handlePause = () => {
    if (!isRecording || isPaused) return;
    pauseStartedAtRef.current = Date.now();
    setIsPaused(true);
  };

  const handleResume = () => {
    if (!isRecording || !isPaused) return;
    if (pauseStartedAtRef.current) {
      totalPausedMsRef.current += (Date.now() - pauseStartedAtRef.current);
    }
    pauseStartedAtRef.current = null;
    setIsPaused(false);
  };

  // highlight marker (start time of last 10s)
  const addHighlight = () => {
    if (!isRecording || isPaused) return;
    const t = Math.max(0, getCurrentTSec() - HILITE_DURATION_SEC);
    setMarkers((m) => [...m, t]);
    playSparkle();
    Alert.alert('Highlight saved', `Marked a ${HILITE_DURATION_SEC}s window.\n(Clips are referenced in the sidecar JSON)`);
  };

  // UI: small badge
  const AthleteBadge = () => (
    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
      <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">
        Recording — {athlete || 'Unassigned'} {isRecording && isPaused ? '(Paused)' : ''}
      </Text>
    </View>
  );

  // Back button (ALWAYS visible). If recording, confirm -> stop -> auto-navigate once file is saved.
  const BackButton = () => (
    <View style={{ position: 'absolute', top: insets.top + 8, left: 12, zIndex: 6 }}>
      <TouchableOpacity
        onPress={() => {
          if (isRecording) {
            Alert.alert(
              'Stop recording?',
              'Going back will stop and save the current recording.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Stop & Go Back',
                  style: 'destructive',
                  onPress: () => {
                    goBackAfterStopRef.current = true;
                    handleStop();
                  },
                },
              ]
            );
          } else {
            (navigation as any)?.goBack?.();
          }
        }}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Golden highlight button (centered above controls)
  const HighlightButton = () =>
    isRecording && !isPaused ? (
      <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 86, left: 0, right: 0, alignItems: 'center' }}>
        <TouchableOpacity activeOpacity={0.85} onPress={addHighlight}>
          <LinearGradient
            colors={['#f7d774', '#d4a017', '#b88912']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2, borderColor: 'white', minWidth: 110, alignItems: 'center' }}
          >
            <Text style={{ color: '#111', fontWeight: '900' }}>★ Highlight</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* sparkle pop */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 36, transform: [{ scale: sparkleScale }], opacity: sparkleOpacity }}>
          <Text style={{ color: '#f8e08a', fontSize: 24, fontWeight: '900' }}>✦</Text>
        </Animated.View>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {permission.granted && isFocused && mountCam ? (
        <CameraView
          key={camKey}
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          mode="video"
          onLayout={() => setTimeout(() => setShowOverlay(true), 60)}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: 'black' }} />
      )}

      <BackButton />

      {!isRecording && (
        <View style={{ position: 'absolute', top: insets.top + 52, left: 12, right: 12, alignItems: 'center', zIndex: 6 }}>
          <AthleteBadge />
        </View>
      )}

      {showOverlay ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} pointerEvents={isPaused ? ('none' as any) : ('box-none' as any)}>
          {isFolkstyle ? (
            <WrestlingFolkstyleOverlay
              isRecording={isRecording}
              onEvent={handleOverlayEvent}
              getCurrentTSec={getCurrentTSec}
              sport={sportParam}
              style={styleParam}
              score={score}
            />
          ) : (
            <Text style={{ color: 'white', position: 'absolute', top: insets.top + 12, left: 12 }}>
              {sportParam === 'plain' ? 'Plain camera (no overlay)' : `No overlay registered for ${sportParam}:${styleParam}`}
            </Text>
          )}

          {isRecording && isPaused && (
            <View style={{ position: 'absolute', top: insets.top + 12, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                Paused
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Start / Pause / Resume / Stop */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
        {!isRecording ? (
          <TouchableOpacity onPress={handleStart} style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'red', borderRadius: 999 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Start</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!isPaused ? (
              <TouchableOpacity onPress={handlePause} style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white', borderRadius: 999 }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleResume} style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'white', borderRadius: 999 }}>
                <Text style={{ color: 'black', fontWeight: '800' }}>Resume</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleStop} style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'white', borderRadius: 999 }}>
              <Text style={{ color: 'black', fontWeight: '600' }}>Stop</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Golden Highlight button (centered, above controls) */}
      <HighlightButton />
    </View>
  );
}
