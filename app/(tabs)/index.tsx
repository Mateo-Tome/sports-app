// app/(tabs)/index.tsx
// Athletes list with rock-solid ImagePicker flow that avoids the iOS first-open black camera.
// Also routes Quick Record to the plain camera (sport=plain, style=none).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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

// ✅ sync hook (small, isolated)
import useAthleteSync from '../../src/hooks/athletes/useAthleteSync';

const ATHLETES_KEY = 'athletes:list';
const CURRENT_ATHLETE_KEY = 'currentAthleteName';

type Athlete = { id: string; name: string; photoUri?: string | null };

const wait = (ms = 160) => new Promise((res) => setTimeout(res, ms));

function imagesMediaTypesLegacy(): any {
  const MT = (ImagePicker as any).MediaType;
  return MT?.Images ?? MT?.images ?? undefined; // fallback to picker default if missing
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

/**
 * Robust picker that avoids the iOS first-launch black camera by:
 * - clearing pending picker result,
 * - ensuring modals/sheets are closed,
 * - waiting for interactions/RAF,
 * - adding a tiny delay before native presentation.
 *
 * @param launchedFromModal set true if you call this right after closing a RN Modal
 */
async function pickImageWithChoice(launchedFromModal: boolean): Promise<string | null> {
  const ok = await ensurePickerPermissions();
  if (!ok) return null;

  // Clear any stale result (fixes stuck internal session edge-cases)
  try {
    const pending = await (ImagePicker as any).getPendingResultAsync?.();
    if (Array.isArray(pending) && pending.length) {
      // read & ignore to clear internal state
    }
  } catch {}

  if (launchedFromModal) {
    // Give time for the modal dismissal animation to complete
    await wait(250);
  }

  // Let all interactions/animations finish
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

  // Android – use the double-RAF deferral trick via an Alert
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

export default function HomeAthletes() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const isWide = width >= 420;

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Sync hook (safe merge) — unchanged behavior
  const { syncing, syncNow } = useAthleteSync({
    getLocal: () => athletes,
    setLocal: (list) => setAthletes(list as any),
  });

  const loadLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ATHLETES_KEY);
      const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
      setAthletes(list);
    } catch (e) {
      console.log('athletes load error:', e);
    }
  }, []);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  // ✅ On app open (including Expo Web), if signed in, load cloud athletes once.
  // Unchanged behavior — just keeps web in sync when account already has athletes.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const u = user ?? (await ensureAnonymous());
        const cloud = await getCloudAthletes(u.uid);

        // Only apply if cloud has something (don’t overwrite local with empty)
        if (Array.isArray(cloud) && cloud.length) {
          setAthletes(cloud as any);
          await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(cloud));
        }
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
    const next: Athlete[] = [{ id, name: n, photoUri: pendingPhoto }, ...athletes];
    await saveAthletes(next);
    setNameInput('');
    setPendingPhoto(null);
    setAddOpen(false);
  };

  const pickPendingPhoto = async () => {
    setAddOpen(false);
    const uri = await pickImageWithChoice(true);
    if (uri) setPendingPhoto(uri);
    setAddOpen(true);
  };

  const setPhotoForAthlete = async (id: string) => {
    const uri = await pickImageWithChoice(false);
    if (!uri) return;
    const next = athletes.map((a) => (a.id === id ? { ...a, photoUri: uri } : a));
    await saveAthletes(next);
  };

  const renameAthlete = async (id: string, newName: string) => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required');
      return;
    }
    const next = athletes.map((a) => (a.id === id ? { ...a, name } : a));
    await saveAthletes(next);
  };

  const deleteAthleteShell = async (id: string) => {
    const next = athletes.filter((a) => a.id !== id);
    await saveAthletes(next);
    const current = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
    if (current && !next.find((a) => a.name === current)) {
      await AsyncStorage.removeItem(CURRENT_ATHLETE_KEY);
    }
  };

  // ROUTE: Quick Record -> plain camera (no overlay)
  const recordNoAthlete = async () => {
    await AsyncStorage.removeItem(CURRENT_ATHLETE_KEY);
    router.push({
      pathname: '/record/camera',
      params: { athlete: 'Unassigned', sport: 'plain', style: 'none' },
    });
  };

  // ROUTE: Record with selected athlete -> open the Recording tab (sports picker)
  const recordWithAthlete = async (name: string) => {
    const clean = (name || '').trim() || 'Unassigned';
    await AsyncStorage.setItem(CURRENT_ATHLETE_KEY, clean);
    router.push({ pathname: '/recordingScreen', params: { athlete: clean } });
  };

  // ---------- Premium + futuristic button styling (visual only) ----------
  const styles = useMemo(() => {
    const pillBase = {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
    } as const;

    // “Glass cyan” vibe on black: premium + futuristic (no neon lime)
    const syncPill = {
      ...pillBase,
      backgroundColor: syncing ? 'rgba(34,211,238,0.20)' : 'rgba(34,211,238,0.14)',
      borderWidth: 1,
      borderColor: syncing ? 'rgba(34,211,238,0.75)' : 'rgba(34,211,238,0.55)',
      opacity: syncing ? 0.78 : 1,
    } as const;

    const syncText = {
      color: 'rgba(224,251,255,1)',
      fontWeight: '900' as const,
      letterSpacing: 0.2,
    };

    const secondaryPill = {
      ...pillBase,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.85)',
      backgroundColor: 'rgba(255,255,255,0.06)',
    } as const;

    const secondaryText = {
      color: 'white',
      fontWeight: '900' as const,
    };

    const primaryPill = {
      ...pillBase,
      backgroundColor: '#DC2626',
    } as const;

    const primaryText = {
      color: 'white',
      fontWeight: '900' as const,
    };

    return { syncPill, syncText, secondaryPill, secondaryText, primaryPill, primaryText };
  }, [syncing]);

  const AthleteCard = ({ a }: { a: Athlete }) => {
    const [editOpen, setEditOpen] = useState(false);
    const [renameInput, setRenameInput] = useState(a.name);

    const openMore = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Delete'],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 1,
            userInterfaceStyle: 'dark',
            title: a.name,
          },
          (idx) => {
            if (idx === 1) deleteAthleteShell(a.id);
          }
        );
      } else {
        Alert.alert(a.name, undefined, [
          { text: 'Delete', style: 'destructive', onPress: () => deleteAthleteShell(a.id) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    };

    const ActionBtn = ({
      label,
      onPress,
      kind = 'secondary',
    }: {
      label: string;
      onPress: () => void;
      kind?: 'primary' | 'secondary' | 'danger';
    }) => {
      const base = {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
        marginTop: 8,
        borderWidth: 1 as const,
      };
      let style;
      if (kind === 'primary') {
        style = { ...base, backgroundColor: '#DC2626', borderColor: '#DC2626' };
      } else if (kind === 'danger') {
        style = { ...base, backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.35)' };
      } else {
        style = {
          ...base,
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderColor: 'rgba(255,255,255,0.35)',
        };
      }
      return (
        <TouchableOpacity onPress={onPress} style={style}>
          <Text style={{ color: 'white', fontWeight: '800' }}>{label}</Text>
        </TouchableOpacity>
      );
    };

    return (
      <View
        style={{
          padding: 12,
          marginHorizontal: 16,
          marginVertical: 8,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {a.photoUri ? (
            <Image
              source={{ uri: a.photoUri }}
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
                backgroundColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: 'white', opacity: 0.7, fontSize: 22 }}>👤</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
              {a.name}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
              Record or manage athlete
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <ActionBtn label="Record" kind="primary" onPress={() => recordWithAthlete(a.name)} />
          <ActionBtn label={a.photoUri ? 'Change Photo' : 'Set Photo'} onPress={() => setPhotoForAthlete(a.id)} />
          <ActionBtn label="Rename" onPress={() => setEditOpen(true)} />
          {isWide ? (
            <ActionBtn label="Delete" kind="danger" onPress={() => deleteAthleteShell(a.id)} />
          ) : (
            <ActionBtn label="More" onPress={openMore} />
          )}
        </View>

        <Modal transparent visible={editOpen} animationType="fade" onRequestClose={() => setEditOpen(false)}>
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
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Rename Athlete</Text>
              <TextInput
                value={renameInput}
                onChangeText={setRenameInput}
                placeholder="Name"
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
                  onPress={() => setEditOpen(false)}
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
                  onPress={async () => {
                    await renameAthlete(a.id, renameInput);
                    setEditOpen(false);
                  }}
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
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      {/* Header (2 rows so buttons never go off-screen) */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        {/* Row 1: title + Sync */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>Athletes</Text>

          <TouchableOpacity onPress={syncNow} disabled={syncing} style={styles.syncPill}>
            <Text style={styles.syncText}>{syncing ? 'Syncing…' : 'Sync'}</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: actions (wrap-safe) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <TouchableOpacity onPress={recordNoAthlete} style={styles.primaryPill}>
            <Text style={styles.primaryText}>Quick Record</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setAddOpen(true)} style={styles.secondaryPill}>
            <Text style={styles.secondaryText}>Add Athlete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={athletes}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AthleteCard a={item} />}
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

      {/* Add Athlete Modal */}
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
              {pendingPhoto ? (
                <Image
                  source={{ uri: pendingPhoto }}
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
                  {pendingPhoto ? 'Change Photo' : 'Pick Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => {
                  setAddOpen(false);
                  setPendingPhoto(null);
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
