// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onAuthStateChanged } from 'firebase/auth';
import { auth, ensureAnonymous } from '../../lib/firebase';
import { getCloudAthletes } from '../../src/hooks/athletes/cloudAthletes';

import AthleteCard from '../../src/components/AthleteCard';
import useAthleteSync from '../../src/hooks/athletes/useAthleteSync';
import type { Athlete } from '../../src/lib/athleteTypes';

import { persistAthleteProfilePhoto } from '../../src/lib/athletePhotos';
import { uploadAthleteProfilePhotoToB2 } from '../../src/lib/athletePhotoUpload';

const ATHLETES_KEY = 'athletes:list';
const CURRENT_ATHLETE_KEY = 'currentAthleteName';

const wait = (ms = 160) => new Promise((res) => setTimeout(res, ms));

function imagesMediaTypesLegacy(): any {
  const MT = (ImagePicker as any).MediaType;
  return MT?.Images ?? MT?.images ?? undefined;
}

async function ensurePickerPermissions(): Promise<boolean> {
  try {
    let cam = await ImagePicker.getCameraPermissionsAsync();
    let lib = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (cam.status !== 'granted') cam = await ImagePicker.requestCameraPermissionsAsync();
    if (lib.status !== 'granted') lib = await ImagePicker.requestMediaLibraryPermissionsAsync();

    const blocked = (p: ImagePicker.PermissionResponse) =>
      p.status === 'denied' && p.canAskAgain === false;

    if (blocked(cam) || blocked(lib)) {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Permissions needed',
          'Camera/Photos access is blocked. Open Settings to enable?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Open Settings', onPress: () => resolve(true) },
          ],
          { cancelable: true }
        );
      });
      if (go) Linking.openSettings();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function pickImageWithChoice(launchedFromModal: boolean): Promise<string | null> {
  const ok = await ensurePickerPermissions();
  if (!ok) return null;

  try {
    const pending = await (ImagePicker as any).getPendingResultAsync?.();
    if (Array.isArray(pending) && pending.length) {
      // read & ignore to clear internal state
    }
  } catch {}

  if (launchedFromModal) {
    await wait(250);
  }

  await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await wait(140);

  const mediaTypes = imagesMediaTypesLegacy();

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
          userInterfaceStyle: 'dark',
        },
        async (idx) => {
          try {
            if (idx === 1) {
              await new Promise<void>((resolve2) =>
                InteractionManager.runAfterInteractions(() => resolve2())
              );
              await new Promise((r) => requestAnimationFrame(() => r(null)));
              await wait(120);

              const res = await ImagePicker.launchCameraAsync({
                mediaTypes,
                allowsEditing: true,
                quality: 0.85,
              } as any);
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            } else if (idx === 2) {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes,
                allowsEditing: true,
                quality: 0.85,
              } as any);
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        }
      );
    });
  }

  return new Promise((resolve) => {
    const defer = (fn: () => Promise<void>) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            fn().catch(() => resolve(null));
          }, 220);
        });
      });
    };
    Alert.alert(
      'Set Athlete Photo',
      undefined,
      [
        {
          text: 'Take Photo',
          onPress: () =>
            defer(async () => {
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes,
                allowsEditing: true,
                quality: 0.85,
              } as any);
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            }),
        },
        {
          text: 'Choose from Library',
          onPress: () =>
            defer(async () => {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes,
                allowsEditing: true,
                quality: 0.85,
              } as any);
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            }),
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true }
    );
  });
}

function toStringOrNull(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

// ✅ If the local file is missing, clear photoLocalUri so UI falls back to photoUrl
async function scrubMissingLocalPhotos(list: Athlete[]): Promise<Athlete[]> {
  const out: Athlete[] = [];
  let changed = false;

  for (const a of Array.isArray(list) ? list : []) {
    const uri = toStringOrNull((a as any)?.photoLocalUri);

    if (uri && uri.startsWith('file://')) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          out.push({ ...(a as any), photoLocalUri: null } as any);
          changed = true;
          continue;
        }
      } catch {
        out.push({ ...(a as any), photoLocalUri: null } as any);
        changed = true;
        continue;
      }
    }

    out.push(a);
  }

  if (changed) {
    await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(out));
  }
  return out;
}

