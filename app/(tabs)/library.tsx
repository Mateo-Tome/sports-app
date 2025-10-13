// app/(tabs)/library.tsx
// Library: optimized load + fast row patching + safe FS ops + thumb cleanup (assetId-aware thumbs)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadFileOnTap, uploadJSONOnTap } from '../../lib/sync';

const DIR = FileSystem.documentDirectory + 'videos/';
const INDEX_PATH = DIR + 'index.json';
const THUMBS_DIR = FileSystem.cacheDirectory + 'thumbs/';
const ATHLETES_KEY = 'athletes:list';
const UPLOADED_MAP_KEY = 'uploaded:map';

type IndexMeta = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;
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
  homeIsAthlete?: boolean;
  outcome?: Outcome;
  myScore?: number | null;
  oppScore?: number | null;

  highlightGold?: boolean;
};

// ---------- small utils ----------
const ensureDir = async (dir: string) => { try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {} };
const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
const bytesToMB = (b?: number | null) => (b == null ? '—' : (b / (1024 * 1024)).toFixed(2) + ' MB');
const baseNameNoExt = (p: string) => {
  const name = (p.split('/').pop() || '');
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
};
// hash for unique thumb names even if basenames collide
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); };
const thumbNameFor = (videoUri: string) => `${baseNameNoExt(videoUri)}_${hash(videoUri)}.jpg`;
const thumbPathFor = (videoUri: string) => `${THUMBS_DIR}${thumbNameFor(videoUri)}`;

// ----- bounded concurrency helper -----
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

// ----- tiny FS queue (mutex) to avoid concurrent writes/moves -----
let __fsQueue: Promise<any> = Promise.resolve();
function enqueueFs<T>(fn: () => Promise<T>): Promise<T> {
  const task = __fsQueue.then(fn, fn);
  __fsQueue = task.then(() => undefined, () => undefined);
  return task;
}

// extra helpers for robust move/rename
async function pathExists(p: string) {
  try {
    const info = await FileSystem.getInfoAsync(p);
    // @ts-ignore
    return !!(info as any)?.exists;
  } catch { return false; }
}
async function pickUniqueDest(dir: string, baseName: string, extWithDot: string) {
  let n = 0;
  while (true) {
    const name = n === 0 ? `${baseName}${extWithDot}` : `${baseName}-${n}${extWithDot}`;
    const dest = `${dir}${name}`;
    if (!(await pathExists(dest))) return { dest, filename: name };
    n++;
  }
}
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
              (f.startsWith(`${baseNoExt}-`) && f.endsWith(extWithDot))
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

// ---------- thumbs (assetId aware) ----------
async function tryMakeThumbFrom(uri: string, dest: string, t: number) {
  const { uri: tmp } = await VideoThumbnails.getThumbnailAsync(uri, { time: t, quality: 0.6 });
  await FileSystem.copyAsync({ from: tmp, to: dest });
}

async function getOrCreateThumb(videoUri: string, assetId?: string | null): Promise<string | null> {
  try {
    await ensureDir(THUMBS_DIR);
    const dest = thumbPathFor(videoUri);

    // already made?
    const info = await FileSystem.getInfoAsync(dest);
    // @ts-ignore
    if ((info as any)?.exists) return dest;

    // 1) First try the given URI (works for file://)
    try {
      try {
        await tryMakeThumbFrom(videoUri, dest, 1000);
      } catch {
        await tryMakeThumbFrom(videoUri, dest, 0);
      }
      const ok = await FileSystem.getInfoAsync(dest);
      // @ts-ignore
      if ((ok as any)?.exists) return dest;
    } catch (e) {
      // continue to asset fallback
      console.log('[thumbs] primary failed for', videoUri, e);
    }

    // 2) If that fails and we have an assetId, try its localUri from Photos
    if (assetId) {
      try {
        const asset = await MediaLibrary.getAssetInfoAsync(assetId);
        const local = asset?.localUri || asset?.uri;
        if (local) {
          try {
            await tryMakeThumbFrom(local, dest, 1000);
          } catch {
            await tryMakeThumbFrom(local, dest, 0);
          }
          const ok2 = await FileSystem.getInfoAsync(dest);
          // @ts-ignore
          if ((ok2 as any)?.exists) return dest;
        }
      } catch (e2) {
        console.log('[thumbs] asset fallback failed', assetId, e2);
      }
    }

    // still nothing
    return null;
  } catch (e) {
    console.log('[thumbs] error', e);
    return null;
  }
}

