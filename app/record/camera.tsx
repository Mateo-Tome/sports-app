// app/record/camera.tsx
// Stable camera + overlay + Photos albums
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

// ---------- constants ----------
const CURRENT_ATHLETE_KEY = 'currentAthleteName';

type VideoMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  createdAt: number;
  assetId?: string; // Photos asset id if imported
};

const VIDEOS_DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = VIDEOS_DIR + 'index.json';

const ensureDir = async (dir: string) => {
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
};

const slug = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown';

const tsStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

async function appendVideoIndex(entry: VideoMeta) {
  try {
    await ensureDir(VIDEOS_DIR);
    const info = await FileSystem.getInfoAsync(INDEX_PATH);
    let list: VideoMeta[] = [];
    if ((info as any)?.exists) {
      const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
      list = JSON.parse(raw || '[]');
    }
    list.unshift(entry);
    await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(list));
  } catch (e) {
    console.log('appendVideoIndex error:', e);
    Alert.alert('Index write failed', String((e as any)?.message ?? e));
  }
}

// Import the saved file to Photos & add to Athlete and Athlete—Sport albums (no duplicate storage).
async function importToPhotosAndAlbums(
  fileUri: string,
  athlete: string,
  sport: string
): Promise<string | undefined> {
  const { granted } = await MediaLibrary.requestPermissionsAsync();
  if (!granted) return undefined;

  // Create Photos asset (imports once)
  const asset = await MediaLibrary.createAssetAsync(fileUri);

  const athleteName = (athlete?.trim() || 'Unassigned');
  const sportName = (sport?.trim() || 'unknown');
  const athleteAlbumName = athleteName;
  const sportAlbumName = `${athleteName} — ${sportName}`;

  // Ensure Athlete album
  let athleteAlbum = await MediaLibrary.getAlbumAsync(athleteAlbumName);
  if (!athleteAlbum) {
    athleteAlbum = await MediaLibrary.createAlbumAsync(athleteAlbumName, asset, false);
  } else {
    await MediaLibrary.addAssetsToAlbumAsync([asset], athleteAlbum, false);
  }

  // Ensure Athlete — Sport album
  let sportAlbum = await MediaLibrary.getAlbumAsync(sportAlbumName);
  if (!sportAlbum) {
    sportAlbum = await MediaLibrary.createAlbumAsync(sportAlbumName, asset, false);
  } else {
    await MediaLibrary.addAssetsToAlbumAsync([asset], sportAlbum, false);
  }

  return asset.id;
}

const saveToAppStorage = async (
  srcUri?: string | null,
  athleteRaw?: string,
  sportRaw?: string
): Promise<{ appUri: string | null; assetId?: string }> => {
  if (!srcUri) {
    Alert.alert('No video URI', 'Recording did not return a file path.');
    return { appUri: null };
  }
  const athlete = (athleteRaw || 'Unassigned').trim();
  const sport = (sportRaw || 'unknown').trim();
  const athleteSlug = slug(athlete);
  const sportSlug = slug(sport);

  try {
    const dir = `${VIDEOS_DIR}${athleteSlug}/${sportSlug}/`;
    await ensureDir(dir);

    const ext = srcUri.split('.').pop()?.split('?')[0] || 'mp4';
    const filename = `match_${tsStamp()}.${ext}`;
    const destUri = dir + filename;

    await FileSystem.copyAsync({ from: srcUri, to: destUri });

    const copied = await FileSystem.getInfoAsync(destUri);
    if (!(copied as any)?.exists) {
      Alert.alert('Save failed', 'Copied file was not found afterward.');
      return { appUri: null };
    }

    const displayName = `${athlete} — ${sport} — ${new Date().toLocaleString()}`;

    // Import into Photos and add to albums (no extra storage)
    let assetId: string | undefined;
    try {
      assetId = await importToPhotosAndAlbums(destUri, athlete, sport);
    } catch (e) {
      console.log('importToPhotosAndAlbums error:', e);
      // keep going; not fatal
    }

    await appendVideoIndex({
      uri: destUri,
      displayName,
      athlete,
      sport,
      createdAt: Date.now(),
      assetId,
    });

    return { appUri: destUri, assetId };
  } catch (e: any) {
    console.log('saveToAppStorage error:', e);
    Alert.alert('Save failed', String(e?.message ?? e));
    return { appUri: null };
  }
};