export default function HomeAthletes() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const isWide = width >= 420;

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingPhotoTempUri, setPendingPhotoTempUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ FIX: new useAthleteSync does not take getLocal
  const { syncing, syncNow } = useAthleteSync({
    setLocal: (list) => setAthletes(list as any),
    showAlerts: true,
  });

  const loadLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ATHLETES_KEY);
      const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
      const cleaned = await scrubMissingLocalPhotos(Array.isArray(list) ? list : []);
      setAthletes(cleaned as any);
    } catch (e) {
      console.log('athletes load error:', e);
    }
  }, []);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  // ✅ Initial cloud pull: merge WITHOUT importing any cloud "photoLocalUri"
  useEffect(() => {
    const normalizeLocal = (list: Athlete[]): Athlete[] => {
      const out: Athlete[] = [];
      const seen = new Set<string>();

      for (const a of Array.isArray(list) ? list : []) {
        const id = String((a as any)?.id ?? '').trim();
        const name = String((a as any)?.name ?? '').trim();
        if (!id || !name) continue;

        if (seen.has(id)) continue;
        seen.add(id);

        out.push({
          id,
          name,
          photoLocalUri: toStringOrNull((a as any)?.photoLocalUri), // local only
          photoUrl: toStringOrNull((a as any)?.photoUrl),
          photoUri: toStringOrNull((a as any)?.photoUri), // legacy local
        } as any);
      }
      return out;
    };

    const normalizeCloud = (list: Athlete[]): Athlete[] => {
      const out: Athlete[] = [];
      const seen = new Set<string>();

      for (const a of Array.isArray(list) ? list : []) {
        const id = String((a as any)?.id ?? '').trim();
        const name = String((a as any)?.name ?? '').trim();
        if (!id || !name) continue;

        if (seen.has(id)) continue;
        seen.add(id);

        // ✅ only accept cloud-safe fields
        out.push({
          id,
          name,
          photoUrl: toStringOrNull((a as any)?.photoUrl),
        } as any);
      }
      return out;
    };

    const merge = (local: Athlete[], cloud: Athlete[]): Athlete[] => {
      const L = normalizeLocal(local);
      const C = normalizeCloud(cloud);

      const byId = new Map<string, Athlete>();
      for (const a of L) byId.set(a.id, a);

      for (const c of C) {
        const l = byId.get(c.id);

        byId.set(c.id, {
          id: c.id,
          name: c.name?.trim() ? c.name.trim() : (l as any)?.name ?? c.name,

          // cloud truth
          photoUrl: (c as any).photoUrl ?? (l as any)?.photoUrl ?? null,

          // keep local-only fields from local
          photoLocalUri: (l as any)?.photoLocalUri ?? null,
          photoUri: (l as any)?.photoUri ?? null,
        } as any);
      }

      const merged: Athlete[] = [];
      const used = new Set<string>();

      for (const a of C) {
        const v = byId.get(a.id);
        if (v && !used.has(v.id)) {
          merged.push(v);
          used.add(v.id);
        }
      }
      for (const a of L) {
        const v = byId.get(a.id);
        if (v && !used.has(v.id)) {
          merged.push(v);
          used.add(v.id);
        }
      }

      return merged;
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const u = user ?? (await ensureAnonymous());
        const cloud = await getCloudAthletes(u.uid);

        const rawLocal = await AsyncStorage.getItem(ATHLETES_KEY);
        const local = rawLocal ? (JSON.parse(rawLocal) as Athlete[]) : [];

        const merged = merge(local, cloud);
        const cleaned = await scrubMissingLocalPhotos(merged);

        setAthletes(cleaned as any);
        await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(cleaned));
      } catch (e) {
        console.log('[Athletes] initial cloud load failed:', e);
      }
    });

    return () => unsub();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLocal();
    setRefreshing(false);
  }, [loadLocal]);

  const saveAthletes = async (list: Athlete[]) => {
    setAthletes(list);
    await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(list));
  };

  const addAthlete = async () => {
    const n = nameInput.trim();
    if (!n) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }

    const id = `${Date.now()}`;
    let photoLocalUri: string | null = null;
    let photoUrl: string | null = null;

    if (pendingPhotoTempUri) {
      try {
        photoLocalUri = await persistAthleteProfilePhoto(pendingPhotoTempUri, id);
        const up = await uploadAthleteProfilePhotoToB2({ athleteId: id, localFileUri: photoLocalUri });
        photoUrl = up.photoUrl;
      } catch (e: any) {
        console.log('[addAthlete] photo upload failed:', e);
        Alert.alert('Photo upload failed', 'Saved athlete without cloud photo. You can set it later.');
      }
    }

    const next: Athlete[] = [{ id, name: n, photoLocalUri, photoUrl } as any, ...athletes];
    await saveAthletes(next);

    setNameInput('');
    setPendingPhotoTempUri(null);
    setAddOpen(false);

    try {
      await syncNow();
    } catch {}
  };

  const pickPendingPhoto = async () => {
    setAddOpen(false);
    const uri = await pickImageWithChoice(true);
    if (uri) setPendingPhotoTempUri(uri);
    setAddOpen(true);
  };

  const setPhotoForAthlete = async (id: string) => {
    const tempUri = await pickImageWithChoice(false);
    if (!tempUri) return;

    try {
      const localUri = await persistAthleteProfilePhoto(tempUri, id);
      const { photoUrl } = await uploadAthleteProfilePhotoToB2({ athleteId: id, localFileUri: localUri });

      const next = athletes.map((a) =>
        a.id === id ? ({ ...a, photoLocalUri: localUri, photoUrl } as any) : a
      );

      await saveAthletes(next);

      // Sync pushes cloud-safe fields only, and keeps local-only fields locally
      await syncNow();

      Alert.alert('Saved', 'Profile photo uploaded + synced.');
    } catch (e: any) {
      console.log('[setPhotoForAthlete] failed:', e);
      Alert.alert('Failed', String(e?.message ?? e));
    }
  };

  const renameAthlete = async (id: string, newName: string) => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required');
      return;
    }
    const next = athletes.map((a) => (a.id === id ? ({ ...a, name } as any) : a));
    await saveAthletes(next);
    try {
      await syncNow();
    } catch {}
  };

  const deleteAthleteShell = async (id: string) => {
    const next = athletes.filter((a) => a.id !== id);
    await saveAthletes(next);

    const current = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
    if (current && !next.find((a) => a.name === current)) {
      await AsyncStorage.removeItem(CURRENT_ATHLETE_KEY);
    }
    try {
      await syncNow();
    } catch {}
  };

  const recordNoAthlete = async () => {
    await AsyncStorage.removeItem(CURRENT_ATHLETE_KEY);
    router.push({
      pathname: '/record/camera',
      params: { athlete: 'Unassigned', sport: 'plain', style: 'none' },
    });
  };

  const recordWithAthlete = async (name: string) => {
    const clean = (name || '').trim() || 'Unassigned';
    await AsyncStorage.setItem(CURRENT_ATHLETE_KEY, clean);
    router.push({ pathname: '/recordingScreen', params: { athlete: clean } });
  };

  const openStatsForAthlete = (name: string) => {
    const clean = (name || '').trim() || 'Unassigned';
    router.push({
      pathname: '/athletes/[athlete]/stats',
      params: { athlete: clean },
    });
  };

  const styles = useMemo(() => {
    const pillBase = { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 } as const;

    const syncPill = {
      ...pillBase,
      backgroundColor: syncing ? 'rgba(34,211,238,0.20)' : 'rgba(34,211,238,0.14)',
      borderWidth: 1,
      borderColor: syncing ? 'rgba(34,211,238,0.75)' : 'rgba(34,211,238,0.55)',
      opacity: syncing ? 0.78 : 1,
    } as const;

    const syncText = { color: 'rgba(224,251,255,1)', fontWeight: '900' as const, letterSpacing: 0.2 };

    const secondaryPill = {
      ...pillBase,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.85)',
      backgroundColor: 'rgba(255,255,255,0.06)',
    } as const;

    const secondaryText = { color: 'white', fontWeight: '900' as const };

    const primaryPill = { ...pillBase, backgroundColor: '#DC2626' } as const;

    const primaryText = { color: 'white', fontWeight: '900' as const };

    return { syncPill, syncText, secondaryPill, secondaryText, primaryPill, primaryText };
  }, [syncing]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>Athletes</Text>

          <TouchableOpacity onPress={syncNow} disabled={syncing} style={styles.syncPill}>
            <Text style={styles.syncText}>{syncing ? 'Syncing…' : 'Sync'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <TouchableOpacity onPress={recordNoAthlete} style={styles.primaryPill}>
            <Text style={styles.primaryText}>Quick Record</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.secondaryPill}>
            <Text style={styles.secondaryText}>Add Athlete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={athletes}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <AthleteCard
            a={item}
            isWide={isWide}
            onRecord={recordWithAthlete}
            onStats={openStatsForAthlete}
            onSetPhoto={setPhotoForAthlete}
            onRename={renameAthlete}
            onDelete={deleteAthleteShell}
          />
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: tabBarHeight + insets.bottom + 24 }}
        scrollIndicatorInsets={{ bottom: tabBarHeight + insets.bottom }}
        ListFooterComponent={<View style={{ height: tabBarHeight + insets.bottom + 8 }} />}
        ListEmptyComponent={
          <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>
            No athletes yet. Tap “Add Athlete”, then “Record”.
          </Text>
        }
      />

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              backgroundColor: '#121212',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Add Athlete</Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 8 }}>
              Enter a name and (optionally) pick a photo.
            </Text>

            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g., Jordan"
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

            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {pendingPhotoTempUri ? (
                <Image
                  source={{ uri: pendingPhotoTempUri }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', opacity: 0.6 }}>👤</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={pickPendingPhoto}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'white',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>
                  {pendingPhotoTempUri ? 'Change Photo' : 'Pick Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => {
                  setAddOpen(false);
                  setPendingPhotoTempUri(null);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={addAthlete}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: 'white',
                }}
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