// sweep orphaned thumbs (no corresponding video in current index)
async function sweepOrphanThumbs(indexUris?: string[]) {
  try {
    await ensureDir(THUMBS_DIR);
    // @ts-ignore
    const files: string[] = await (FileSystem as any).readDirectoryAsync(THUMBS_DIR);
    if (!files?.length) return 0;

    const allowed = new Set(
      (indexUris ?? (await readIndex()).map(m => m.uri)).map(u => thumbNameFor(u).replace(/\.jpg$/i, '').toLowerCase())
    );

    let removed = 0;
    await mapLimit(files.filter(f => f.toLowerCase().endsWith('.jpg')), 4, async (f) => {
      const base = f.replace(/\.jpg$/i, '').toLowerCase();
      if (!allowed.has(base)) {
        try {
          await FileSystem.deleteAsync(`${THUMBS_DIR}${f}`, { idempotent: true });
          removed++;
        } catch {}
      }
    });
    return removed;
  } catch { return 0; }
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

  outcome?: 'W'|'L'|'T';
  winner?: 'home'|'opponent'|null;
  endedBy?: 'pin'|'decision'|null;
  athletePinned?: boolean;
  athleteWasPinned?: boolean;
  modifiedAt?: number;
};

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

    // If it's a highlight clip (sport === 'highlights'), there is no match outcome—return neutral.
    if (!sc || sc.sport === 'highlights') {
      return { finalScore: null, homeIsAthlete: true, outcome: null, myScore: null, oppScore: null, highlightGold: false };
    }

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

    const homeIsAthlete = sc.homeIsAthlete !== false;
    const myScore = homeIsAthlete ? finalScore.home : finalScore.opponent;
    const oppScore = homeIsAthlete ? finalScore.opponent : finalScore.home;

    let outcome: Outcome | null = sc.outcome ?? null;
    let highlightGold = sc.endedBy === 'pin' ? !!sc.athletePinned : false;

    if (outcome == null) {
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

      if (pinEv && (pinEv.actor === 'home' || pinEv.actor === 'opponent')) {
        const athletePinned =
          (homeIsAthlete && pinEv.actor === 'home') ||
          (!homeIsAthlete && pinEv.actor === 'opponent');
        highlightGold = !!athletePinned;
        outcome = athletePinned ? 'W' : 'L';
      } else {
        outcome = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
      }
    }

    return { finalScore, homeIsAthlete, outcome, myScore, oppScore, highlightGold };
  } catch {
    return { finalScore: null, homeIsAthlete: true, outcome: null, myScore: null, oppScore: null, highlightGold: false };
  }
}

