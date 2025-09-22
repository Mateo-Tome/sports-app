// app/(tabs)/library.tsx
// Library with segmented views + Edit Athlete (moves file + updates index + albums best-effort)
// Now supports: Athletes ➜ Sports-for-athlete ➜ Videos-for-athlete+sport
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = DIR + 'index.json';
const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';
const ATHLETES_KEY = 'athletes:list';

type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;   // 'Unassigned' allowed
  sport: string;     // e.g. "wrestling:folkstyle"
  createdAt: number;
  assetId?: string;
};
type Row = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  size: number | null;
  mtime: number | null;
  thumbUri?: string | null;
  assetId?: string | undefined;
};

const ensureDir = async (dir: string) => { try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {} };
const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
const bytesToMB = (b?: number | null) => (b == null ? '—' : (b / (1024 * 1024)).toFixed(2) + ' MB');

async function readIndex(): Promise<IndexMeta[]> {
  try {
    const info = await FileSystem.getInfoAsync(INDEX_PATH);
    if (!(info as any)?.exists) return [];
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
async function writeIndexAtomic(list: IndexMeta[]) {
  const tmp = INDEX_PATH + '.tmp';
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(list));
  try { await FileSystem.deleteAsync(INDEX_PATH, { idempotent: true }); } catch {}
  await FileSystem.moveAsync({ from: tmp, to: INDEX_PATH });
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
  } catch { return null; }
}

