// app/(tabs)/library.tsx
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
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

type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;        // e.g. "wrestling:folkstyle"
  createdAt: number;    // ms epoch
};

type Row = {
  uri: string;
  displayName: string;
  athlete?: string;
  sport?: string;
  size: number | null;
  mtime: number | null;
  thumbUri?: string | null;
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

// ---- Small wrapper for expo-video ----
function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    player.play();
    return () => player.pause();
  }, [player]);

  return (
    <VideoView
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
  const [items, setItems] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);

  // Edit Info modal state (athlete only for now)
  const [editTarget, setEditTarget] = useState<{ uri: string; athlete: string; sport?: string; createdAt?: number } | null>(null);
  const [athleteName, setAthleteName] = useState('');

  const loadFromIndex = useCallback(async (): Promise<Row[]> => {
    await ensureDir(DIR);
    const indexInfo = await FileSystem.getInfoAsync(INDEX_PATH);

    if (!(indexInfo as any)?.exists) {
      // Fallback for legacy recordings (no index.json yet)
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
        athlete: meta.athlete,
        sport: meta.sport,
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
    const rows = await loadFromIndex();
    setItems(rows);
  }, [loadFromIndex]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
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

  // ---- Edit Info helpers (athlete) ----
  const openEditInfo = (row: Row) => {
    setEditTarget({
      uri: row.uri,
      athlete: row.athlete ?? '',
      sport: row.sport,
      createdAt: row.mtime ?? Date.now(), // fallback if needed
    });
    setAthleteName(row.athlete ?? '');
  };

  const applyEditInfo = useCallback(async () => {
    if (!editTarget) return;
    const athlete = athleteName.trim();

    try {
      const info = await FileSystem.getInfoAsync(INDEX_PATH);
      if (!(info as any)?.exists) {
        Alert.alert('No index found', 'Record a new video first to create index.json.');
        return;
      }

      const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
      const list: IndexMeta[] = JSON.parse(raw || '[]');

      const updated = list.map((entry) => {
        if (entry.uri !== editTarget.uri) return entry;

        const createdAt = entry.createdAt ?? editTarget.createdAt ?? Date.now();
        const sport = entry.sport ?? editTarget.sport ?? 'unknown';
        const displayName = `${athlete || 'Unassigned'} — ${sport} — ${new Date(createdAt).toLocaleString()}`;

        return {
          ...entry,
          athlete: athlete || 'Unassigned',
          displayName,
        };
      });

      await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(updated));
      setEditTarget(null);
      setAthleteName('');
      await load();
    } catch (e: any) {
      console.log('applyEditInfo error:', e);
      Alert.alert('Update failed', String(e?.message ?? e));
    }
  }, [editTarget, athleteName, load]);

  const renderItem = ({ item }: { item: Row }) => {
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
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'white',
                }}
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
                onPress={() => openEditInfo(item)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'white',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Edit Info</Text>
              </TouchableOpacity>

              {/* Next steps: Assign Athlete via picker / Upload / Delete */}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '800' }}>Library</Text>
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
          <Text style={{ color: 'white', fontWeight: '700' }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.uri}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListEmptyComponent={
          <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>
            No recordings yet. Record a match, then come back.
          </Text>
        }
      />

      {/* Full-screen player modal (expo-video) */}
      <Modal visible={!!playingUri} animationType="slide" onRequestClose={() => setPlayingUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16, zIndex: 2 }}>
            <TouchableOpacity
              onPress={() => setPlayingUri(null)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>

          {playingUri ? <Player uri={String(playingUri)} /> : null}
        </View>
      </Modal>

      {/* Edit Info (Athlete) modal */}
      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#121212', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Edit Info</Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 8 }}>
              Set the athlete name (date and sport are kept automatically).
            </Text>

            <TextInput
              value={athleteName}
              onChangeText={setAthleteName}
              placeholder="Athlete name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={{
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
                color: 'white',
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setEditTarget(null)}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyEditInfo}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'white' }}
              >
                <Text style={{ color: 'black', fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


