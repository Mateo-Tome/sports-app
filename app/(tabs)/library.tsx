// app/(tabs)/library.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = DIR + 'index.json';
const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';
const ATHLETES_KEY = 'athletes:list';

type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  createdAt: number;
  assetId?: string;
};
type Row = {
  uri: string;
  displayName: string;
  athlete?: string;
  sport?: string;
  size: number | null;
  mtime: number | null;
  thumbUri?: string | null;
  assetId?: string;
  resolvedUri?: string;
};
type AthleteProfile = { id: string; name: string; photoUri?: string | null };

// ---- ImagePicker version-proof shim ----
const MEDIA_TYPE_IMAGES: any =
  (ImagePicker as any)?.MediaType?.Images ??
  (ImagePicker as any)?.MediaTypeOptions?.Images;

// Reusable helper (camera or library) with deferred launch
async function pickImageWithChoice(): Promise<string | null> {
  const camPerm = await ImagePicker.getCameraPermissionsAsync();
  const libPerm = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (camPerm.status !== 'granted') {
    await ImagePicker.requestCameraPermissionsAsync();
  }
  if (libPerm.status !== 'granted') {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  }

  if (Platform.OS === 'web') {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: MEDIA_TYPE_IMAGES,
      allowsEditing: true,
      quality: 0.85,
    });
    return res.canceled ? null : res.assets?.[0]?.uri ?? null;
  }

  return new Promise((resolve) => {
    const defer = (fn: () => Promise<void>) =>
      setTimeout(() => { fn().catch(() => resolve(null)); }, 180);

    Alert.alert(
      'Set Athlete Photo',
      undefined,
      [
        {
          text: 'Take Photo',
          onPress: () =>
            defer(async () => {
              let cam = await ImagePicker.getCameraPermissionsAsync();
              if (cam.status !== 'granted') cam = await ImagePicker.requestCameraPermissionsAsync();
              if (cam.status !== 'granted') {
                let lib = await ImagePicker.getMediaLibraryPermissionsAsync();
                if (lib.status !== 'granted') lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (lib.status === 'granted') {
                  const libRes = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: MEDIA_TYPE_IMAGES,
                    allowsEditing: true,
                    quality: 0.85,
                  });
                  resolve(libRes.canceled ? null : libRes.assets?.[0]?.uri ?? null);
                } else {
                  resolve(null);
                }
                return;
              }

              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: MEDIA_TYPE_IMAGES,
                allowsEditing: true,
                quality: 0.85,
              });
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            }),
        },
        {
          text: 'Choose from Library',
          onPress: () =>
            defer(async () => {
              let lib = await ImagePicker.getMediaLibraryPermissionsAsync();
              if (lib.status !== 'granted') lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (lib.status !== 'granted') { resolve(null); return; }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: MEDIA_TYPE_IMAGES,
                allowsEditing: true,
                quality: 0.85,
              });
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            }),
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true }
    );
  });
}

async function ensureDir(dir: string) { try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {} }
function bytesToMB(b?: number | null) { return b == null ? '—' : (b / (1024 * 1024)).toFixed(2) + ' MB'; }

async function getOrCreateThumb(videoUri: string, fileName: string) {
  await ensureDir(THUMBS_DIR);
  const base = fileName.replace(/\.[^/.]+$/, '');
  const dest = `${THUMBS_DIR}${base}.jpg`;
  const info = await FileSystem.getInfoAsync(dest);
  if ((info as any)?.exists) return dest;
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000, quality: 0.6 });
    try { await FileSystem.copyAsync({ from: uri, to: dest }); } catch {}
    return dest;
  } catch { return null; }
}

