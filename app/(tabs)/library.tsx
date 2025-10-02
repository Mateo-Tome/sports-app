// Library: Athletes ➜ Sports ➜ Videos, with outcome/score chips, PIN gold highlight, and Playback routing

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
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
  athlete: string;   // 'Unassigned' allowed
  sport: string;     // e.g. "wrestling:folkstyle"
  createdAt: number;
  assetId?: string;
};

type FinalScore = { home: number; opponent: number };
type Outcome = 'W' | 'L' | 'T';

type Row = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
  size: number | null;
  mtime: number | null;
  thumbUri?: string | null;
  assetId?: string | undefined;

  finalScore?: FinalScore | null;
  homeIsAthlete?: boolean; // default true
  outcome?: Outcome;       // W/L/T from athlete’s POV (forced to W on PIN)
  myScore?: number | null;
  oppScore?: number | null;

  // Gold highlight when athlete wins by pin
  highlightGold?: boolean;
};

// ---------- small utils ----------
const ensureDir = async (dir: string) => { try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {} };
const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
const bytesToMB = (b?: number | null) => (b == null ? '—' : (b / (1024 * 1024)).toFixed(2) + ' MB');

// extra helpers for robust move/rename
async function pathExists(p: string) {
  try {
    const info = await FileSystem.getInfoAsync(p);
    // @ts-ignore
    return !!(info as any)?.exists;
  } catch { return false; }
}
async function pickUniqueDest(dir: string, baseName: string, extWithDot: string) {
  // returns a free path inside dir; tries baseName.ext, baseName-1.ext, baseName-2.ext ...
  let n = 0;
  while (true) {
    const name = n === 0 ? `${baseName}${extWithDot}` : `${baseName}-${n}${extWithDot}`;
    const dest = `${dir}${name}`;
    if (!(await pathExists(dest))) return { dest, filename: name };
    n++;
  }
}
// Try to re-locate a file by filename under videos/<athlete>/<sport>/*
async function findByFilename(fileName: string): Promise<string | null> {
  try {
    // @ts-ignore
    const athletes: string[] = await (FileSystem as any).readDirectoryAsync(DIR);
    for (const a of athletes) {
      const aDir = `${DIR}${a}/`;
      try {
        // @ts-ignore
        const sports: string[] = await (FileSystem as any).readDirectoryAsync(aDir);
        for (const s of sports) {
          const sDir = `${aDir}${s}/`;
          try {
            // @ts-ignore
            const files: string[] = await (FileSystem as any).readDirectoryAsync(sDir);
            const cand = files.find(f => f === fileName);
            if (cand) return sDir + cand;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function findByLooseBasename(baseNoExt: string, extWithDot: string): Promise<string | null> {
  try {
    // @ts-ignore
    const athletes: string[] = await (FileSystem as any).readDirectoryAsync(DIR);
    for (const a of athletes) {
      const aDir = `${DIR}${a}/`;
      try {
        // @ts-ignore
        const sports: string[] = await (FileSystem as any).readDirectoryAsync(aDir);
        for (const s of sports) {
          const sDir = `${aDir}${s}/`;
          try {
            // @ts-ignore
            const files: string[] = await (FileSystem as any).readDirectoryAsync(sDir);
            const cand = files.find(f =>
              (f === `${baseNoExt}${extWithDot}`) ||
              (f.startsWith(`${baseNoExt}-`) && f.endsWith(extWithDot)) // handles filename-1.mp4
            );
            if (cand) return sDir + cand;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
}


// ---------- index helpers ----------
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

// ---------- thumbs ----------
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

// ---------- sidecar (score/outcome + gold) ----------
type SidecarEvent = {
  t: number;
  points?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  key?: string;
  label?: string;
  kind?: string;
  meta?: Record<string, any>;
};
type Sidecar = {
  athlete?: string;
  sport?: string;
  events?: SidecarEvent[];
  finalScore?: FinalScore;
  homeIsAthlete?: boolean;
};

// robustly find and parse the sidecar, then derive final score/outcome and gold
async function readOutcomeFor(videoUri: string): Promise<{
  finalScore: FinalScore | null;
  homeIsAthlete: boolean;
  outcome: Outcome | null;
  myScore: number | null;
  oppScore: number | null;
  highlightGold: boolean;
}> {
  try {
    const lastSlash = videoUri.lastIndexOf('/');
    const lastDot = videoUri.lastIndexOf('.');
    const base = lastDot > lastSlash ? videoUri.slice(0, lastDot) : videoUri;
    const guess = `${base}.json`;

    const tryRead = async (p: string): Promise<Sidecar | null> => {
      const info = await FileSystem.getInfoAsync(p);
      if (!(info as any)?.exists) return null;
      const txt = await FileSystem.readAsStringAsync(p);
      return JSON.parse(txt || '{}');
    };

    let sc: Sidecar | null = await tryRead(guess);

    // fallback: scan directory for same basename.json
    if (!sc) {
      try {
        const dir = videoUri.slice(0, lastSlash + 1);
        // @ts-ignore
        const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
        const baseName = base.slice(lastSlash + 1);
        const candidate = files.find(f => f.toLowerCase() === `${baseName.toLowerCase()}.json`);
        if (candidate) sc = await tryRead(dir + candidate);
      } catch {}
    }

    if (!sc) return { finalScore: null, homeIsAthlete: true, outcome: null, myScore: null, oppScore: null, highlightGold: false };

    // compute score if missing
    let finalScore: FinalScore | null = sc.finalScore ?? null;
    if (!finalScore) {
      let h = 0, o = 0;
      for (const e of sc.events ?? []) {
        const pts = typeof e.points === 'number' ? e.points : 0;
        if (pts > 0) {
          if (e.actor === 'home') h += pts;
          else if (e.actor === 'opponent') o += pts;
        }
      }
      finalScore = { home: h, opponent: o };
    }

    const homeIsAthlete = sc.homeIsAthlete !== false; // default true
    const myScore = homeIsAthlete ? finalScore.home : finalScore.opponent;
    const oppScore = homeIsAthlete ? finalScore.opponent : finalScore.home;

    // ==== PIN detection (robust across key/label/kind/meta.winBy; also allow "fall") ====
    const ev = sc.events ?? [];
    const pinEv = ev.find((e: SidecarEvent) => {
      const key = String(e?.key ?? '').toLowerCase();
      const label = String(e?.label ?? '').toLowerCase();
      const kind = String(e?.kind ?? '').toLowerCase();
      const winBy = String(e?.meta?.winBy ?? '').toLowerCase();
      return (
        key === 'pin' ||
        kind === 'pin' ||
        label.includes('pin') ||
        winBy === 'pin' ||
        kind === 'fall' || label.includes('fall')
      );
    });

    let highlightGold = false;
    let outcome: Outcome | null;

    if (pinEv && (pinEv.actor === 'home' || pinEv.actor === 'opponent')) {
      const athletePinned =
        (homeIsAthlete && pinEv.actor === 'home') ||
        (!homeIsAthlete && pinEv.actor === 'opponent');
      highlightGold = !!athletePinned;
      // force outcome on a pin
      outcome = athletePinned ? 'W' : 'L';
    } else {
      // fall back to points
      outcome = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
    }

    return { finalScore, homeIsAthlete, outcome, myScore, oppScore, highlightGold };
  } catch {
    return { finalScore: null, homeIsAthlete: true, outcome: null, myScore: null, oppScore: null, highlightGold: false };
  }
}

// ---------- move video across athletes (ROBUST + patch sidecar) ----------
async function retagVideo(
  input: { uri: string; oldAthlete: string; sportKey: string; assetId?: string },
  newAthleteRaw: string
) {
  const newAthlete = (newAthleteRaw || '').trim() || 'Unassigned';
  const oldA = (input.oldAthlete || '').trim() || 'Unassigned';
  if (newAthlete === oldA) return; // nothing to do

    // re-resolve source by filename if missing
    let sourceUri = input.uri;
    if (!(await pathExists(sourceUri))) {
      const fileName = (input.uri.split('/').pop() || '');
      const dot = fileName.lastIndexOf('.');
      const baseNoExt = dot > 0 ? fileName.slice(0, dot) : fileName;
      const ext = dot > 0 ? fileName.slice(dot) : '.mp4';
  
      // 1) exact filename under videos/
      let found = fileName ? await findByFilename(fileName) : null;
  
      // 2) loose match (handles filename-1.mp4 after prior collision/move)
      if (!found) found = await findByLooseBasename(baseNoExt, ext);
  
      // 3) last-resort: look up by assetId from index
      if (!found && input.assetId) {
        const list = await readIndex();
        const hit = list.find(m => m.assetId === input.assetId);
        if (hit && await pathExists(hit.uri)) found = hit.uri;
      }
  
      if (found) {
        sourceUri = found;
      } else {
        throw new Error('Original file not found. Tap Refresh; the index may be stale.');
      }
    }
  

  // Ensure destination directory exists
  const athleteSlug = slug(newAthlete);
  const sportSlug = slug(input.sportKey);
  const newDir = `${DIR}${athleteSlug}/${sportSlug}/`;
  await ensureDir(DIR);
  await ensureDir(`${DIR}${athleteSlug}/`);
  await ensureDir(newDir);

  // Compute base name & extension
  const srcName = sourceUri.split('/').pop() || `retag_${Date.now()}.mp4`;
  const dot = srcName.lastIndexOf('.');
  const base = dot > 0 ? srcName.slice(0, dot) : srcName;
  const ext = dot > 0 ? srcName.slice(dot) : '.mp4'; // keep original ext

  // Pick a unique destination to avoid collisions
  const { dest: newVideoUri, filename: newFileName } = await pickUniqueDest(newDir, base, ext);

  // Find matching sidecar (same basename .json) at source, if any
  const lastSlash = sourceUri.lastIndexOf('/');
  const srcDir = sourceUri.slice(0, lastSlash + 1);
  const sidecarSrcGuess = `${srcDir}${base}.json`;

  let sidecarFrom: string | null = null;
  if (await pathExists(sidecarSrcGuess)) {
    sidecarFrom = sidecarSrcGuess;
  } else {
    try {
      // @ts-ignore
      const files: string[] = await (FileSystem as any).readDirectoryAsync(srcDir);
      const cand = files.find(f => f.toLowerCase() === `${base.toLowerCase()}.json`);
      if (cand) sidecarFrom = srcDir + cand;
    } catch {}
  }

  // Move the video first
  await FileSystem.moveAsync({ from: sourceUri, to: newVideoUri });

  // Move (or create) sidecar and patch athlete
  const newBase = newFileName.replace(/\.[^/.]+$/, '');
  let sidecarDest = `${newDir}${newBase}.json`;

  try {
    if (sidecarFrom && await pathExists(sidecarFrom)) {
      if (await pathExists(sidecarDest)) sidecarDest = `${newDir}${newBase}-${Date.now()}.json`;
      await FileSystem.moveAsync({ from: sidecarFrom, to: sidecarDest });
    } else {
      // no sidecar existed — create a minimal one so Playback sees the right athlete
      const minimal: Sidecar = { athlete: newAthlete, sport: input.sportKey, events: [], homeIsAthlete: true, finalScore: { home: 0, opponent: 0 } };
      await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(minimal));
    }
  } catch {
    // ensure a sidecar exists even if move failed
    try {
      const minimal: Sidecar = { athlete: newAthlete, sport: input.sportKey, events: [], homeIsAthlete: true, finalScore: { home: 0, opponent: 0 } };
      await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(minimal));
    } catch {}
  }

  // Patch athlete inside sidecar JSON (now at destination)
  try {
    const txt = await FileSystem.readAsStringAsync(sidecarDest);
    const sc = (txt ? JSON.parse(txt) : {}) as Sidecar;
    sc.athlete = newAthlete;
    if (!sc.sport) sc.sport = input.sportKey;
    await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(sc));
  } catch (e) {
    console.log('sidecar patch error:', e);
  }

  // Update index.json
  const list = await readIndex();
  const updated: IndexMeta[] = list.map(e =>
    e.uri === input.uri || e.uri === sourceUri
      ? {
          ...e,
          uri: newVideoUri,
          athlete: newAthlete,
          // keep sport; change displayName to reflect athlete
          displayName: `${newAthlete} — ${e.sport} — ${new Date(e.createdAt).toLocaleString()}`
        }
      : e
  );
  await writeIndexAtomic(updated);

  // Photos app best-effort album management
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted || !input.assetId) return;

    const assetId = input.assetId;
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

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
      const scoreBits = await readOutcomeFor(meta.uri);

      built.push({
        uri: meta.uri,
        displayName: meta.displayName || name,
        athlete: (meta.athlete || 'Unassigned').trim() || 'Unassigned',
        sport: (meta.sport || 'unknown').trim() || 'unknown',
        assetId: meta.assetId,
        size: (info as any)?.size ?? null,
        mtime: (info as any)?.modificationTime ? Math.round(((info as any).modificationTime as number) * 1000) : meta.createdAt ?? null,
        thumbUri: await getOrCreateThumb(meta.uri, name),

        // scores/outcomes
        finalScore: scoreBits.finalScore,
        homeIsAthlete: scoreBits.homeIsAthlete,
        outcome: scoreBits.outcome ?? undefined,
        myScore: scoreBits.myScore,
        oppScore: scoreBits.oppScore,

        // gold highlight on PIN
        highlightGold: scoreBits.highlightGold,
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

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

  // 👉 Push params so Playback shows correct identity immediately
  const pushPlayback = (row: Row) => {
    router.push({
      pathname: '/screens/PlaybackScreen',
      params: {
        videoPath: row.uri,
        athlete: row.athlete,
        sport: row.sport,
        displayName: row.displayName,
      },
    });
  };

  // ====== GROUPINGS ======
  const allRows = useMemo(() => [...rows].sort((a,b)=>(b.mtime ?? 0)-(a.mtime ?? 0)), [rows]);

  // by athlete
  const rowsByAthlete = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) { const k = r.athlete || 'Unassigned'; (map[k] ||= []).push(r); }
    return map;
  }, [allRows]);

  // by sport (global)
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
      const msg = e?.message || String(e);
      Alert.alert('Update failed', msg.includes('Original file not found') ? `${msg}\n\nTap Refresh and try again.` : msg);
    }
  };

  // ====== RENDER HELPERS ======
  const pushPlaybackByUri = (uri: string) => {
    const row = rows.find(r => r.uri === uri);
    if (row) pushPlayback(row);
  };

  const outcomeColor = (o?: Outcome | null) =>
    o === 'W' ? '#16a34a' : o === 'L' ? '#dc2626' : o === 'T' ? '#f59e0b' : 'rgba(255,255,255,0.25)';

  const renderVideoRow = ({ item }: { item: Row }) => {
    const dateStr = item.mtime ? new Date(item.mtime).toLocaleString() : '—';
    const subtitleBits = [
      item.athlete ? `👤 ${item.athlete}` : null,
      item.sport ? `🏷️ ${item.sport}` : null,
      `${bytesToMB(item.size)}`,
      dateStr,
    ].filter(Boolean);

    const chip = item.outcome && item.myScore != null && item.oppScore != null
      ? { text: `${item.outcome} ${item.myScore}–${item.oppScore}`, color: outcomeColor(item.outcome) }
      : null;

    return (
      <Pressable
        onPress={() => pushPlayback(item)}
        style={{
          padding: 0,
          marginHorizontal: 16,
          marginVertical: 8,
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: item.highlightGold ? 0 : 2,
          borderColor: item.highlightGold ? 'transparent' : outcomeColor(item.outcome),
          backgroundColor: item.highlightGold ? 'transparent' : 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Gold gradient background when highlighted */}
        {item.highlightGold && (
          <>
            <LinearGradient
              colors={['#f7d774', '#d4a017', '#b88912']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* subtle dark veil to keep white text readable */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          </>
        )}

        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {item.thumbUri ? (
              <Image source={{ uri: item.thumbUri }} style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }} resizeMode="cover" />
            ) : (
              <View style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>No preview</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: 'white', fontWeight: '700', flexShrink: 1 }} numberOfLines={2}>{item.displayName}</Text>
                {chip && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: `${chip.color}22`, borderWidth: 1, borderColor: `${chip.color}66` }}>
                    <Text style={{ color: 'white', fontWeight: '900' }}>{chip.text}</Text>
                  </View>
                )}
                {item.highlightGold && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#00000033', borderWidth: 1, borderColor: '#ffffff55' }}>
                    <Text style={{ color: 'white', fontWeight: '900' }}>PIN</Text>
                  </View>
                )}
              </View>

              <Text style={{ color: 'white', opacity: 0.85, marginTop: 4 }} numberOfLines={1}>{subtitleBits.join(' • ')}</Text>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <TouchableOpacity onPress={() => saveToPhotos(item.uri)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'white' }}>
                  <Text style={{ color: 'black', fontWeight: '700' }}>Save to Photos</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => pushPlayback(item)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
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
        </View>
      </Pressable>
    );
  };

  const Segmented = () => (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: insets.top + 4, paddingBottom: 8 }}>
      {(['all', 'athletes', 'sports'] as const).map(k => (
        <TouchableOpacity
          key={k}
          onPress={() => { setView(k); setSelectedAthlete(null); setSelectedSport(null); }}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: view === k ? 'white' : 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'white'
          }}
        >
          <Text style={{ color: view === k ? 'black' : 'white', fontWeight: '800' }}>
            {k === 'all' ? 'All' : k[0].toUpperCase()+k.slice(1)}
          </Text>
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
            const last = videos?.[0]?.mtime ? new Date(videos[0].mtime!).toLocaleString() : '—';

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

      {/* Note: we removed the inline full-screen player modal; we route to Playback instead */}
      <Modal visible={false} />

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
            <TextInput
              placeholder="Enter new name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newName}
              onChangeText={setNewName}
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}
            />
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

const styles = StyleSheet.create({});