// ---------- component ----------
export default function CameraScreen() {
  // UPDATED: include athlete from route
  const { sport = 'wrestling', style = 'folkstyle', athlete: athleteParam } =
    useLocalSearchParams<{ sport?: string; style?: string; athlete?: string }>();

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
  const [events, setEvents] = useState<any[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const [currentAthlete, setCurrentAthlete] = useState<string>('Unassigned');

  // Load current athlete from AsyncStorage (fallback)
  useEffect(() => {
    (async () => {
      try {
        const ca = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
        if (ca && ca.trim()) setCurrentAthlete(ca.trim());
      } catch {}
    })();
  }, []);

  // OPTIONAL: request Photos permission early so import/album works first time
  useEffect(() => {
    (async () => {
      try { await MediaLibrary.requestPermissionsAsync(); } catch {}
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interaction: { cancel?: () => void } | null = null;

    async function prepAndMount() {
      try {
        if (!permission?.granted) return;
        if (!micPerm?.granted) {
          try { await requestMicPerm(); } catch {}
        }
        setShowOverlay(false);
        interaction = InteractionManager.runAfterInteractions(() => {
          if (!cancelled) {
            setCamKey((k) => k + 1);
            setMountCam(true);
          }
        });
      } catch {}
    }

    if (isFocused && permission?.granted) {
      prepAndMount();
    } else {
      setMountCam(false);
      setShowOverlay(false);
    }

    return () => {
      cancelled = true;
      interaction?.cancel?.();
    };
  }, [isFocused, permission?.granted, micPerm?.granted, requestMicPerm]);

  const handleCameraLayout = () => {
    setShowOverlay((prev) => {
      if (prev) return prev;
      setTimeout(() => setShowOverlay(true), 60);
      return prev;
    });
  };

  const getCurrentTSec = () => {
    if (!startMs) return 0;
    const raw = Math.round((Date.now() - startMs) / 1000) - 3;
    return raw < 0 ? 0 : raw;
  };

  const onEvent = (evt: OverlayEvent) =>
    setEvents((prev) => [...prev, { ...evt, t: getCurrentTSec() }]);

  useEffect(() => {
    try { (navigation as any)?.setOptions?.({ headerShown: false }); } catch {}
    return () => { try { (navigation as any)?.setOptions?.({ headerShown: true }); } catch {} };
  }, [navigation]);

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

  const handleStart = async () => {
    if (isRecording) return;

    if (!micPerm?.granted) {
      const r = await requestMicPerm();
      if (!r?.granted) {
        Alert.alert('Microphone needed', 'Enable microphone to record audio.');
        return;
      }
    }

    setEvents([]);
    setVideoUri(null);
    setStartMs(Date.now());
    setIsRecording(true);

    try {
      const recPromise = (cameraRef.current as any)?.recordAsync?.({ mute: false });

      recPromise
        ?.then(async (res: any) => {
          const uri = typeof res === 'string' ? res : res?.uri;
          if (!uri) {
            Alert.alert('No file created', 'Recording finished without a URI.');
            return;
          }
          setVideoUri(uri);

          // UPDATED: prefer athlete from params, fallback to AsyncStorage current
          const athleteName = (athleteParam && String(athleteParam).trim())
            ? String(athleteParam).trim()
            : (currentAthlete || 'Unassigned');

          const sportKey = `${String(sport)}:${String(style)}`;

          const { appUri, assetId } = await saveToAppStorage(uri, athleteName, sportKey);

          Alert.alert(
            'Recording saved',
            `Athlete: ${athleteName}\nSport: ${sportKey}\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}\nFile: ${appUri ?? 'n/a'}`
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
      {permission.granted && isFocused && mountCam ? (
        <CameraView
          key={camKey}
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          mode="video"
          onLayout={handleCameraLayout}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: 'black' }} />
      )}

      {!isRecording && (
        <View style={{ position: 'absolute', top: insets.top + 8, left: insets.left + 8 }}>
          <TouchableOpacity
            onPress={() => (navigation as any)?.goBack?.()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {showOverlay && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' as any }}>
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