async function resolvePlayableUri(meta: IndexMeta): Promise<{ playableUri: string | null; nameForThumb: string; src: 'app'|'photos' }> {
  try {
    const info = await FileSystem.getInfoAsync(meta.uri);
    if ((info as any)?.exists) {
      const name = meta.uri.split('/').pop() || meta.displayName || 'video';
      return { playableUri: meta.uri, nameForThumb: name, src: 'app' };
    }
  } catch {}
  if (meta.assetId) {
    try {
      const ainfo = await MediaLibrary.getAssetInfoAsync(meta.assetId);
      const playable = ainfo.localUri || ainfo.uri || null;
      if (playable) {
        const name = (playable.split('/').pop() || meta.displayName || 'video');
        return { playableUri: playable, nameForThumb: name, src: 'photos' };
      }
    } catch (e) { console.log('resolve photos error:', e); }
  }
  return { playableUri: null, nameForThumb: 'video', src: 'app' };
}

/** Safe video player */
export type PlayerHandle = { dispose: () => void };
const Player = forwardRef<PlayerHandle, { uri: string }>(function Player({ uri }, ref) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });
  const releasedRef = useRef(false);
  useEffect(() => { try { player.play(); } catch {} }, [player]);
  useImperativeHandle(ref, () => ({
    dispose: () => {
      if (releasedRef.current) return;
      try { player.pause(); } catch {}
      try { (player as any).release?.(); } catch {}
      releasedRef.current = true;
    },
  }), [player]);
  useEffect(() => () => {
    if (releasedRef.current) return;
    try { player.pause(); } catch {}
    try { (player as any).release?.(); } catch {}
    releasedRef.current = true;
  }, [player]);
  return <VideoView style={{ flex: 1 }} player={player} contentFit="contain" allowsFullscreen allowsPictureInPicture showsTimecodes />;
});

