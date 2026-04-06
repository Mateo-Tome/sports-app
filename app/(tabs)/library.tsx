// app/(tabs)/library.tsx
// Library: optimized load + fast row patching + safe FS ops + thumb cleanup

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Modal,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LibraryVideoRow,
  type LibraryRow,
} from '../../components/library/LibraryVideoRow';

import EditAthleteModal from '../../components/library/EditAthleteModal';
import EditTitleModal from '../../components/library/EditTitleModal';
import LibraryDataSourceToggle from '../../components/library/LibraryDataSourceToggle';
import LibraryGroupedViews from '../../components/library/LibraryGroupedViews';
import { useLibraryDataSource } from '../../src/hooks/library/useLibraryDataSource';

import {
  readIndex,
  writeIndexAtomic,
  type IndexMeta,
} from '../../lib/library/indexStore';

import retagVideo from '../../lib/library/retag';
import {
  getSportKeyFromSidecar,
  readOutcomeFor,
  readSidecarForUpload,
} from '../../lib/library/sidecars';
import {
  getOrCreateThumb,
  sweepOrphanThumbs,
  thumbPathFor,
} from '../../lib/library/thumbs';

import { deleteCloudVideo } from '../../lib/backend';
import { ensureAnonymous } from '../../lib/firebase';
import { buildLibraryRows } from '../../lib/library/buildLibraryRows';
import '../../lib/library/sportLibraryBitsInit';
import { buildSportLibraryBits } from '../../lib/library/sportLibraryStyleRegistry';

const UPLOADED_MAP_KEY = 'uploaded:map';

function athletesKey(uid: string) {
  return `athletes:list:${uid}`;
}

type Row = LibraryRow;

type Athlete = {
  id: string;
  name: string;
  photoUri?: string | null;
  photoLocalUri?: string | null;
  photoUrl?: string | null;
  photoKey?: string | null;
  photoUpdatedAt?: number | null;
};

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

