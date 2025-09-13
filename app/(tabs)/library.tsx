// app/(tabs)/library.tsx
// Simpler Library with segmented control: All / Athletes / Sports
// - Unassigned appears in Athletes view
// - Big easy Back button in player modal
// - Single Delete button (removes app copy + Photos asset if present)

import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = DIR + 'index.json';
const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';

type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;     // e.g. 'Unassigned' allowed
  sport: string;       // e.g. "wrestling:folkstyle"
  createdAt: number;   // ms epoch
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
  assetId?: string | undefined;
};

function bytesToMB(b?: number | null) {
  if (b == null) return '—';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

async function ensureDir(dir: string) {
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
}

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
  } catch {
    return null;
  }
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });

  useEffect(() => {
    try { player.play(); } catch {}
    // Do NOT pause on cleanup; native may already be disposed.
    return () => { /* no-op */ };
  }, [player]);

  return (
    <VideoView
      key={uri}                 // force remount per new video
      style={{ flex: 1 }}
      player={player}
      contentFit="contain"
      allowsFullscreen
      allowsPictureInPicture
      showsTimecodes
    />
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);

  // segmented control state
  const [view, setView] = useState<'all'|'athletes'|'sports'>('all');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const loadFromIndex = useCallback(async (): Promise<Row[]> => {
    await ensureDir(DIR);
    const indexInfo = await FileSystem.getInfoAsync(INDEX_PATH);

    // If index doesn't exist, list raw files (legacy)
    if (!(indexInfo as any)?.exists) {
      const names = await FileSystem.readDirectoryAsync(DIR);
      const videoFiles = names.filter(n => n !== 'index.json');
      const rows: Row[] = await Promise.all(
        videoFiles.map(async (name) => {
          const uri = DIR + name;
          const info = await FileSystem.getInfoAsync(uri);
          return {
            uri,
            displayName: name,
            size: (info as any)?.size ?? null,
            mtime: (info as any)?.modificationTime
              ? Math.round(((info as any).modificationTime as number) * 1000)
              : null,
            thumbUri: await getOrCreateThumb(uri, name),
          };
        })
      );
      rows.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
      return rows;
    }

    // Preferred: index.json
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const list: IndexMeta[] = JSON.parse(raw || '[]');

    const rows: Row[] = [];
    for (const meta of list) {
      const info = await FileSystem.getInfoAsync(meta.uri);
      if (!(info as any)?.exists) continue;

      const name = meta.uri.split('/').pop() || meta.displayName;
      rows.push({
        uri: meta.uri,
        displayName: meta.displayName || name,
        athlete: (meta.athlete || '').trim() || 'Unassigned',
        sport: (meta.sport || '').trim() || 'unknown',
        assetId: meta.assetId,
        size: (info as any)?.size ?? null,
        mtime: (info as any)?.modificationTime
          ? Math.round(((info as any).modificationTime as number) * 1000)
          : meta.createdAt ?? null,
        thumbUri: await getOrCreateThumb(meta.uri, name),
      });
    }

    rows.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    return rows;
  }, []);

  const load = useCallback(async () => {
    const r = await loadFromIndex();
    setRows(r);
  }, [loadFromIndex]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const removeVideo = useCallback(async (row: Row) => {
    try {
      // Delete the file in app storage
      try { await FileSystem.deleteAsync(row.uri, { idempotent: true }); } catch {}

      // Remove from index.json
      const info = await FileSystem.getInfoAsync(INDEX_PATH);
      if ((info as any)?.exists) {
        const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
        const list: IndexMeta[] = JSON.parse(raw || '[]');
        const updated = list.filter(e => e.uri !== row.uri);
        await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(updated));
      }

      // Optionally remove Photos asset
      if (row.assetId) {
        try {
          const asset = await MediaLibrary.getAssetInfoAsync(row.assetId);
          if (asset) {
            await MediaLibrary.deleteAssetsAsync([row.assetId]);
          }
        } catch {}
      }

      Alert.alert('Deleted', 'Video removed.');
      await load();
    } catch (e: any) {
      console.log('delete error:', e);
      Alert.alert('Delete failed', String(e?.message ?? e));
    }
  }, [load]);

  const saveToPhotos = useCallback(async (uri: string) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Photos permission needed', 'Allow access to save your video.');
      return;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved to Photos', 'Check your Photos app.');
  }, []);

  // ---------- groupings ----------
  const allRows = useMemo(
    () => [...rows].sort((a,b)=>(b.mtime ?? 0)-(a.mtime ?? 0)),
    [rows]
  );

  const rowsByAthlete = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) {
      const key = (r.athlete || 'Unassigned').trim() || 'Unassigned';
      (map[key] ||= []).push(r);
    }
    return map;
  }, [allRows]);

  const rowsBySport = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) {
      const key = (r.sport || 'unknown').trim() || 'unknown';
      (map[key] ||= []).push(r);
    }
    return map;
  }, [allRows]);

  // ---------- UI helpers ----------
  const renderRow = ({ item }: { item: Row }) => {
    const dateStr = item.mtime ? new Date(item.mtime).toLocaleString() : '—';
    const subtitleBits = [
      item.athlete ? `👤 ${item.athlete}` : null,
      item.sport ? `🏷️ ${item.sport}` : null,
      `${bytesToMB(item.size)}`,
      dateStr,
    ].filter(Boolean);

    return (
      <Pressable
        onPress={() => setPlayingUri(item.uri)}
        style={{
          padding: 12,
          marginHorizontal: 16,
          marginVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {item.thumbUri ? (
            <Image
              source={{ uri: item.thumbUri }}
              style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 96,
                height: 54,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.1)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>No preview</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '700' }} numberOfLines={2}>
              {item.displayName}
            </Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 4 }} numberOfLines={1}>
              {subtitleBits.join(' • ')}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => saveToPhotos(item.uri)}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'white' }}
              >
                <Text style={{ color: 'black', fontWeight: '700' }}>Save to Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPlayingUri(item.uri)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'white',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Play</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => removeVideo(item)}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(220,0,0,0.9)' }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  // ---------- header with segmented control ----------
  const Segmented = () => (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: insets.top + 4, paddingBottom: 8 }}>
      {(['all', 'athletes', 'sports'] as const).map(k => (
        <TouchableOpacity
          key={k}
          onPress={() => { setView(k); setSelectedAthlete(null); setSelectedSport(null); }}
          style={{
            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
            backgroundColor: view === k ? 'white' : 'rgba(255,255,255,0.12)',
            borderWidth: 1, borderColor: 'white'
          }}>
          <Text style={{ color: view === k ? 'black' : 'white', fontWeight: '800' }}>
            {k === 'all' ? 'All' : k[0].toUpperCase()+k.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {/* Header + Segments */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>Library</Text>
        <TouchableOpacity
          onPress={onRefresh}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'white',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Segmented />

      {/* Views */}
      {view === 'all' && (
        <FlatList
          data={allRows}
          keyExtractor={(it) => it.uri}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}   // ← bottom padding
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={
            <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>
              No recordings yet. Record a match, then come back.
            </Text>
          }
        />
      )}

      {view === 'athletes' && selectedAthlete == null && (
        <FlatList
          data={Object.keys(rowsByAthlete).sort((a,b)=>a.localeCompare(b))}
          keyExtractor={(k)=>k}
          renderItem={({ item: name }) => (
            <Pressable
              onPress={() => setSelectedAthlete(name)}
              style={{
                padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>{name}</Text>
              <Text style={{ color: 'white', opacity: 0.7 }}>{rowsByAthlete[name].length} videos</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}   // ← bottom padding
          ListEmptyComponent={
            <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>
              No groups yet.
            </Text>
          }
        />
      )}

      {view === 'athletes' && selectedAthlete != null && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <TouchableOpacity
              onPress={() => setSelectedAthlete(null)}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>{selectedAthlete}</Text>
          </View>
          <FlatList
            data={rowsByAthlete[selectedAthlete] ?? []}
            keyExtractor={(it)=>it.uri}
            renderItem={renderRow}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}   // ← bottom padding
          />
        </View>
      )}

      {view === 'sports' && selectedSport == null && (
        <FlatList
          data={Object.keys(rowsBySport).sort((a,b)=>a.localeCompare(b))}
          keyExtractor={(k)=>k}
          renderItem={({ item: s }) => (
            <Pressable
              onPress={() => setSelectedSport(s)}
              style={{
                padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>{s}</Text>
              <Text style={{ color: 'white', opacity: 0.7 }}>{rowsBySport[s].length} videos</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}   // ← bottom padding
        />
      )}

      {view === 'sports' && selectedSport != null && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <TouchableOpacity
              onPress={() => setSelectedSport(null)}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>{selectedSport}</Text>
          </View>
          <FlatList
            data={rowsBySport[selectedSport] ?? []}
            keyExtractor={(it)=>it.uri}
            renderItem={renderRow}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}   // ← bottom padding
          />
        </View>
      )}

      {/* Full-screen player modal */}
      <Modal visible={!!playingUri} animationType="slide" onRequestClose={() => setPlayingUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
          <View style={{ position: 'absolute', top: insets.top + 12, left: 12, zIndex: 5 }}>
            <TouchableOpacity
              onPress={() => setPlayingUri(null)}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={{
                paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)'
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
          </View>

          {playingUri ? <Player uri={String(playingUri)} /> : null}
        </View>
      </Modal>
    </View>
  );
}
