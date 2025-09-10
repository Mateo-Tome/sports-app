import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DIR = FileSystem.documentDirectory + 'videos/';
const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';

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
  } catch (e) {
    console.log('thumb gen failed:', e);
    return null;
  }
}

type VidItem = {
  uri: string;
  name: string;
  size: number | null;
  mtime: number | null;
  thumbUri?: string | null;
};

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VidItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadVideos = useCallback(async () => {
    await ensureDir(DIR);
    const names = await FileSystem.readDirectoryAsync(DIR);

    const baseItems: VidItem[] = await Promise.all(
      names.map(async (name) => {
        const uri = DIR + name;
        const info = await FileSystem.getInfoAsync(uri);
        return {
          uri,
          name,
          size: (info as any)?.size ?? null,
          mtime: (info as any)?.modificationTime
            ? Math.round(((info as any).modificationTime as number) * 1000)
            : null,
        };
      })
    );

    // newest first
    baseItems.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));

    // attach (or generate) thumbnails
    const withThumbs: VidItem[] = await Promise.all(
      baseItems.map(async (it) => ({ ...it, thumbUri: await getOrCreateThumb(it.uri, it.name) }))
    );

    setVideos(withThumbs);
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadVideos(); } finally { setRefreshing(false); }
  }, [loadVideos]);

  const saveToPhotos = useCallback(async (uri: string) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Photos permission needed', 'Allow access to save your video.');
      return;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved to Photos', 'Check your Photos app.');
  }, []);

  const renderItem = ({ item }: { item: VidItem }) => {
    const dateStr = item.mtime ? new Date(item.mtime).toLocaleString() : '—';

    return (
      <View
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
            <Text style={{ color: 'white', fontWeight: '700' }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 4 }}>
              {bytesToMB(item.size)} • {dateStr}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
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

              {/* future: Share/Upload/Delete */}
            </View>
          </View>
        </View>
      </View>
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
        data={videos}
        keyExtractor={(it) => it.uri}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListEmptyComponent={
          <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>
            No recordings yet. Record a match, then come back.
          </Text>
        }
      />
    </View>
  );
}