// ---------- retag / move ----------
async function _retagVideo(
  input: { uri: string; oldAthlete: string; sportKey: string; assetId?: string },
  newAthleteRaw: string
) {
  const newAthlete = (newAthleteRaw || '').trim() || 'Unassigned';
  const oldA = (input.oldAthlete || '').trim() || 'Unassigned';
  if (newAthlete === oldA) return;

  // re-resolve source by filename if missing
  let sourceUri = input.uri;
  if (!(await pathExists(sourceUri))) {
    const fileName = (input.uri.split('/').pop() || '');
    const dot = fileName.lastIndexOf('.');
    const baseNoExt = dot > 0 ? fileName.slice(0, dot) : fileName;
    const ext = dot > 0 ? fileName.slice(dot) : '.mp4';

    let found = fileName ? await findByFilename(fileName) : null;
    if (!found) found = await findByLooseBasename(baseNoExt, ext);

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
  const ext = dot > 0 ? srcName.slice(dot) : '.mp4';

  const { dest: newVideoUri, filename: newFileName } = await pickUniqueDest(newDir, base, ext);

  // Sidecar move
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

  await FileSystem.moveAsync({ from: sourceUri, to: newVideoUri });

  const newBase = newFileName.replace(/\.[^/.]+$/, '');
  let sidecarDest = `${newDir}${newBase}.json`;

  try {
    if (sidecarFrom && await pathExists(sidecarFrom)) {
      if (await pathExists(sidecarDest)) sidecarDest = `${newDir}${newBase}-${Date.now()}.json`;
      await FileSystem.moveAsync({ from: sidecarFrom, to: sidecarDest });
    } else {
      const minimal = { athlete: newAthlete, sport: input.sportKey, events: [], homeIsAthlete: true, finalScore: { home: 0, opponent: 0 } };
      await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(minimal));
    }
  } catch {
    try {
      const minimal = { athlete: newAthlete, sport: input.sportKey, events: [], homeIsAthlete: true, finalScore: { home: 0, opponent: 0 } };
      await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(minimal));
    } catch {}
  }

  try {
    const txt = await FileSystem.readAsStringAsync(sidecarDest);
    const sc = (txt ? JSON.parse(txt) : {}) as any;
    sc.athlete = newAthlete;
    if (!sc.sport) sc.sport = input.sportKey;
    await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(sc));
  } catch (e) { console.log('sidecar patch error:', e); }

  const list = await readIndex();
  const updated: IndexMeta[] = list.map(e =>
    e.uri === input.uri || e.uri === sourceUri
      ? {
          ...e,
          uri: newVideoUri,
          athlete: newAthlete,
          displayName: `${newAthlete} — ${e.sport} — ${new Date(e.createdAt).toLocaleString()}`
        }
      : e
  );
  await writeIndexAtomic(updated);

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
// safe wrapper (serialized with the FS queue)
function retagVideo(input: { uri: string; oldAthlete: string; sportKey: string; assetId?: string }, newAthlete: string) {
  return enqueueFs(() => _retagVideo(input, newAthlete));
}

