// app/record/camera.tsx
// Stable camera + overlay + Photos albums + quick-switch athlete chip (no sticky memory)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WrestlingFolkstyleOverlay from '../../components/overlays/WrestlingFolkstyleOverlay';
import type { OverlayEvent } from '../../components/overlays/types';

const CURRENT_ATHLETE_KEY = 'currentAthleteName';

type VideoMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  createdAt: number;
  assetId?: string;
};

const VIDEOS_DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = VIDEOS_DIR + 'index.json';

const ensureDir = async (dir: string) => { try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {} };
const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
const tsStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
const paramToStr = (v: unknown, fallback = '') => Array.isArray(v) ? String(v[0] ?? fallback) : (v == null ? fallback : String(v));

async function readIndex(): Promise<VideoMeta[]> {
  try {
    const info = await FileSystem.getInfoAsync(INDEX_PATH);
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

export default function CameraScreen() {
  // params
  const params = useLocalSearchParams<{ athlete?: string | string[]; sport?: string | string[]; style?: string | string[] }>();

  // 🔁 Neutral defaults: only show overlays when passed in explicitly
  const athleteParamIncluded = typeof params.athlete !== 'undefined';
  const athleteParam = paramToStr(params.athlete, 'Unassigned');
  const sportParam = paramToStr(params.sport, 'plain'); // was 'wrestling'
  const styleParam = paramToStr(params.style, 'none');  // was 'folkstyle'

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

  // 🔵 current athlete (chip)
  const [athlete, setAthlete] = useState<string>('Unassigned');

  // init athlete: route param wins; otherwise gently fall back to last chosen
  useEffect(() => {
    (async () => {

      if (athleteParamIncluded) {
        // Route param wins (from style picker / direct nav)
        setAthlete((athleteParam || '').trim() || 'Unassigned');
      } else {
        // Safety net: if no param, use last chosen athlete from Home (if any)
        try {
          const last = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
          setAthlete((last || '').trim() || 'Unassigned');
        } catch {
          setAthlete('Unassigned');
        }
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

  useEffect(() => {
    try { (navigation as any)?.setOptions?.({ headerShown: false }); } catch {}
    return () => { try { (navigation as any)?.setOptions?.({ headerShown: true }); } catch {} };
  }, [navigation]);

  // If screen loses focus while recording, stop cleanly
useEffect(() => {
  if (!isFocused && isRecording) {
    try { (cameraRef.current as any)?.stopRecording?.(); } catch {}
    setIsRecording(false);
  }
}, [isFocused, isRecording]);

// On unmount, ensure recording is stopped
useEffect(() => {
  return () => {
    try { (cameraRef.current as any)?.stopRecording?.(); } catch {}
  };
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

  const sportKey = `${sportParam}:${styleParam || 'unknown'}`;
  const isFolkstyle = sportParam.toLowerCase() === 'wrestling' && styleParam.toLowerCase() === 'folkstyle';

  const handleStart = async () => {
    if (isRecording) return;
    if (!micPerm?.granted) {
      const r = await requestMicPerm();
      if (!r?.granted) { Alert.alert('Microphone needed', 'Enable microphone to record audio.'); return; }
    }
    setStartMs(Date.now()); setIsRecording(true);
  
    const cam: any = cameraRef.current;
    try {
      if (cam?.startRecording) {
        cam.startRecording({
          mute: false,
          onRecordingFinished: async (res: any) => {
            const uri = typeof res === 'string' ? res : res?.uri;
            if (!uri) { Alert.alert('No file created', 'Recording finished without a URI.'); setIsRecording(false); return; }
            const chosen = (athlete || '').trim() || 'Unassigned';
            const { appUri, assetId } = await saveToAppStorage(uri, chosen, sportKey);
            Alert.alert('Recording saved', `Athlete: ${chosen}\nSport: ${sportKey}\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}\nFile: ${appUri ?? 'n/a'}`);
            setIsRecording(false);
          },
          onRecordingError: (e: any) => {
            console.log('startRecording error:', e);
            const msg = e instanceof Error ? e.message : String(e);
            Alert.alert('Recording error', msg);
            setIsRecording(false);
          },
        });
      } else if (cam?.recordAsync) {
        cam.recordAsync({ mute: false }).then(async (res: any) => {
          const uri = typeof res === 'string' ? res : res?.uri;
          if (!uri) { Alert.alert('No file created', 'Recording finished without a URI.'); setIsRecording(false); return; }
          const chosen = (athlete || '').trim() || 'Unassigned';
          const { appUri, assetId } = await saveToAppStorage(uri, chosen, sportKey);
          Alert.alert('Recording saved', `Athlete: ${chosen}\nSport: ${sportKey}\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}\nFile: ${appUri ?? 'n/a'}`);
          setIsRecording(false);
        }).catch((e: any) => {
          console.log('recordAsync error:', e);
          const msg = e instanceof Error ? e.message : String(e);
          Alert.alert('Recording error', msg);
          setIsRecording(false);
        });
      } else {
        throw new Error('No recording API found on CameraView');
      }
    } catch (e: any) {
      console.log('record start threw:', e);
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Recording error', msg);
      setIsRecording(false);
    }
  };
  
  const handleStop = async () => {
    if (!isRecording) return;
    const cam: any = cameraRef.current;
    try { cam?.stopRecording?.(); } catch {}
    setIsRecording(false);
  };
  

  // UI pieces
  const AthleteBadge = () => (
    <View
      style={{
        paddingVertical: 4,              // slightly smaller
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
      }}
    >
      <Text
        style={{ color: 'white', fontWeight: '800', fontSize: 13 }} // slightly smaller text
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        Recording — {athlete || 'Unassigned'}
      </Text>
    </View>
  );
  

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

      {!isRecording && (
        <>
          {/* Back button row (top-left) */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 8,
              left: 12,
              zIndex: 6, // keep above overlay
            }}
          >
            <TouchableOpacity
              onPress={() => (navigation as any)?.goBack?.()}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
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

          {/* Athlete chip on its own line, centered, below overlay header row */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 52, // push below your overlay's top buttons
              left: 12,
              right: 12,
              alignItems: 'center',
              zIndex: 6,
            }}
          >
            <AthleteBadge />
          </View>
        </>
      )}

      {showOverlay ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' as any }}>
          {isFolkstyle ? (
            <WrestlingFolkstyleOverlay
              isRecording={isRecording}
              onEvent={(evt: OverlayEvent) => {}}
              getCurrentTSec={() => Math.max(0, Math.round(((Date.now() - (startMs ?? Date.now())) / 1000)) - 3)}
              sport={sportParam}
              style={styleParam}
            />
          ) : (
            <Text style={{ color: 'white', position: 'absolute', top: insets.top + 12, left: 12 }}>
              {sportParam === 'plain' ? 'Plain camera (no overlay)' : `No overlay registered for ${sportParam}:${styleParam}`}
            </Text>
          )}
        </View>
      ) : null}

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
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