let __fsQueue: Promise<any> = Promise.resolve();
function enqueueFs<T>(fn: () => Promise<T>): Promise<T> {
  const task = __fsQueue.then(fn, fn);
  __fsQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  const keyFor = useCallback((r: Row) => r.assetId ?? r.uri, []);

  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [athletePickerOpen, setAthletePickerOpen] = useState<null | Row>(null);
  const [athleteList, setAthleteList] = useState<Athlete[]>([]);
  const [uploadedMap, setUploadedMap] = useState<
    Record<string, { key: string; url: string; at: number }>
  >({});

  const [titleEditRow, setTitleEditRow] = useState<Row | null>(null);

  const [view, setView] = useState<'all' | 'athletes' | 'sports'>('athletes');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const loadingRef = useRef(false);

  const {
    dataSource,
    setDataSource,
    sourceRows,
    cloudCount,
    routerPushPlayback,
    refreshCloudRows,
  } = useLibraryDataSource(router as any, rows);

  const rowsRef = useRef<Row[]>([]);
  useEffect(() => {
    rowsRef.current = sourceRows as any;
  }, [sourceRows]);

  const legacyLoad = useCallback(async () => {
    const buildRow = async (meta: IndexMeta, eagerThumb: boolean) => {
      const info: any = await FileSystem.getInfoAsync(meta.uri);
      if (!info?.exists) return null;

      const scoreBits = await readOutcomeFor(meta.uri);

      let thumb: string | null = null;
      if (eagerThumb) {
        thumb = await getOrCreateThumb(meta.uri, meta.assetId);
      } else {
        const cached = thumbPathFor(meta.uri);
        try {
          const tInfo: any = await FileSystem.getInfoAsync(cached);
          if (tInfo?.exists) thumb = cached;
        } catch {}
      }

      const row: Row = {
        uri: meta.uri,
        displayName: meta.displayName || (meta.uri.split('/').pop() || 'video'),
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
    };

    const list: IndexMeta[] = await readIndex();
    const sorted = [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    const rowsBuilt = await mapLimit(sorted, 4, async (meta, i) => {
      return await buildRow(meta, i < 12);
    });

    const filtered = rowsBuilt.filter(Boolean) as Row[];
    filtered.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    setRows(filtered);

    try {
      const u = await ensureAnonymous();
      const raw = await AsyncStorage.getItem(athletesKey(u.uid));
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

    try {
      await sweepOrphanThumbs(sorted.map((m) => m.uri));
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      try {
        const out = await buildLibraryRows();
        setRows(out.rows);
        setAthleteList(out.athleteList);
        setUploadedMap(out.uploadedMap);
      } catch (e) {
        console.log('buildLibraryRows failed -> falling back to legacyLoad', e);
        await legacyLoad();
      }
    } finally {
      loadingRef.current = false;
    }
  }, [legacyLoad]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const patchRowFromSidecarPayload = useCallback(
    async (uri: string, payloadSidecar?: any) => {
      const sidecar = payloadSidecar ?? (await readSidecarForUpload(uri));
      const scoreBits = await readOutcomeFor(uri);

      const effectiveSport = sidecar ? getSportKeyFromSidecar(sidecar) : '';
      const sportBits = buildSportLibraryBits(effectiveSport || '', sidecar);

      const finalEdgeColor =
        (sportBits.edgeColor ?? null) ?? (scoreBits.edgeColor ?? null);

      const finalHighlightGold =
        typeof sportBits.highlightGold === 'boolean'
          ? sportBits.highlightGold
          : scoreBits.highlightGold;

      const sportLower = String(effectiveSport || '').toLowerCase();
      const isWrestling = sportLower.startsWith('wrestling');

      setRows((prev) =>
        prev.map((r) =>
          r.uri === uri
            ? ({
                ...r,
                finalScore: isWrestling ? scoreBits.finalScore : null,
                homeIsAthlete: isWrestling ? scoreBits.homeIsAthlete : null,
                outcome: isWrestling ? (scoreBits.outcome ?? undefined) : undefined,
                myScore: isWrestling ? scoreBits.myScore : null,
                oppScore: isWrestling ? scoreBits.oppScore : null,
                highlightGold: finalHighlightGold,
                edgeColor: finalEdgeColor,
                libraryStyle: {
                  edgeColor: finalEdgeColor,
                  badgeText: sportBits.badgeText ?? null,
                  badgeColor:
                    sportBits.badgeColor ??
                    sportBits.edgeColor ??
                    finalEdgeColor ??
                    null,
                },
                hittingLabel: sportBits.hittingLabel ?? null,
                pitchingLabel: sportBits.pitchingLabel ?? null,
              } as any)
            : r,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sidecarUpdated', async (evt: any) => {
      const uri = evt?.uri as string | undefined;
      if (!uri) return;
      await patchRowFromSidecarPayload(uri, evt?.sidecar);
    });
    return () => sub.remove();
  }, [patchRowFromSidecarPayload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (dataSource === 'cloud') {
        await refreshCloudRows();
      } else {
        await load();
        try {
          await sweepOrphanThumbs();
        } catch {}
      }
    } finally {
      setRefreshing(false);
    }
  }, [dataSource, load, refreshCloudRows]);

  const removeVideo = useCallback(
    async (row: Row) => {
      const isCloud = String(row.uri).startsWith('cloud:');

      if (isCloud) {
        try {
          if (!row.videoId) {
            Alert.alert('Delete failed', 'Missing cloud video id.');
            return;
          }

          await deleteCloudVideo(row.videoId);
          await refreshCloudRows();
          Alert.alert('Deleted', 'Cloud video removed.');
        } catch (e: any) {
          console.log('cloud delete error', e);
          Alert.alert('Delete failed', String(e?.message ?? e));
        }
        return;
      }

      await enqueueFs(async () => {
        try {
          try {
            await FileSystem.deleteAsync(row.uri, { idempotent: true });
          } catch {}

          try {
            const t = thumbPathFor(row.uri);
            const info: any = await FileSystem.getInfoAsync(t);
            if (info?.exists) await FileSystem.deleteAsync(t, { idempotent: true });
          } catch {}

          const current = await readIndex();
          const updated = current.filter((e) => e.uri !== row.uri);
          await writeIndexAtomic(updated);

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
    [load, refreshCloudRows],
  );

  const confirmRemove = useCallback(
    (row: Row) => {
      const isCloud = String(row.uri).startsWith('cloud:');

      Alert.alert(
        'Delete this video?',
        isCloud
          ? 'This removes the cloud video and its linked metadata.'
          : 'This removes the file, its index entry, and its cached thumbnail.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => removeVideo(row) },
        ],
      );
    },
    [removeVideo],
  );

  const saveToPhotos = useCallback(async (uri: string) => {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Photos permission needed', 'Allow access to save your video.');
      return;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved to Photos', 'Check your Photos app.');
  }, []);

  const doEditAthlete = useCallback(
    async (row: Row, newAthlete: string) => {
      try {
        if (String(row.uri).startsWith('cloud:')) {
          Alert.alert('Cloud clip', 'Retagging is local-only for now.');
          return;
        }

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

  const { allRows, rowsByAthlete, rowsBySport, athleteSportsMap } = useMemo(() => {
    const allRowsLocal: Row[] = [...(sourceRows as any as Row[])].sort(
      (a, b) => (b.mtime ?? 0) - (a.mtime ?? 0),
    );

    const rowsByAthleteLocal: Record<string, Row[]> = {};
    const rowsBySportLocal: Record<string, Row[]> = {};
    const athleteSportsMapLocal: Record<string, Record<string, Row[]>> = {};

    for (const r of allRowsLocal) {
      const athlete = r.athlete || 'Unassigned';
      const sport = r.sport || 'unknown';

      (rowsByAthleteLocal[athlete] ||= []).push(r);
      (rowsBySportLocal[sport] ||= []).push(r);

      (athleteSportsMapLocal[athlete] ||= {});
      (athleteSportsMapLocal[athlete][sport] ||= []);
      athleteSportsMapLocal[athlete][sport].push(r);
    }

    for (const a of Object.keys(athleteSportsMapLocal)) {
      for (const s of Object.keys(athleteSportsMapLocal[a])) {
        athleteSportsMapLocal[a][s].sort((x, y) => (y.mtime ?? 0) - (x.mtime ?? 0));
      }
    }

    return {
      allRows: allRowsLocal,
      rowsByAthlete: rowsByAthleteLocal,
      rowsBySport: rowsBySportLocal,
      athleteSportsMap: athleteSportsMapLocal,
    };
  }, [sourceRows]);

  const photoFor = useCallback(
    (name: string) => {
      const a = athleteList.find((x) => x.name === name);
      return a?.photoLocalUri ?? a?.photoUrl ?? a?.photoUri ?? null;
    },
    [athleteList],
  );

  const openEditName = useCallback((row: Row) => {
    setTitleEditRow(row);
  }, []);

  const closeTitleModal = useCallback(() => {
    setTitleEditRow(null);
  }, []);

  const handleSubmitTitle = useCallback(
    async (newTitle: string) => {
      if (!titleEditRow) {
        closeTitleModal();
        return;
      }

      if (String(titleEditRow.uri).startsWith('cloud:')) {
        Alert.alert('Cloud clip', 'Title edits are local-only for now.');
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
          e.uri === titleEditRow.uri ? { ...e, displayName: trimmed } : e,
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

      const exists = athleteList.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());

      if (!exists) {
        const newEntry: Athlete = { id: `${Date.now()}`, name: trimmed };
        const nextList = [newEntry, ...athleteList];
        setAthleteList(nextList);

        try {
          const u = await ensureAnonymous();
          await AsyncStorage.setItem(athletesKey(u.uid), JSON.stringify(nextList));
        } catch {}
      }

      await doEditAthlete(athletePickerOpen, trimmed);
      setAthletePickerOpen(null);
    },
    [athletePickerOpen, athleteList, doEditAthlete],
  );

  const renderVideoRow = useCallback(
    ({ item }: { item: Row }) => {
      const isCloud = String(item.uri).startsWith('cloud:');
      const uploaded = isCloud ? true : !!uploadedMap[keyFor(item)];

      return (
        <LibraryVideoRow
          row={item}
          uploaded={uploaded}
          onPressPlay={() => routerPushPlayback(item)}
          onPressDelete={() => confirmRemove(item)}
          onPressEditAthlete={() => handlePressEditAthlete(item)}
          onPressEditTitle={() => openEditName(item)}
          onPressSaveToPhotos={() => {
            if (isCloud) {
              Alert.alert('Cloud clip', 'Save to Photos is local-only for now.');
              return;
            }
            saveToPhotos(item.uri);
          }}
          onUploaded={(key, url) => {
            if (isCloud) return;

            const mapKey = keyFor(item);
            setUploadedMap((prev) => {
              const next = { ...prev, [mapKey]: { key, url, at: Date.now() } };
              AsyncStorage.setItem(UPLOADED_MAP_KEY, JSON.stringify(next)).catch(() => {});
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

  const thumbQueueRef = useRef<Set<string>>(new Set());
  const onViewableItemsChanged = useRef(({ changed }: { changed: ViewToken[] }) => {
    const toFetch: string[] = [];
    changed.forEach((vt) => {
      const row = vt.item as Row;
      if (!row?.uri) return;

      if (String(row.uri).startsWith('cloud:')) return;

      if (vt.isViewable && !row.thumbUri && !thumbQueueRef.current.has(row.uri)) {
        thumbQueueRef.current.add(row.uri);
        toFetch.push(row.uri);
      }
    });
    if (!toFetch.length) return;

    (async () => {
      const updated: { uri: string; thumb: string | null }[] = await mapLimit(
        toFetch,
        3,
        async (uri) => {
          const row = rowsRef.current.find((r) => r.uri === uri);
          const thumb = await getOrCreateThumb(uri, row?.assetId);
          return { uri, thumb };
        },
      );

      setRows((prev) =>
        prev.map((r) => {
          const hit = updated.find((u) => u.uri === r.uri);
          return hit ? { ...r, thumbUri: hit.thumb } : r;
        }),
      );

      updated.forEach((u) => thumbQueueRef.current.delete(u.uri));
    })();
  }).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 40 });

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <View
        style={{
          paddingTop: Math.max(insets.top, 10),
          paddingHorizontal: 12,
          paddingBottom: 8,
          backgroundColor: 'black',
        }}
      >
        <LibraryDataSourceToggle
          dataSource={dataSource}
          onChange={setDataSource}
          cloudCount={cloudCount}
        />
      </View>

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

      <EditAthleteModal
        visible={!!athletePickerOpen}
        row={athletePickerOpen}
        athleteList={athleteList as any}
        onClose={closeAthleteModal}
        onSelectExisting={handleSelectExistingAthlete}
        onSubmitNewAthlete={handleSubmitNewAthlete}
      />

      <EditTitleModal
        visible={!!titleEditRow}
        row={titleEditRow}
        onClose={closeTitleModal}
        onSubmit={handleSubmitTitle}
      />
    </View>
  );
}

const styles = StyleSheet.create({});