// app/(tabs)/library.tsx
// Library: optimized load + fast row patching + safe FS ops + thumb cleanup

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import {
  LibraryVideoRow,
  type LibraryRow,
} from '../../components/library/LibraryVideoRow';
import {
  readIndex,
  writeIndexAtomic,
  type IndexMeta,
} from '../../lib/library/indexStore';

// retagging logic
import retagVideo from '../../lib/library/retag';

import { readOutcomeFor } from '../../lib/library/sidecars';
import {
  getOrCreateThumb,
  sweepOrphanThumbs,
  thumbPathFor,
} from '../../lib/library/thumbs';

import EditAthleteModal from '../../components/library/EditAthleteModal';
import EditTitleModal from '../../components/library/EditTitleModal';
import LibraryGroupedViews from '../../components/library/LibraryGroupedViews';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Modal,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DIR = FileSystem.documentDirectory + 'videos/';
const ATHLETES_KEY = 'athletes:list';
const UPLOADED_MAP_KEY = 'uploaded:map';

type Row = LibraryRow;
type Athlete = { id: string; name: string; photoUri?: string | null };

// ----- bounded concurrency helper -----
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
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
  __fsQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

// ===========================================================================

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  // stable key for uploadedMap: use assetId if present, else uri
  const keyFor = useCallback((r: Row) => r.assetId ?? r.uri, []);

  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [athletePickerOpen, setAthletePickerOpen] = useState<null | Row>(null);
  const [athleteList, setAthleteList] = useState<Athlete[]>([]);
  const [uploadedMap, setUploadedMap] = useState<
    Record<string, { key: string; url: string; at: number }>
  >({});

  // Title editor modal state
  const [titleEditRow, setTitleEditRow] = useState<Row | null>(null);

  // segmented state
  const [view, setView] = useState<'all' | 'athletes' | 'sports'>('athletes');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const loadingRef = useRef(false);

  // keep a ref of rows for lazy thumb generation to access assetId
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // ---------- build 1 row ----------
  const buildRow = useCallback(
    async (meta: IndexMeta, eagerThumb: boolean) => {
      const info: any = await FileSystem.getInfoAsync(meta.uri);
      if (!info?.exists) return null;

      const scoreBits = await readOutcomeFor(meta.uri);

      // Thumbnails:
      // - For newest items (eagerThumb === true): generate or fetch immediately.
      // - For older items: reuse cached file if it already exists so lists "pop in" polished.
      let thumb: string | null = null;
      if (eagerThumb) {
        thumb = await getOrCreateThumb(meta.uri, meta.assetId);
      } else {
        const cached = thumbPathFor(meta.uri);
        try {
          const tInfo: any = await FileSystem.getInfoAsync(cached);
          if (tInfo?.exists) {
            thumb = cached;
          }
        } catch {
          // ignore – we'll lazily generate on scroll if needed
        }
      }

      const row: Row = {
        uri: meta.uri,
        displayName:
          meta.displayName || (meta.uri.split('/').pop() || 'video'),
        athlete: (meta.athlete || 'Unassigned').trim() || 'Unassigned',
        sport: (meta.sport || 'unknown').trim() || 'unknown',
        assetId: meta.assetId,
        size: info?.size ?? null,
        mtime: info?.modificationTime
          ? Math.round((info.modificationTime as number) * 1000)
          : meta.createdAt ?? null,
        thumbUri: thumb,

        finalScore: scoreBits.finalScore,
        homeIsAthlete: scoreBits.homeIsAthlete,
        outcome: scoreBits.outcome ?? undefined,
        myScore: scoreBits.myScore,
        oppScore: scoreBits.oppScore,
        highlightGold: scoreBits.highlightGold,
        edgeColor: scoreBits.edgeColor,
      };

      return row;
    },
    [],
  );

  // ---------- initial load with bounded concurrency & eager thumbs for first 12 ----------
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const list: IndexMeta[] = await readIndex();
      const sorted = [...list].sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
      );

      const rowsBuilt = await mapLimit(sorted, 4, async (meta, i) => {
        return await buildRow(meta, i < 12);
      });

      const filtered = rowsBuilt.filter(Boolean) as Row[];
      filtered.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
      setRows(filtered);

      try {
        const raw = await AsyncStorage.getItem(ATHLETES_KEY);
        setAthleteList(raw ? (JSON.parse(raw) as Athlete[]) : []);
      } catch {
        setAthleteList([]);
      }

      try {
        const rawUp = await AsyncStorage.getItem(UPLOADED_MAP_KEY);
        setUploadedMap(rawUp ? JSON.parse(rawUp) : {});
      } catch {
        setUploadedMap({});
      }

      // opportunistically sweep orphan thumbs (quietly)
      try {
        await sweepOrphanThumbs(sorted.map((m) => m.uri));
      } catch {}
    } finally {
      loadingRef.current = false;
    }
  }, [buildRow]);

  // initial + focus refresh
  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // ----- FAST PATH: patch row when sidecarUpdated (just re-read outcome) ---
  const patchRowFromSidecarPayload = useCallback(async (uri: string) => {
    const b = await readOutcomeFor(uri);

    setRows((prev) =>
      prev.map((r) =>
        r.uri === uri
          ? {
              ...r,
              finalScore: b.finalScore,
              homeIsAthlete: b.homeIsAthlete,
              outcome: b.outcome ?? undefined,
              myScore: b.myScore,
              oppScore: b.oppScore,
              highlightGold: b.highlightGold,
              edgeColor: b.edgeColor,
            }
          : r,
      ),
    );
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'sidecarUpdated',
      async (evt: any) => {
        const uri = evt?.uri as string | undefined;
        if (!uri) return;
        await patchRowFromSidecarPayload(uri);
      },
    );
    return () => sub.remove();
  }, [patchRowFromSidecarPayload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
      try {
        await sweepOrphanThumbs();
      } catch {}
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // delete handler (serialized through FS queue) + thumb cleanup
  const removeVideo = useCallback(
    async (row: Row) => {
      await enqueueFs(async () => {
        try {
          // delete the video file
          try {
            await FileSystem.deleteAsync(row.uri, { idempotent: true });
          } catch {}

          // delete the cached thumbnail (if present)
          try {
            const t = thumbPathFor(row.uri);
            const info: any = await FileSystem.getInfoAsync(t);
            if (info?.exists)
              await FileSystem.deleteAsync(t, { idempotent: true });
          } catch {}

          // drop from index
          const current = await readIndex();
          const updated = current.filter((e) => e.uri !== row.uri);
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
          console.log('delete error', e);
          Alert.alert('Delete failed', String(e?.message ?? e));
        }
      });
    },
    [load],
  );

  // confirm-before-delete
  const confirmRemove = useCallback(
    (row: Row) => {
      Alert.alert(
        'Delete this video?',
        'This removes the file, its index entry, and its cached thumbnail.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => removeVideo(row),
          },
        ],
      );
    },
    [removeVideo],
  );

  const saveToPhotos = useCallback(async (uri: string) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Photos permission needed',
        'Allow access to save your video.',
      );
      return;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved to Photos', 'Check your Photos app.');
  }, []);

  const routerPushPlayback = useCallback(
    (row: Row) => {
      router.push({
        pathname: '/screens/PlaybackScreen',
        params: {
          videoPath: row.uri,
          athlete: row.athlete,
          sport: row.sport,
          displayName: row.displayName,
        },
      });
    },
    [router],
  );

  // >>> define doEditAthlete used by the modal (FS-queued retag) <<<
  const doEditAthlete = useCallback(
    async (row: Row, newAthlete: string) => {
      try {
        await retagVideo(
          {
            uri: row.uri,
            oldAthlete: row.athlete,
            sportKey: row.sport,
            assetId: row.assetId,
          },
          newAthlete,
        );
        await load();
      } catch (e: any) {
        console.log('retag error', e);
        const msg = e?.message || String(e);
        Alert.alert(
          'Update failed',
          msg.includes('Original file not found')
            ? `${msg}\n\nTap Refresh and try again.`
            : msg,
        );
      }
    },
    [load],
  );

  // ====== GROUPINGS (inline helper instead of separate module) ======
  const {
    allRows,
    rowsByAthlete,
    rowsBySport,
    athleteSportsMap,
  } = useMemo(() => {
    // Sort newest first
    const allRowsLocal: Row[] = [...rows].sort(
      (a, b) => (b.mtime ?? 0) - (a.mtime ?? 0),
    );

    const rowsByAthleteLocal: Record<string, Row[]> = {};
    const rowsBySportLocal: Record<string, Row[]> = {};
    const athleteSportsMapLocal: Record<string, Record<string, Row[]>> = {};

    for (const r of allRowsLocal) {
      const athlete = r.athlete || 'Unassigned';
      const sport = r.sport || 'unknown';

      // By athlete
      (rowsByAthleteLocal[athlete] ||= []).push(r);

      // By sport
      (rowsBySportLocal[sport] ||= []).push(r);

      // Nested athlete ➜ sport ➜ rows
      (athleteSportsMapLocal[athlete] ||= {});
      (athleteSportsMapLocal[athlete][sport] ||= []);
      athleteSportsMapLocal[athlete][sport].push(r);
    }

    // Ensure athleteSportsMap lists are also sorted newest-first
    for (const a of Object.keys(athleteSportsMapLocal)) {
      for (const s of Object.keys(athleteSportsMapLocal[a])) {
        athleteSportsMapLocal[a][s].sort(
          (x, y) => (y.mtime ?? 0) - (x.mtime ?? 0),
        );
      }
    }

    return {
      allRows: allRowsLocal,
      rowsByAthlete: rowsByAthleteLocal,
      rowsBySport: rowsBySportLocal,
      athleteSportsMap: athleteSportsMapLocal,
    };
  }, [rows]);

  const photoFor = useCallback(
    (name: string) =>
      athleteList.find((a) => a.name === name)?.photoUri ?? null,
    [athleteList],
  );

  const openEditName = useCallback((row: Row) => {
    setTitleEditRow(row);
  }, []);

  // --- title edit helpers ---
  const closeTitleModal = useCallback(() => {
    setTitleEditRow(null);
  }, []);

  const handleSubmitTitle = useCallback(
    async (newTitle: string) => {
      if (!titleEditRow) {
        closeTitleModal();
        return;
      }

      const trimmed = newTitle.trim();
      if (!trimmed) {
        Alert.alert('Enter a title', 'Please enter a video title.');
        return;
      }

      try {
        const list = await readIndex();
        const updated: IndexMeta[] = list.map((e) =>
          e.uri === titleEditRow.uri
            ? {
                ...e,
                displayName: trimmed,
              }
            : e,
        );
        await writeIndexAtomic(updated);
        await load();
      } catch (e: any) {
        console.log('title update error', e);
        Alert.alert('Update failed', String(e?.message ?? e));
      } finally {
        closeTitleModal();
      }
    },
    [titleEditRow, closeTitleModal, load],
  );

  // --- athlete edit helpers (wire to modal) ---
  const handlePressEditAthlete = useCallback((row: Row) => {
    setAthletePickerOpen(row);
  }, []);

  const closeAthleteModal = useCallback(() => {
    setAthletePickerOpen(null);
  }, []);

  const handleSelectExistingAthlete = useCallback(
    async (name: string) => {
      if (!athletePickerOpen) return;
      await doEditAthlete(athletePickerOpen, name);
      setAthletePickerOpen(null);
    },
    [athletePickerOpen, doEditAthlete],
  );

  const handleSubmitNewAthlete = useCallback(
    async (newName: string) => {
      if (!athletePickerOpen) return;

      const trimmed = newName.trim();
      if (!trimmed) {
        Alert.alert('Enter a name', 'Please enter an athlete name.');
        return;
      }

      // ensure this new athlete exists in the list for future use
      const exists = athleteList.some(
        (a) => a.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (!exists) {
        const newEntry: Athlete = { id: `${Date.now()}`, name: trimmed };
        const nextList = [newEntry, ...athleteList];
        setAthleteList(nextList);
        try {
          await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(nextList));
        } catch {}
      }

      await doEditAthlete(athletePickerOpen, trimmed);
      setAthletePickerOpen(null);
    },
    [athletePickerOpen, athleteList, doEditAthlete],
  );

  // ====== FlatList row renderer (delegates to LibraryVideoRow) ======
  const renderVideoRow = useCallback(
    ({ item }: { item: Row }) => {
      const uploaded = !!uploadedMap[keyFor(item)];

      return (
        <LibraryVideoRow
          row={item}
          uploaded={uploaded}
          onPressPlay={() => routerPushPlayback(item)}
          onPressDelete={() => confirmRemove(item)}
          onPressEditAthlete={() => handlePressEditAthlete(item)}
          onPressEditTitle={() => openEditName(item)}
          onPressSaveToPhotos={() => saveToPhotos(item.uri)}
          onUploaded={(key, url) => {
            const mapKey = keyFor(item);
            setUploadedMap((prev) => {
              const next = {
                ...prev,
                [mapKey]: { key, url, at: Date.now() },
              };
              AsyncStorage.setItem(
                UPLOADED_MAP_KEY,
                JSON.stringify(next),
              ).catch(() => {});
              return next;
            });
          }}
        />
      );
    },
    [
      uploadedMap,
      keyFor,
      routerPushPlayback,
      confirmRemove,
      handlePressEditAthlete,
      openEditName,
      saveToPhotos,
    ],
  );

  // Lazy thumbnails for viewable rows (assetId-aware)
  const thumbQueueRef = useRef<Set<string>>(new Set());
  const onViewableItemsChanged = useRef(
    ({ changed }: { changed: ViewToken[] }) => {
      const toFetch: string[] = [];
      changed.forEach((vt) => {
        const row = vt.item as Row;
        if (!row?.uri) return;
        if (
          vt.isViewable &&
          !row.thumbUri &&
          !thumbQueueRef.current.has(row.uri)
        ) {
          thumbQueueRef.current.add(row.uri);
          toFetch.push(row.uri);
        }
      });
      if (!toFetch.length) return;

      (async () => {
        const updated: { uri: string; thumb: string | null }[] =
          await mapLimit(toFetch, 3, async (uri) => {
            const row = rowsRef.current.find((r) => r.uri === uri);
            const thumb = await getOrCreateThumb(uri, row?.assetId);
            return { uri, thumb };
          });
        setRows((prev) =>
          prev.map((r) => {
            const hit = updated.find((u) => u.uri === r.uri);
            return hit ? { ...r, thumbUri: hit.thumb } : r;
          }),
        );
        updated.forEach((u) => thumbQueueRef.current.delete(u.uri));
      })();
    },
  ).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 40 });

  // ====== UI ======
  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <LibraryGroupedViews
        view={view}
        setView={setView}
        selectedAthlete={selectedAthlete}
        setSelectedAthlete={setSelectedAthlete}
        selectedSport={selectedSport}
        setSelectedSport={setSelectedSport}
        allRows={allRows}
        rowsByAthlete={rowsByAthlete}
        rowsBySport={rowsBySport}
        athleteSportsMap={athleteSportsMap}
        tabBarHeight={tabBarHeight}
        topInset={insets.top}
        renderVideoRow={renderVideoRow}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef.current}
        photoFor={photoFor}
      />

      <Modal visible={false} />

      {/* Edit Athlete modal (own component) */}
      <EditAthleteModal
        visible={!!athletePickerOpen}
        row={athletePickerOpen}
        athleteList={athleteList}
        onClose={closeAthleteModal}
        onSelectExisting={handleSelectExistingAthlete}
        onSubmitNewAthlete={handleSubmitNewAthlete}
      />

      {/* Edit Title modal (own component) */}
      <EditTitleModal
        visible={!!titleEditRow}
        row={titleEditRow}
        onClose={closeTitleModal}
        onSubmit={handleSubmitTitle}
      />
    </View>
  );
}

// (Optional) empty stylesheet if you want to attach styles later
const styles = StyleSheet.create({});