async function retagVideo(input: { uri: string; oldAthlete: string; sportKey: string; assetId?: string }, newAthleteRaw: string) {
  const newAthlete = (newAthleteRaw || '').trim() || 'Unassigned';
  const oldA = (input.oldAthlete || '').trim() || 'Unassigned';
  if (newAthlete === oldA) return;

  const newDir = `${DIR}${slug(newAthlete)}/${slug(input.sportKey)}/`;
  await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });

  const filename = input.uri.split('/').pop() || `retag_${Date.now()}.mp4`;
  const newUri = newDir + filename;

  // Move file
  await FileSystem.moveAsync({ from: input.uri, to: newUri });

  // Update index
  const list = await readIndex();
  const updated: IndexMeta[] = list.map(e => e.uri === input.uri
    ? { ...e, uri: newUri, athlete: newAthlete, displayName: `${newAthlete} — ${e.sport} — ${new Date(e.createdAt).toLocaleString()}` }
    : e
  );
  await writeIndexAtomic(updated);

  // Update Photos albums (best-effort)
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted || !input.assetId) return;

    const assetId = input.assetId; // use the id directly (more reliable)
    const athleteAlbumName = newAthlete;
    const sportAlbumName = `${newAthlete} — ${input.sportKey}`;

    let a = await MediaLibrary.getAlbumAsync(athleteAlbumName);
    if (!a) a = await MediaLibrary.createAlbumAsync(athleteAlbumName, assetId, false);
    else await MediaLibrary.addAssetsToAlbumAsync([assetId], a, false);

    let s = await MediaLibrary.getAlbumAsync(sportAlbumName);
    if (!s) s = await MediaLibrary.createAlbumAsync(sportAlbumName, assetId, false);
    else await MediaLibrary.addAssetsToAlbumAsync([assetId], s, false);
  } catch {}
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  useEffect(() => { try { player.play(); } catch {} return () => {}; }, [player]);
  return <VideoView key={uri} style={{ flex: 1 }} player={player} contentFit="contain" allowsFullscreen allowsPictureInPicture showsTimecodes />;
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);

  const [athletePickerOpen, setAthletePickerOpen] = useState<null | Row>(null);
  const [athleteList, setAthleteList] = useState<{ id: string; name: string; photoUri?: string | null }[]>([]);
  const [newName, setNewName] = useState('');

  // segmented state
  const [view, setView] = useState<'all'|'athletes'|'sports'>('athletes');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list: IndexMeta[] = await readIndex();
    const built: Row[] = [];
    for (const meta of list) {
      const info = await FileSystem.getInfoAsync(meta.uri);
      if (!(info as any)?.exists) continue;
      const name = meta.uri.split('/').pop() || meta.displayName;
      built.push({
        uri: meta.uri,
        displayName: meta.displayName || name,
        athlete: (meta.athlete || 'Unassigned').trim() || 'Unassigned',
        sport: (meta.sport || 'unknown').trim() || 'unknown',
        assetId: meta.assetId,
        size: (info as any)?.size ?? null,
        mtime: (info as any)?.modificationTime ? Math.round(((info as any).modificationTime as number) * 1000) : meta.createdAt ?? null,
        thumbUri: await getOrCreateThumb(meta.uri, name),
      });
    }
    built.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    setRows(built);

    // load athlete list (with photos) from Home screen storage
    try {
      const raw = await AsyncStorage.getItem(ATHLETES_KEY);
      setAthleteList(raw ? JSON.parse(raw) : []);
    } catch { setAthleteList([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  const removeVideo = useCallback(async (row: Row) => {
    try {
      try { await FileSystem.deleteAsync(row.uri, { idempotent: true }); } catch {}
      const current = await readIndex();
      const updated = current.filter(e => e.uri !== row.uri);
      await writeIndexAtomic(updated);

      if (row.assetId) {
        try {
          const { granted } = await MediaLibrary.requestPermissionsAsync();
          if (granted) {
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
    if (!granted) { Alert.alert('Photos permission needed', 'Allow access to save your video.'); return; }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved to Photos', 'Check your Photos app.');
  }, []);

  // ====== GROUPINGS ======
  const allRows = useMemo(() => [...rows].sort((a,b)=>(b.mtime ?? 0)-(a.mtime ?? 0)), [rows]);

  // by athlete
  const rowsByAthlete = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) { const k = r.athlete || 'Unassigned'; (map[k] ||= []).push(r); }
    return map;
  }, [allRows]);

  // by sport (global, for the "Sports" tab)
  const rowsBySport = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) { const k = r.sport || 'unknown'; (map[k] ||= []).push(r); }
    return map;
  }, [allRows]);

  // athlete -> sport -> rows (for drill-down in Athletes tab)
  const athleteSportsMap = useMemo(() => {
    const m: Record<string, Record<string, Row[]>> = {};
    for (const r of allRows) {
      const a = r.athlete || 'Unassigned';
      const s = r.sport || 'unknown';
      (m[a] ||= {});
      (m[a][s] ||= []);
      m[a][s].push(r);
    }
    // keep each inner list newest-first
    for (const a of Object.keys(m)) {
      for (const s of Object.keys(m[a])) {
        m[a][s].sort((x, y) => (y.mtime ?? 0) - (x.mtime ?? 0));
      }
    }
    return m;
  }, [allRows]);

  const photoFor = useCallback(
    (name: string) => athleteList.find(a => a.name === name)?.photoUri ?? null,
    [athleteList]
  );

  const doEditAthlete = async (row: Row, newAthlete: string) => {
    try {
      await retagVideo({ uri: row.uri, oldAthlete: row.athlete, sportKey: row.sport, assetId: row.assetId }, newAthlete);
      await load();
    } catch (e: any) {
      console.log('retag error', e);
      Alert.alert('Update failed', String(e?.message ?? e));
    }
  };

  // ====== RENDER HELPERS ======
  const renderVideoRow = ({ item }: { item: Row }) => {
    const dateStr = item.mtime ? new Date(item.mtime).toLocaleString() : '—';
    const subtitleBits = [item.athlete ? `👤 ${item.athlete}` : null, item.sport ? `🏷️ ${item.sport}` : null, `${bytesToMB(item.size)}`, dateStr].filter(Boolean);

    return (
      <Pressable onPress={() => setPlayingUri(item.uri)} style={{ padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {item.thumbUri ? (
            <Image source={{ uri: item.thumbUri }} style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }} resizeMode="cover" />
          ) : (
            <View style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>No preview</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '700' }} numberOfLines={2}>{item.displayName}</Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 4 }} numberOfLines={1}>{subtitleBits.join(' • ')}</Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={() => saveToPhotos(item.uri)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'white' }}>
                <Text style={{ color: 'black', fontWeight: '700' }}>Save to Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPlayingUri(item.uri)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Play</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => removeVideo(item)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(220,0,0,0.9)' }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setAthletePickerOpen(item)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Edit Athlete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const Segmented = () => (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: insets.top + 4, paddingBottom: 8 }}>
      {(['all', 'athletes', 'sports'] as const).map(k => (
        <TouchableOpacity key={k} onPress={() => { setView(k); setSelectedAthlete(null); setSelectedSport(null); }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: view === k ? 'white' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
          <Text style={{ color: view === k ? 'black' : 'white', fontWeight: '800' }}>{k === 'all' ? 'All' : k[0].toUpperCase()+k.slice(1)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ====== UI ======
  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>Library</Text>
        <TouchableOpacity onPress={onRefresh} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'white' }}>
          <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Segmented />

      {/* ===== All Videos ===== */}
      {view === 'all' && (
        <FlatList
          data={allRows}
          keyExtractor={(it) => it.uri}
          renderItem={renderVideoRow}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={<Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>No recordings yet. Record a match, then come back.</Text>}
        />
      )}

      {/* ===== Athletes root ===== */}
      {view === 'athletes' && selectedAthlete == null && (
        <FlatList
          data={Object.keys(rowsByAthlete).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return a.localeCompare(b);
          })}
          keyExtractor={(k)=>k}
          renderItem={({ item: name }) => {
            const photoUri = photoFor(name);
            const videos = rowsByAthlete[name];
            const count = videos.length;
            const last = videos?.[0]?.mtime ? new Date(videos[0].mtime).toLocaleString() : '—';

            return (
              <Pressable
                onPress={() => { setSelectedAthlete(name); setSelectedSport(null); }}
                style={{
                  padding: 12,
                  marginHorizontal: 16,
                  marginVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)' }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: 'white', opacity: 0.7, fontSize: 20 }}>👤</Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontWeight: '800' }} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }} numberOfLines={1}>
                      {count} {count === 1 ? 'video' : 'videos'} • last {last}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, marginLeft: 8 }}>›</Text>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          ListEmptyComponent={<Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>No groups yet.</Text>}
        />
      )}

      {/* ===== Athletes ➜ Sports ===== */}
      {view === 'athletes' && selectedAthlete != null && selectedSport == null && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <TouchableOpacity onPress={() => setSelectedAthlete(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>{selectedAthlete}</Text>
          </View>

          <FlatList
            data={Object.keys(athleteSportsMap[selectedAthlete] || {}).sort((a,b)=>a.localeCompare(b))}
            keyExtractor={(s)=>s}
            renderItem={({ item: sport }) => {
              const list = athleteSportsMap[selectedAthlete]?.[sport] ?? [];
              const count = list.length;
              const last = list[0]?.mtime ? new Date(list[0].mtime!).toLocaleString() : '—';
              const preview = list[0]?.thumbUri ?? null;

              return (
                <Pressable
                  onPress={() => setSelectedSport(sport)}
                  style={{
                    padding: 12,
                    marginHorizontal: 16,
                    marginVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    {preview ? (
                      <Image source={{ uri: preview }} style={{ width: 72, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    ) : (
                      <View style={{ width: 72, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>No preview</Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontWeight: '800' }} numberOfLines={1}>{sport}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }} numberOfLines={1}>
                        {count} {count === 1 ? 'video' : 'videos'} • last {last}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, marginLeft: 8 }}>›</Text>
                </Pressable>
              );
            }}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
            ListEmptyComponent={<Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>No sports yet.</Text>}
          />
        </View>
      )}

      {/* ===== Athletes ➜ Sports ➜ Videos ===== */}
      {view === 'athletes' && selectedAthlete != null && selectedSport != null && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <TouchableOpacity onPress={() => setSelectedSport(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>{selectedAthlete} • {selectedSport}</Text>
          </View>

          <FlatList
            data={athleteSportsMap[selectedAthlete]?.[selectedSport] ?? []}
            keyExtractor={(it)=>it.uri}
            renderItem={renderVideoRow}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          />
        </View>
      )}

      {/* ===== Sports tab (global) ===== */}
      {view === 'sports' && selectedSport == null && (
        <FlatList
          data={Object.keys(rowsBySport).sort((a,b)=>a.localeCompare(b))}
          keyExtractor={(k)=>k}
          renderItem={({ item: s }) => (
            <Pressable onPress={() => setSelectedSport(s)} style={{ padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>{s}</Text>
              <Text style={{ color: 'white', opacity: 0.7 }}>{rowsBySport[s].length} videos</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        />
      )}

      {view === 'sports' && selectedSport != null && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <TouchableOpacity onPress={() => setSelectedSport(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>{selectedSport}</Text>
          </View>
          <FlatList data={rowsBySport[selectedSport] ?? []} keyExtractor={(it)=>it.uri} renderItem={renderVideoRow} contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }} />
        </View>
      )}

      {/* Full-screen player modal */}
      <Modal visible={!!playingUri} animationType="slide" onRequestClose={() => setPlayingUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
          <View style={{ position: 'absolute', top: insets.top + 12, left: 12, zIndex: 5 }}>
            <TouchableOpacity onPress={() => setPlayingUri(null)} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
          </View>
          {playingUri ? <Player uri={String(playingUri)} /> : null}
        </View>
      </Modal>

      {/* Edit Athlete modal */}
      <Modal visible={!!athletePickerOpen} transparent animationType="fade" onRequestClose={() => setAthletePickerOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#121212', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>Edit Athlete</Text>

            <Pressable onPress={async () => { if (athletePickerOpen) { await doEditAthlete(athletePickerOpen, 'Unassigned'); setAthletePickerOpen(null); } }} style={{ paddingVertical: 12 }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>• Unassigned</Text>
            </Pressable>

            {athleteList.map(a => (
              <Pressable key={a.id} onPress={async () => { if (athletePickerOpen) { await doEditAthlete(athletePickerOpen, a.name); setAthletePickerOpen(null); } }} style={{ paddingVertical: 10 }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>• {a.name}</Text>
              </Pressable>
            ))}

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 }} />

            <Text style={{ color: 'white', opacity: 0.8, marginBottom: 6 }}>New athlete</Text>
            <TextInput placeholder="Enter new name" placeholderTextColor="rgba(255,255,255,0.4)" value={newName} onChangeText={setNewName} style={{ color: 'white', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <TouchableOpacity onPress={() => setAthletePickerOpen(null)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const n = newName.trim();
                  if (!n || !athletePickerOpen) return;
                  const next = [{ id: `${Date.now()}`, name: n }, ...athleteList];
                  try { await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(next)); } catch {}
                  setAthleteList(next);
                  await doEditAthlete(athletePickerOpen, n);
                  setNewName('');
                  setAthletePickerOpen(null);
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'white' }}
              >
                <Text style={{ color: 'black', fontWeight: '800' }}>Add & Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}