function UploadButton({
  localUri,
  sidecar,
  uploaded,
  onUploaded,
}: {
  localUri: string;
  sidecar?: unknown;
  uploaded?: boolean;
  onUploaded?: (cloudKey: string, url: string) => void;
}) {
  const [state, setState] = useState<'idle'|'uploading'|'done'>(uploaded ? 'done' : 'idle');
  const [error, setError] = useState<string|undefined>();

  useEffect(() => {
    setState(uploaded ? 'done' : 'idle');
  }, [uploaded]);

  if (state === 'done') {
    return <Text style={{ fontWeight: '600', color: 'white' }}>✅ Uploaded</Text>;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={async () => {
          setError(undefined);
          setState('uploading');
          try {
            const { key, url } = await uploadFileOnTap(localUri);
            if (sidecar) await uploadJSONOnTap(sidecar, 'sidecars/');
            setState('done');
            onUploaded?.(key, url);
          } catch (e: any) {
            setError(e?.message ?? 'Upload failed');
            setState('idle');
            Alert.alert('Upload failed', e?.message ?? 'Please try again while online.');
          }
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'white',
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>
          {state === 'uploading' ? 'Uploading…' : 'Upload'}
        </Text>
      </Pressable>
      {state === 'uploading' && <ActivityIndicator />}
      {!!error && <Text style={{ color: 'tomato' }}>{error}</Text>}
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  // stable key for uploadedMap: use assetId if present, else uri
  const keyFor = useCallback((r: Row) => r.assetId ?? r.uri, []);

  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [athletePickerOpen, setAthletePickerOpen] = useState<null | Row>(null);
  const [athleteList, setAthleteList] = useState<{ id: string; name: string; photoUri?: string | null }[]>([]);
  const [newName, setNewName] = useState('');

  const [uploadedMap, setUploadedMap] = useState<Record<string, { key: string; url: string; at: number }>>({});

  // segmented state
  const [view, setView] = useState<'all'|'athletes'|'sports'>('athletes');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const loadingRef = useRef(false);

  // keep a ref of rows for lazy thumb generation to access assetId
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // ---------- build 1 row ----------
  const buildRow = useCallback(async (meta: IndexMeta, eagerThumb: boolean): Promise<Row | null> => {
    const info = await FileSystem.getInfoAsync(meta.uri);
    if (!(info as any)?.exists) return null;

    const scoreBits = await readOutcomeFor(meta.uri);
    const thumb = eagerThumb ? await getOrCreateThumb(meta.uri, meta.assetId) : null;

    return {
      uri: meta.uri,
      displayName: meta.displayName || (meta.uri.split('/').pop() || 'video'),
      athlete: (meta.athlete || 'Unassigned').trim() || 'Unassigned',
      sport: (meta.sport || 'unknown').trim() || 'unknown',
      assetId: meta.assetId,
      size: (info as any)?.size ?? null,
      mtime: (info as any)?.modificationTime ? Math.round(((info as any).modificationTime as number) * 1000) : meta.createdAt ?? null,
      thumbUri: thumb,

      finalScore: scoreBits.finalScore,
      homeIsAthlete: scoreBits.homeIsAthlete,
      outcome: scoreBits.outcome ?? undefined,
      myScore: scoreBits.myScore,
      oppScore: scoreBits.oppScore,
      highlightGold: scoreBits.highlightGold,
    };
  }, []);

  // ---------- initial load with bounded concurrency & eager thumbs for first 12 ----------
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const list: IndexMeta[] = await readIndex();
      const sorted = [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

      const rowsBuilt = await mapLimit(sorted, 4, async (meta, i) => {
        return await buildRow(meta, i < 12);
      });

      const filtered = rowsBuilt.filter(Boolean) as Row[];
      filtered.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
      setRows(filtered);

      try {
        const raw = await AsyncStorage.getItem(ATHLETES_KEY);
        setAthleteList(raw ? JSON.parse(raw) : []);
      } catch { setAthleteList([]); }

      try {
        const rawUp = await AsyncStorage.getItem(UPLOADED_MAP_KEY);
        setUploadedMap(rawUp ? JSON.parse(rawUp) : {});
      } catch { setUploadedMap({}); }

      // opportunistically sweep orphan thumbs (quietly)
      try { await sweepOrphanThumbs(sorted.map(m => m.uri)); } catch {}
    } finally {
      loadingRef.current = false;
    }
  }, [buildRow]);

  // initial + focus refresh
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ----- FAST PATH: patch only the edited row on sidecarUpdated -----
  const patchRowFromSidecarPayload = useCallback(async (uri: string, sc?: any) => {
    let nextBits: { finalScore: FinalScore | null; homeIsAthlete: boolean; outcome: Outcome | null; myScore: number | null; oppScore: number | null; highlightGold: boolean } | null = null;

    if (sc) {
      try {
        const homeIsAthlete = sc.homeIsAthlete !== false;
        const finalScore: FinalScore | null = sc.finalScore ?? null;
        let myScore: number | null = null, oppScore: number | null = null, outcome: Outcome | null = sc.outcome ?? null, highlightGold = false;

        if (finalScore) {
          myScore = homeIsAthlete ? finalScore.home : finalScore.opponent;
          oppScore = homeIsAthlete ? finalScore.opponent : finalScore.home;
        }

        if (sc.endedBy === 'pin') highlightGold = !!sc.athletePinned;
        if (!outcome && finalScore) {
          outcome = (myScore! > oppScore!) ? 'W' : (myScore! < oppScore!) ? 'L' : 'T';
        }

        nextBits = { finalScore, homeIsAthlete, outcome, myScore, oppScore, highlightGold };
      } catch { nextBits = null; }
    }

    if (!nextBits) {
      const b = await readOutcomeFor(uri);
      nextBits = {
        finalScore: b.finalScore, homeIsAthlete: b.homeIsAthlete, outcome: b.outcome,
        myScore: b.myScore, oppScore: b.oppScore, highlightGold: b.highlightGold
      };
    }

    setRows(prev =>
      prev.map(r =>
        r.uri === uri
          ? {
              ...r,
              finalScore: nextBits!.finalScore,
              homeIsAthlete: nextBits!.homeIsAthlete,
              outcome: nextBits!.outcome ?? undefined,
              myScore: nextBits!.myScore,
              oppScore: nextBits!.oppScore,
              highlightGold: nextBits!.highlightGold,
            }
          : r
      )
    );
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sidecarUpdated', async (evt: any) => {
      const uri = evt?.uri as string | undefined;
      if (!uri) return;
      await patchRowFromSidecarPayload(uri, evt?.sidecar);
    });
    return () => sub.remove();
  }, [patchRowFromSidecarPayload]);

  // confirm-before-delete
  const confirmRemove = useCallback((row: Row) => {
    Alert.alert(
      'Delete this video?',
      'This removes the file, its index entry, and its cached thumbnail.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeVideo(row) },
      ]
    );
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
      try { await sweepOrphanThumbs(); } catch {}
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // delete handler (serialized through FS queue) + thumb cleanup
  const removeVideo = useCallback(async (row: Row) => {
    await enqueueFs(async () => {
      try {
        // delete the video file
        try { await FileSystem.deleteAsync(row.uri, { idempotent: true }); } catch {}

        // delete the cached thumbnail (if present)
        try {
          const t = thumbPathFor(row.uri);
          const info = await FileSystem.getInfoAsync(t);
          // @ts-ignore
          if ((info as any)?.exists) await FileSystem.deleteAsync(t, { idempotent: true });
        } catch {}

        // drop from index
        const current = await readIndex();
        const updated = current.filter(e => e.uri !== row.uri);
        await writeIndexAtomic(updated);

        // delete from Photos (if it was saved there)
        if (row.assetId) {
          try {
            const { granted } = await MediaLibrary.requestPermissionsAsync();
            if (granted) await MediaLibrary.deleteAssetsAsync([row.assetId]);
          } catch {}
        }

        Alert.alert('Deleted', 'Video removed.');
        await load();
      } catch (e: any) {
        console.log('delete error:', e);
        Alert.alert('Delete failed', String(e?.message ?? e));
      }
    });
  }, [load]);

  const saveToPhotos = useCallback(async (uri: string) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) { Alert.alert('Photos permission needed', 'Allow access to save your video.'); return; }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved to Photos', 'Check your Photos app.');
  }, []);

  const routerPushPlayback = useCallback((row: Row) => {
    router.push({
      pathname: '/screens/PlaybackScreen',
      params: { videoPath: row.uri, athlete: row.athlete, sport: row.sport, displayName: row.displayName },
    });
  }, [router]);

  // >>> define doEditAthlete used by the modal (serialized) <<<
  const doEditAthlete = useCallback(
    async (row: Row, newAthlete: string) => {
      try {
        await retagVideo(
          { uri: row.uri, oldAthlete: row.athlete, sportKey: row.sport, assetId: row.assetId },
          newAthlete
        );
        await load();
      } catch (e: any) {
        console.log('retag error', e);
        const msg = e?.message || String(e);
        Alert.alert(
          'Update failed',
          msg.includes('Original file not found') ? `${msg}\n\nTap Refresh and try again.` : msg
        );
      }
    },
    [load]
  );

  // ====== GROUPINGS ======
  const allRows = useMemo(() => [...rows].sort((a,b)=>(b.mtime ?? 0)-(a.mtime ?? 0)), [rows]);

  const rowsByAthlete = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) { const k = r.athlete || 'Unassigned'; (map[k] ||= []).push(r); }
    return map;
  }, [allRows]);

  const rowsBySport = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of allRows) { const k = r.sport || 'unknown'; (map[k] ||= []).push(r); }
    return map;
  }, [allRows]);

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

  // ====== FlatList helpers ======
  const outcomeColor = (o?: Outcome | null) =>
    o === 'W' ? '#16a34a' : o === 'L' ? '#dc2626' : o === 'T' ? '#f59e0b' : 'rgba(255,255,255,0.25)';

  const renderVideoRow = useCallback(({ item }: { item: Row }) => {
    const dateStr = item.mtime ? new Date(item.mtime).toLocaleString() : '—';
    const subtitleBits = [
      item.athlete ? `👤 ${item.athlete}` : null,
      item.sport ? `🏷️ ${item.sport}` : null,
      `${bytesToMB(item.size)}`,
      dateStr,
    ].filter(Boolean);

    const chip = (item.sport !== 'highlights' && item.outcome && item.myScore != null && item.oppScore != null)
      ? { text: `${item.outcome} ${item.myScore}–${item.oppScore}`, color: outcomeColor(item.outcome) }
      : null;

    const uploaded = uploadedMap[keyFor(item)];

    return (
      <Pressable
        onPress={() => routerPushPlayback(item)}
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
        {item.highlightGold && (
          <>
            <LinearGradient
              colors={['#f7d774', '#d4a017', '#b88912']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          </>
        )}

        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {item.thumbUri ? (
              <Image
                key={item.thumbUri || item.uri}
                source={{ uri: item.thumbUri }}
                style={{ width: 96, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}
                contentFit="cover"
                transition={100}
              />
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

                <TouchableOpacity onPress={() => routerPushPlayback(item)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Play</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => confirmRemove(item)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(220,0,0,0.9)' }}>
                  <Text style={{ color: 'white', fontWeight: '800' }}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setAthletePickerOpen(item)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Edit Athlete</Text>
                </TouchableOpacity>

                <View style={{ marginTop: 8, alignItems: 'center' }}>
                  <UploadButton
                    localUri={item.uri}
                    uploaded={!!uploaded}
                    sidecar={{
                      videoPath: item.uri,
                      athlete: item.athlete,
                      sport: item.sport,
                      createdAt: item.mtime ?? Date.now(),
                    }}
                    onUploaded={(key, url) => {
                      const mapKey = keyFor(item);
                      setUploadedMap(prev => {
                        const next = { ...prev, [mapKey]: { key, url, at: Date.now() } };
                        AsyncStorage.setItem(UPLOADED_MAP_KEY, JSON.stringify(next)).catch(() => {});
                        return next;
                      });
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }, [routerPushPlayback, saveToPhotos, confirmRemove, uploadedMap, keyFor]);

  // Lazy thumbnails for viewable rows (now assetId-aware)
  const thumbQueueRef = useRef<Set<string>>(new Set());
  const onViewableItemsChanged = useRef(({ changed }: { changed: ViewToken[] }) => {
    const toFetch: string[] = [];
    changed.forEach(vt => {
      const row = vt.item as Row;
      if (!row?.uri) return;
      if (vt.isViewable && !row.thumbUri && !thumbQueueRef.current.has(row.uri)) {
        thumbQueueRef.current.add(row.uri);
        toFetch.push(row.uri);
      }
    });
    if (!toFetch.length) return;

    (async () => {
      const updated: { uri: string; thumb: string | null }[] = await mapLimit(toFetch, 3, async (uri) => {
        const row = rowsRef.current.find(r => r.uri === uri);
        const thumb = await getOrCreateThumb(uri, row?.assetId);
        return { uri, thumb };
      });
      setRows(prev =>
        prev.map(r => {
          const hit = updated.find(u => u.uri === r.uri);
          return hit ? { ...r, thumbUri: hit.thumb } : r;
        })
      );
      updated.forEach(u => thumbQueueRef.current.delete(u.uri));
    })();
  }).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 40 });

  // ====== UI ======
  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>Library</Text>
        <TouchableOpacity onPress={onRefresh} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'white' }}>
          <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* segmented */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
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

      {/* All Videos */}
      {view === 'all' && (
        <FlatList
          data={allRows}
          keyExtractor={(it) => it.uri}
          renderItem={renderVideoRow}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ListEmptyComponent={<Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>No recordings yet. Record a match, then come back.</Text>}

          // performance tuning
          initialNumToRender={10}
          windowSize={7}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews

          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef.current}
        />
      )}

      {/* Athletes root */}
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
                      contentFit="cover"
                      transition={100}
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

      {/* Athletes ➜ Sports */}
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
                      <Image
                        source={{ uri: preview }}
                        style={{ width: 72, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}
                        contentFit="cover"
                        transition={100}
                      />
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

      {/* Athletes ➜ Sports ➜ Videos */}
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
            initialNumToRender={8}
            windowSize={7}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewConfigRef.current}
          />
        </View>
      )}

      {/* Sports tab (global) */}
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
          <FlatList
            data={rowsBySport[selectedSport] ?? []}
            keyExtractor={(it)=>it.uri}
            renderItem={renderVideoRow}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
            initialNumToRender={8}
            windowSize={7}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewConfigRef.current}
          />
        </View>
      )}

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
