// app/(tabs)/recordingScreen.tsx
import { subscribeAccess, type AccessState } from '@/lib/access';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AddExistingVideoButton from '../../components/recording/AddExistingVideoButton';
import AthletePickerOverlay from '../../components/recording/AthletePickerOverlay';
import pickVideoFromPhotos from '../../lib/imports/pickVideoFromPhotos';

import { auth, authReady } from '../../lib/firebase';

const SPORTS = ['Wrestling', 'Basketball', 'Baseball', 'Softball', 'Swimming', 'Volleyball', 'BJJ'] as const;

type Athlete = {
  id: string;
  name: string;
  photoUri?: string | null;
  photoLocalUri?: string | null;
  photoUrl?: string | null;
  photoKey?: string | null;
  photoUpdatedAt?: number | null;
  cachedPhotoLocalUri?: string | null;
};

const ATHLETES_KEY_PREFIX = 'athletes:list';

const paramToStr = (v: unknown, fallback = '') =>
  Array.isArray(v) ? String(v[0] ?? fallback) : v == null ? fallback : String(v);

type SportLabel = (typeof SPORTS)[number];

function makeAthleteId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getActiveUid(): Promise<string | null> {
  const u = auth.currentUser ?? (await authReady());
  if (!u || u.isAnonymous) return null;
  return u.uid;
}

function athletesKey(uid: string) {
  return `${ATHLETES_KEY_PREFIX}:${uid}`;
}

const safeStr = (v: any): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
};

const safeNum = (v: any): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function cachePathForAthlete(athleteId: string, photoUpdatedAt?: number | null) {
  const ver = safeNum(photoUpdatedAt) ?? 0;
  return `${FileSystem.documentDirectory}athlete_photos/${athleteId}/profile_${ver || 'v0'}.jpg`;
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !!info?.exists;
  } catch {
    return false;
  }
}