type ViewMode =
  | { kind: 'athletes' }
  | { kind: 'sports'; athlete: string }
  | { kind: 'videos'; athlete: string; sport: string };

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Row[]>([]);
  const [athleteProfiles, setAthleteProfiles] = useState<AthleteProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const playerRef = useRef<PlayerHandle>(null);

  const [editTarget, setEditTarget] = useState<{ uri: string; athlete: string; sport?: string; createdAt?: number } | null>(null);
  const [athleteName, setAthleteName] = useState('');

  const [mode, setMode] = useState<ViewMode>({ kind: 'athletes' });

  const load = useCallback(async () => {
    await ensureDir(DIR);

    const idxInfo = await FileSystem.getInfoAsync(INDEX_PATH);
    const rows: Row[] = [];
    if ((idxInfo as any)?.exists) {
      const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
      const list: IndexMeta[] = JSON.parse(raw || '[]');
      for (const meta of list) {
        const { playableUri, nameForThumb, src } = await resolvePlayableUri(meta);
        if (!playableUri) continue;

        let size: number | null = null;
        let mtime: number | null = meta.createdAt ?? null;
        if (src === 'app') {
          try {
            const info = await FileSystem.getInfoAsync(playableUri);
            size = (info as any)?.size ?? null;
            if ((info as any)?.modificationTime) mtime = Math.round(((info as any).modificationTime as number) * 1000);
          } catch {}
        }

        let thumb: string | null = null;
        if (src === 'app' && playableUri.startsWith('file://')) {
          thumb = await getOrCreateThumb(playableUri, nameForThumb);
        }

        rows.push({
          uri: meta.uri, displayName: meta.displayName, athlete: meta.athlete, sport: meta.sport,
          size, mtime, thumbUri: thumb, assetId: meta.assetId, resolvedUri: playableUri,
        });
      }
    }
    rows.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    setItems(rows);

    try {
      const rawA = await AsyncStorage.getItem(ATHLETES_KEY);
      const listA = rawA ? (JSON.parse(rawA) as AthleteProfile[]) : [];
      setAthleteProfiles(listA);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  const athletes = Array.from(new Set(items.map(i => (i.athlete?.trim() || 'Unassigned')))).sort((a,b)=>a.localeCompare(b));
  const sportsFor = (athlete: string) => {
    const set = new Set<string>();
    items.forEach(i => { if ((i.athlete?.trim() || 'Unassigned') === athlete) set.add(i.sport?.trim() || 'unknown'); });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  };
  const videosFor = (athlete: string, sport: string) =>
    items.filter(i => (i.athlete?.trim() || 'Unassigned') === athlete && (i.sport?.trim() || 'unknown') === sport);

  const photoForAthlete = (name: string) => athleteProfiles.find(p => p.name === name)?.photoUri ?? null;

  const addToAlbums = useCallback(async (row: Row) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) { Alert.alert('Photos permission needed', 'Allow access to add to albums.'); return; }
    try {
      let assetId = row.assetId;
      let asset;
      if (assetId) asset = await MediaLibrary.getAssetInfoAsync(assetId).catch(() => null);
      if (!asset && row.resolvedUri) { asset = await MediaLibrary.createAssetAsync(row.resolvedUri); assetId = asset.id; }
      if (!asset) throw new Error('Unable to create/find Photos asset.');
      const athlete = (row.athlete && row.athlete.trim()) || 'Unassigned';
      const sport = (row.sport && row.sport.trim()) || 'unknown';
      const aAlbum = await MediaLibrary.getAlbumAsync(athlete);
      const sAlbum = await MediaLibrary.getAlbumAsync(`${athlete} — ${sport}`);
      if (!aAlbum) await MediaLibrary.createAlbumAsync(athlete, asset, false); else await MediaLibrary.addAssetsToAlbumAsync([asset], aAlbum, false);
      if (!sAlbum) await MediaLibrary.createAlbumAsync(`${athlete} — ${sport}`, asset, false); else await MediaLibrary.addAssetsToAlbumAsync([asset], sAlbum, false);
      Alert.alert('Added to Albums', `• ${athlete}\n• ${athlete} — ${sport}`);
    } catch (e: any) { console.log('addToAlbums error:', e); Alert.alert('Album add failed', String(e?.message ?? e)); }
  }, []);

  const openEditInfo = (row: Row) => {
    setEditTarget({ uri: row.uri, athlete: row.athlete ?? '', sport: row.sport, createdAt: row.mtime ?? Date.now() });
    setAthleteName(row.athlete ?? '');
  };
  const applyEditInfo = useCallback(async () => {
    try {
      const info = await FileSystem.getInfoAsync(INDEX_PATH);
      if (!(info as any)?.exists) { Alert.alert('No index found', 'Record a new video first to create index.json.'); return; }
      const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
      const list: IndexMeta[] = JSON.parse(raw || '[]');
      if (!editTarget) return;
      const athlete = athleteName.trim();
      const updated = list.map((entry) => {
        if (entry.uri !== editTarget.uri) return entry;
        const createdAt = entry.createdAt ?? editTarget.createdAt ?? Date.now();
        const sport = entry.sport ?? editTarget.sport ?? 'unknown';
        const displayName = `${athlete || 'Unassigned'} — ${sport} — ${new Date(createdAt).toLocaleString()}`;
        return { ...entry, athlete: athlete || 'Unassigned', displayName };
      });
      await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(updated));
      setEditTarget(null); setAthleteName(''); await load();
    } catch (e: any) { console.log('applyEditInfo error:', e); Alert.alert('Update failed', String(e?.message ?? e)); }
  }, [editTarget, athleteName, load]);

  const deleteEverywhere = useCallback((row: Row) => {
    Alert.alert('Delete this video?', 'This will delete the app’s copy and (if present) also delete it from Photos.', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        try {
          try { await FileSystem.deleteAsync(row.uri, { idempotent:true }); } catch {}
          if (row.assetId) { try { await MediaLibrary.deleteAssetsAsync([row.assetId]); } catch (e) { console.log('Photos delete failed (continue):', e); } }
          const idxInfo = await FileSystem.getInfoAsync(INDEX_PATH);
          if ((idxInfo as any)?.exists) {
            const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
            const list: IndexMeta[] = JSON.parse(raw || '[]');
            const filtered = list.filter(e => e.uri !== row.uri);
            await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(filtered));
          }
          const name = row.uri.split('/').pop() || ''; const base = name.replace(/\.[^/.]+$/, '');
          const thumbPath = `${THUMBS_DIR}${base}.jpg`;
          const tInfo = await FileSystem.getInfoAsync(thumbPath);
          if ((tInfo as any)?.exists) { try { await FileSystem.deleteAsync(thumbPath, { idempotent:true }); } catch {} }
          setItems(prev => prev.filter(it => it.uri !== row.uri));
          Alert.alert('Deleted', 'The video was removed.');
        } catch (e: any) { console.log('deleteEverywhere error:', e); Alert.alert('Delete failed', String(e?.message ?? e)); }
      }} ]);
  }, []);

  const deleteAthlete = useCallback((athlete: string) => {
    Alert.alert(
      `Delete athlete “${athlete}”?`,
      'Choose what to do with their videos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep videos (mark Unassigned)',
          onPress: async () => {
            try {
              const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
              const list: IndexMeta[] = JSON.parse(raw || '[]');
              const updated = list.map(e => ( (e.athlete?.trim() || 'Unassigned') === athlete
                ? { ...e, athlete: 'Unassigned', displayName: `Unassigned — ${e.sport} — ${new Date(e.createdAt).toLocaleString()}` }
                : e ));
              await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(updated));
            } catch (e) { console.log('relabel error', e); }
            const rawA = await AsyncStorage.getItem(ATHLETES_KEY);
            const listA: AthleteProfile[] = rawA ? JSON.parse(rawA) : [];
            const filtered = listA.filter(p => p.name !== athlete);
            await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(filtered));
            await load();
            Alert.alert('Done', 'Athlete removed; videos kept as Unassigned.');
          }
        },
        {
          text: 'Delete athlete & ALL videos',
          style: 'destructive',
          onPress: async () => {
            try {
              const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
              const list: IndexMeta[] = JSON.parse(raw || '[]');
              const toDelete = list.filter(e => (e.athlete?.trim() || 'Unassigned') === athlete);
              for (const e of toDelete) {
                try { await FileSystem.deleteAsync(e.uri, { idempotent: true }); } catch {}
                if (e.assetId) { try { await MediaLibrary.deleteAssetsAsync([e.assetId]); } catch {} }
                const name = e.uri.split('/').pop() || ''; const base = name.replace(/\.[^/.]+$/, '');
                const thumbPath = `${THUMBS_DIR}${base}.jpg`;
                const tInfo = await FileSystem.getInfoAsync(thumbPath);
                if ((tInfo as any)?.exists) { try { await FileSystem.deleteAsync(thumbPath, { idempotent:true }); } catch {} }
              }
              const remaining = list.filter(e => (e.athlete?.trim() || 'Unassigned') !== athlete);
              await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(remaining));
              const rawA = await AsyncStorage.getItem(ATHLETES_KEY);
              const listA: AthleteProfile[] = rawA ? JSON.parse(rawA) : [];
              const filtered = listA.filter(p => p.name !== athlete);
              await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(filtered));
              await load();
              Alert.alert('Deleted', 'Athlete and all their videos were removed.');
            } catch (e: any) {
              console.log('delete athlete full error', e);
              Alert.alert('Delete failed', String(e?.message ?? e));
            }
          }
        },
      ]
    );
  }, [load]);

  const changeAthletePhotoHere = useCallback(async (athlete: string) => {
    const uri = await pickImageWithChoice();
    if (uri == null) return;
    const rawA = await AsyncStorage.getItem(ATHLETES_KEY);
    const listA: AthleteProfile[] = rawA ? JSON.parse(rawA) : [];
    const updated = listA.map(p => p.name === athlete ? { ...p, photoUri: uri } : p);
    await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(updated));
    setAthleteProfiles(updated);
  }, []);

  const AthleteCard = ({ name }: { name: string }) => {
    const photo = photoForAthlete(name);
    return (
      <View style={{ padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'white', opacity: 0.7, fontSize: 22 }}>👤</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => setMode({ kind: 'sports', athlete: name })} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'white' }}>
              <Text style={{ color: 'black', fontWeight: '800' }}>View Sports</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeAthletePhotoHere(name)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>{photo ? 'Change Photo' : 'Set Photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteAthlete(name)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(220,0,0,0.9)' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Delete Athlete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderVideo = ({ item }: { item: Row }) => {
    const dateStr = item.mtime ? new Date(item.mtime).toLocaleString() : '—';
    const subtitleBits = [ item.athlete ? `👤 ${item.athlete}` : null, item.sport ? `🏷️ ${item.sport}` : null, item.size != null ? `${bytesToMB(item.size)}` : null, dateStr ].filter(Boolean);
    return (
      <Pressable onPress={() => setPlayingUri(item.resolvedUri || item.uri)}
        style={{ padding:12, marginHorizontal:16, marginVertical:8, borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.12)', backgroundColor:'rgba(255,255,255,0.06)' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          {item.thumbUri ? (
            <Image source={{ uri: item.thumbUri }} style={{ width:96, height:54, borderRadius:8, backgroundColor:'rgba(255,255,255,0.1)' }} resizeMode="cover" />
          ) : (
            <View style={{ width:96, height:54, borderRadius:8, backgroundColor:'rgba(255,255,255,0.1)', justifyContent:'center', alignItems:'center' }}>
              <Text style={{ color:'white', opacity:0.6, fontSize:12 }}>No preview</Text>
            </View>
          )}
          <View style={{ flex:1 }}>
            <Text style={{ color:'white', fontWeight:'700' }} numberOfLines={2}>{item.displayName}</Text>
            <Text style={{ color:'white', opacity:0.7, marginTop:4 }} numberOfLines={1}>{subtitleBits.join(' • ')}</Text>
            <View style={{ flexDirection:'row', gap:12, marginTop:10, flexWrap:'wrap' }}>
              <TouchableOpacity onPress={() => setPlayingUri(item.resolvedUri || item.uri)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:999, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'white' }}>
                <Text style={{ color:'white', fontWeight:'700' }}>Play</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addToAlbums(item)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:999, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'white' }}>
                <Text style={{ color:'white', fontWeight:'700' }}>Add to Album</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditInfo(item)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:999, backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'white' }}>
                <Text style={{ color:'white', fontWeight:'700' }}>Edit Info</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteEverywhere(item)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:999, backgroundColor:'rgba(220,0,0,0.9)' }}>
                <Text style={{ color:'white', fontWeight:'800' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const Header = () => {
    const title =
      mode.kind === 'athletes' ? 'Library · Athletes' :
      mode.kind === 'sports'   ? `Athlete · ${mode.athlete}` :
                                 `Videos · ${mode.athlete} · ${mode.sport}`;
    return (
      <View style={{ paddingHorizontal:16, paddingBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <Text style={{ color:'white', fontSize:20, fontWeight:'800' }}>{title}</Text>
        <TouchableOpacity onPress={onRefresh} style={{ paddingVertical:6, paddingHorizontal:10, borderRadius:999, borderWidth:1, borderColor:'white' }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  let body: React.ReactNode = null;
  if (mode.kind === 'athletes') {
    body = (
      <View>
        {athletes.length === 0 ? (
          <Text style={{ color:'white', opacity:0.7, textAlign:'center', marginTop:40 }}>No recordings yet. Record a match, then come back.</Text>
        ) : (
          <FlatList data={athletes} keyExtractor={(a) => a} renderItem={({ item }) => <AthleteCard name={item} />} />
        )}
      </View>
    );
  } else if (mode.kind === 'sports') {
    const sports = sportsFor(mode.athlete);
    body = (
      <View style={{ paddingHorizontal: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
        <TouchableOpacity onPress={() => setMode({ kind: 'athletes' })} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:999, borderWidth:1, borderColor:'white', margin:6 }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Back to Athletes</Text>
        </TouchableOpacity>
        {sports.length === 0 ? (
          <Text style={{ color:'white', opacity:0.7, textAlign:'center', marginTop:40, width:'100%' }}>No sports found for this athlete yet.</Text>
        ) : sports.map(s => (
          <TouchableOpacity key={s} onPress={() => setMode({ kind:'videos', athlete: mode.athlete, sport: s })} style={{ paddingVertical:10, paddingHorizontal:14, borderRadius:999, backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', margin:6 }}>
            <Text style={{ color:'white', fontWeight:'800' }}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  } else {
    const vids = videosFor(mode.athlete, mode.sport);
    body = (
      <View style={{ flex:1 }}>
        <View style={{ paddingHorizontal:10, paddingBottom:8, flexDirection:'row', flexWrap:'wrap' }}>
          <TouchableOpacity onPress={() => setMode({ kind: 'sports', athlete: mode.athlete })} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:999, borderWidth:1, borderColor:'white', margin:6 }}>
            <Text style={{ color:'white', fontWeight:'800' }}>Back</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={vids}
          keyExtractor={(it) => it.uri}
          renderItem={renderVideo}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={<Text style={{ color:'white', opacity:0.7, textAlign:'center', marginTop:40 }}>No videos match this filter.</Text>}
        />
      </View>
    );
  }

  const closePlayer = useCallback(() => { try { playerRef.current?.dispose(); } catch {} setPlayingUri(null); }, []);

  return (
    <View style={{ flex:1, backgroundColor:'black', paddingTop: insets.top }}>
      <Header />
      {body}

      <Modal visible={!!playingUri} animationType="slide" onRequestClose={closePlayer}>
        <View style={{ flex:1, backgroundColor:'black', paddingTop: insets.top }}>
          <View style={{ position:'absolute', top: insets.top + 8, left: 12, zIndex: 2 }}>
            <TouchableOpacity onPress={closePlayer} hitSlop={{ top:16, bottom:16, left:16, right:16 }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor:'rgba(255,255,255,0.2)', borderWidth:1, borderColor:'rgba(255,255,255,0.5)', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:'white', fontWeight:'900', fontSize:18 }}>×</Text>
            </TouchableOpacity>
          </View>
          {playingUri ? <Player key={playingUri} ref={playerRef} uri={String(playingUri)} /> : null}
        </View>
      </Modal>

      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:24 }}>
          <View style={{ backgroundColor:'#121212', borderRadius:16, padding:16, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' }}>
            <Text style={{ color:'white', fontSize:18, fontWeight:'800' }}>Edit Info</Text>
            <Text style={{ color:'white', opacity:0.7, marginTop:8 }}>Set the athlete name (date and sport are kept automatically).</Text>
            <TextInput value={athleteName} onChangeText={setAthleteName} placeholder="Athlete name" placeholderTextColor="rgba(255,255,255,0.4)"
              style={{ marginTop:12, paddingVertical:10, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor:'rgba(255,255,255,0.25)', color:'white' }} />
            <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:12, marginTop:14 }}>
              <TouchableOpacity onPress={() => setEditTarget(null)} style={{ paddingVertical:10, paddingHorizontal:14, borderRadius:999, backgroundColor:'rgba(255,255,255,0.12)' }}>
                <Text style={{ color:'white', fontWeight:'700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyEditInfo} style={{ paddingVertical:10, paddingHorizontal:14, borderRadius:999, backgroundColor:'white' }}>
                <Text style={{ color:'black', fontWeight:'800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