export default function RecordingScreen() {
  const params = useLocalSearchParams<{
    athlete?: string | string[];
    athleteId?: string | string[];
  }>();

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const initialAthlete = useMemo(
    () => paramToStr(params.athlete, 'Unassigned').trim() || 'Unassigned',
    [],
  );

  const initialAthleteId = useMemo(
    () => paramToStr(params.athleteId, '').trim(),
    [],
  );

  const [athlete, setAthlete] = useState<string>(initialAthlete);
  const [athleteId, setAthleteId] = useState<string>(initialAthleteId);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [controlledByParam, setControlledByParam] = useState(true);

  const [access, setAccess] = useState<AccessState>({
    loading: true,
    uid: null,
    isSignedIn: false,
    isAnonymous: false,
    isTester: false,
    isPro: false,
    plan: 'free',
    maxCloudVideos: 2,
    maxCloudStorageBytes: null,
    maxDevices: 1,
  });

  useEffect(() => {
    const unsub = subscribeAccess(setAccess);
    return unsub;
  }, []);

  const athleteParam = useMemo(() => {
    const v = paramToStr(params.athlete, '').trim();
    return v.length ? v : null;
  }, [params.athlete]);

  const athleteIdParam = useMemo(() => {
    const v = paramToStr(params.athleteId, '').trim();
    return v.length ? v : null;
  }, [params.athleteId]);

  useEffect(() => {
    if (!athleteParam) return;
    setAthlete(athleteParam);
    setControlledByParam(true);
  }, [athleteParam]);

  useEffect(() => {
    if (!athleteIdParam) return;
    setAthleteId(athleteIdParam);
  }, [athleteIdParam]);

  const loadAthletes = useCallback(async () => {
    try {
      const uid = await getActiveUid();

      if (!uid) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const key = athletesKey(uid);

      const raw = await AsyncStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];

      const safeList: Athlete[] = Array.isArray(list)
        ? list
          .map((a: any) => ({
            id: String(a?.id ?? '').trim(),
            name: String(a?.name ?? '').trim(),
            photoUri: safeStr(a?.photoUri),
            photoLocalUri: safeStr(a?.photoLocalUri),
            photoUrl: safeStr(a?.photoUrl),
            photoKey: safeStr(a?.photoKey),
            photoUpdatedAt: safeNum(a?.photoUpdatedAt),
          }))
          .filter((a) => a.id && a.name)
        : [];

      let changed = false;
      const scrubbed: Athlete[] = [];

      for (const a of safeList) {
        const uri = a.photoLocalUri;

        if (uri && uri.startsWith('file://')) {
          try {
            const info = await FileSystem.getInfoAsync(uri);

            if (!info.exists) {
              scrubbed.push({ ...a, photoLocalUri: null });
              changed = true;
              continue;
            }
          } catch {
            scrubbed.push({ ...a, photoLocalUri: null });
            changed = true;
            continue;
          }
        }

        scrubbed.push(a);
      }

      if (changed) {
        await AsyncStorage.setItem(key, JSON.stringify(scrubbed));
      }

      const withCache: Athlete[] = [];

      for (const a of scrubbed) {
        let cachedPhotoLocalUri: string | null = null;

        if (!a.photoLocalUri && a.id) {
          const cacheUri = cachePathForAthlete(a.id, a.photoUpdatedAt);
          if (await fileExists(cacheUri)) cachedPhotoLocalUri = cacheUri;
        }

        withCache.push({ ...a, cachedPhotoLocalUri });
      }

      setAthletes(withCache);

      if (!athleteId && athlete && athlete !== 'Unassigned') {
        const match = withCache.find(
          (a) => a.name.trim().toLowerCase() === athlete.trim().toLowerCase(),
        );

        if (match?.id) {
          setAthleteId(match.id);

          try {
            router.setParams({ athleteId: match.id });
          } catch { }
        }
      }
    } catch (e) {
      console.log('[recordingScreen] loadAthletes failed:', e);
      setAthletes([]);
    }
  }, [athlete, athleteId]);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  useFocusEffect(
    useCallback(() => {
      loadAthletes();
    }, [loadAthletes]),
  );

  useEffect(() => {
    if (!pickerOpen) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPickerOpen(false);
      return true;
    });

    return () => sub.remove();
  }, [pickerOpen]);

  const toCam = (sportKey: string, styleKey: string) =>
    router.push({
      pathname: '/record/camera',
      params: {
        sport: sportKey,
        style: styleKey,
        athlete,
        athleteId,
      },
    });

  const startImportVideo = async () => {
    try {
      const picked = await pickVideoFromPhotos();

      if (!picked) return;

      router.push({
        pathname: '/screens/importvideosetup',
        params: {
          videoUri: picked.uri,
          fileName: picked.fileName ?? 'Imported video',
          athlete,
          athleteId,
        },
      });
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    }
  };

  const go = (sport: SportLabel) => {
    if (!access.isSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }

    const baseParams = { athlete, athleteId };

    switch (sport) {
      case 'Wrestling':
        router.push({ pathname: '/screens/wrestlingselection', params: baseParams });
        break;

      case 'Baseball':
        router.push({ pathname: '/screens/baseballselection', params: baseParams });
        break;

      case 'Softball':
        router.push({ pathname: '/screens/softballselection', params: baseParams });
        break;

      case 'Swimming':
        router.push({ pathname: '/screens/swimmingselection', params: baseParams });
        break;

      case 'Basketball':
        toCam('basketball', 'default');
        break;

      case 'Volleyball':
        toCam('volleyball', 'default');
        break;

      case 'BJJ':
        router.push({ pathname: '/screens/bjjselection', params: baseParams });
        break;
    }
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  const applyAthlete = (name: string) => {
    const clean = (name || '').trim() || 'Unassigned';

    const match =
      clean === 'Unassigned'
        ? null
        : athletes.find((a) => a.name.trim().toLowerCase() === clean.toLowerCase());

    const nextId = match?.id ?? '';

    if (controlledByParam) setControlledByParam(false);

    setAthlete(clean);
    setAthleteId(nextId);

    try {
      router.setParams({
        athlete: clean,
        athleteId: nextId,
      });
    } catch { }
  };

  const addAthleteFromPicker = async () => {
    const n = newName.trim();

    if (!n) return;

    try {
      const uid = await getActiveUid();

      if (!uid) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const key = athletesKey(uid);
      const id = makeAthleteId();

      const next: Athlete[] = [
        {
          id,
          name: n,
        },
        ...athletes,
      ];

      await AsyncStorage.setItem(key, JSON.stringify(next));

      setAthletes(next);
      setAthlete(n);
      setAthleteId(id);

      try {
        router.setParams({
          athlete: n,
          athleteId: id,
        });
      } catch { }

      setNewName('');
      setPickerOpen(false);
    } catch (e) {
      console.log('[recordingScreen] add athlete failed:', e);
      Alert.alert('Add athlete failed', 'Could not add athlete.');
    }
  };

  const AthleteCard = () => {
    const current =
      athletes.find((a) => a.id === athleteId) || athletes.find((a) => a.name === athlete);

    const photo =
      current?.photoLocalUri ||
      current?.cachedPhotoLocalUri ||
      current?.photoUri ||
      current?.photoUrl ||
      null;

    return (
      <View
        style={{
          padding: 14,
          marginBottom: 16,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.2)',
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text
          style={{
            color: 'white',
            opacity: 0.8,
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          Recording for
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          {photo ? (
            <Image
              source={{ uri: photo }}
              resizeMode="cover"
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.15)',
                marginRight: 12,
              }}
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '900',
                }}
              >
                {initials(athlete || 'Unassigned')}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: 'white',
                fontSize: 20,
                fontWeight: '900',
              }}
              numberOfLines={1}
            >
              {athlete || 'Unassigned'}
            </Text>

            <Text
              style={{
                color: 'white',
                opacity: 0.7,
                marginTop: 2,
                fontSize: 12,
              }}
            >
              Tap “Change” to switch athlete.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            onLongPress={() =>
              applyAthlete(
                athlete === 'Unassigned' ? athletes[0]?.name || 'Unassigned' : 'Unassigned',
              )
            }
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: 'white',
              marginLeft: 10,
            }}
          >
            <Text
              style={{
                color: 'black',
                fontWeight: '900',
              }}
            >
              Change
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const bottomPad = Math.max(24, insets.bottom + 12) + tabBarHeight;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: 'black',
      }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator
        scrollEnabled={!pickerOpen}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: bottomPad,
        }}
      >
        <AthleteCard />

        <Text
          style={{
            color: 'white',
            fontSize: 22,
            fontWeight: '900',
            marginBottom: 12,
          }}
        >
          Record
        </Text>

        <AddExistingVideoButton onPress={startImportVideo} />

        <TouchableOpacity
          onPress={() => toCam('plain', 'none')}
          style={{
            width: '100%',
            paddingVertical: 18,
            marginBottom: 18,
            borderWidth: 2,
            borderColor: '#fff',
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
          }}
        >
          <Text
            style={{
              fontSize: 18,
              color: 'black',
              fontWeight: '900',
            }}
          >
            Plain Camera
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: 'black',
              opacity: 0.6,
              marginTop: 2,
            }}
          >
            No overlay
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: 'white',
            opacity: 0.8,
            marginBottom: 10,
            fontWeight: '800',
          }}
        >
          Choose a sport
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {SPORTS.map((sport) => (
            <TouchableOpacity
              key={sport}
              onPress={() => go(sport)}
              activeOpacity={0.85}
              style={{
                width: '49%',
                paddingVertical: 34,
                marginBottom: 16,
                borderWidth: 2,
                borderColor: '#fff',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
                position: 'relative',
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  color: 'black',
                  fontWeight: '800',
                }}
              >
                {sport}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <AthletePickerOverlay
        visible={pickerOpen}
        athletes={athletes}
        selectedAthlete={athlete}
        newName={newName}
        onChangeNewName={setNewName}
        onClose={() => setPickerOpen(false)}
        onSelectAthlete={(name) => {
          applyAthlete(name);
          setPickerOpen(false);
        }}
        onAddAthlete={addAthleteFromPicker}
      />
    </SafeAreaView>
  );
}