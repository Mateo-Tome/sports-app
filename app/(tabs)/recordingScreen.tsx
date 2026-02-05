// app/(tabs)/recordingScreen.tsx
import { subscribeAccess, type AccessState } from '@/lib/access';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SPORTS = ['Wrestling', 'Basketball', 'Baseball', 'Volleyball', 'BJJ'] as const;

type Athlete = { id: string; name: string; photoUri?: string | null };
const ATHLETES_KEY = 'athletes:list';

const paramToStr = (v: unknown, fallback = '') =>
  Array.isArray(v) ? String(v[0] ?? fallback) : v == null ? fallback : String(v);

type SportLabel = (typeof SPORTS)[number];

function sportLabelToKey(sport: SportLabel) {
  switch (sport) {
    case 'Wrestling':
      return 'wrestling';
    case 'Baseball':
      return 'baseball';
    case 'Basketball':
      return 'basketball';
    case 'Volleyball':
      return 'volleyball';
    case 'BJJ':
      return 'bjj';
  }
}

function sportKeyToNiceLabel(key: string) {
  switch (key) {
    case 'wrestling':
      return 'Wrestling';
    case 'baseball':
      return 'Baseball';
    case 'basketball':
      return 'Basketball';
    case 'volleyball':
      return 'Volleyball';
    case 'bjj':
      return 'BJJ';
    default:
      return 'your selected sport';
  }
}

export default function RecordingScreen() {
  const params = useLocalSearchParams<{ athlete?: string | string[] }>();

  const initialAthlete = useMemo(
    () => paramToStr(params.athlete, 'Unassigned').trim() || 'Unassigned',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [athlete, setAthlete] = useState<string>(initialAthlete);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [controlledByParam, setControlledByParam] = useState(true);

  const [access, setAccess] = useState<AccessState>({
    loading: true,
    uid: null,
    isSignedIn: false,
    isAnonymous: false,
    allowedSport: null,
    isTester: false,
    isPro: false,
  });

  useEffect(() => {
    const unsub = subscribeAccess(setAccess);
    return unsub;
  }, []);

  useEffect(() => {
    if (!controlledByParam) return;
    const fromParam = paramToStr(params.athlete, initialAthlete).trim() || 'Unassigned';
    if (fromParam !== athlete) setAthlete(fromParam);
  }, [params.athlete, controlledByParam, athlete, initialAthlete]);

  const loadAthletes = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ATHLETES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      setAthletes(Array.isArray(list) ? list : []);
    } catch {
      setAthletes([]);
    }
  }, []);

  useEffect(() => {
    loadAthletes();
  }, [loadAthletes]);

  useEffect(() => {
    if (!pickerOpen) return;
    const id = setTimeout(() => loadAthletes(), 50);
    return () => clearTimeout(id);
  }, [pickerOpen, loadAthletes]);

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
      params: { sport: sportKey, style: styleKey, athlete },
    });

  // Tap locked sport → go to paywall (recommended)
  const ALLOW_TAP_LOCKED_TO_UPSELL = true;

  const goToPaywall = () => router.push('/(auth)/paywall');

  const isLockedSport = (sport: SportLabel) => {
    if (access.loading) return false;
    if (!access.isSignedIn) return false;
    if (access.isPro) return false;
    if (!access.allowedSport) return false;
    return access.allowedSport !== sportLabelToKey(sport);
  };

  const go = (sport: SportLabel) => {
    const key = sportLabelToKey(sport);

    // Must have a session
    if (!access.isSignedIn) {
      router.push('/(auth)/sign-in');
      return;
    }

    if (!access.isPro) {
      if (!access.allowedSport) {
        router.push('/(auth)/choose-sport');
        return;
      }

      if (access.allowedSport !== key) {
        if (ALLOW_TAP_LOCKED_TO_UPSELL) {
          goToPaywall();
          return;
        }

        Alert.alert(
          'Sport locked',
          `Your free account is locked to ${sportKeyToNiceLabel(access.allowedSport)}.\n\nUpgrade to unlock all sports.`,
          [{ text: 'OK' }, { text: 'Upgrade', onPress: goToPaywall }]
        );
        return;
      }
    }

    // Allowed → proceed
    switch (sport) {
      case 'Wrestling':
        router.push({ pathname: '/screens/wrestlingselection', params: { athlete } });
        break;
      case 'Baseball':
        router.push({ pathname: '/screens/baseballselection', params: { athlete } });
        break;
      case 'Basketball':
        toCam('basketball', 'default');
        break;
      case 'Volleyball':
        toCam('volleyball', 'default');
        break;
      case 'BJJ':
        toCam('bjj', 'gi');
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
    if (controlledByParam) setControlledByParam(false);
    setAthlete(name);
  };

  const AthleteCard = () => {
    const current = athletes.find((a) => a.name === athlete);
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
        <Text style={{ color: 'white', opacity: 0.8, fontSize: 12, fontWeight: '700' }}>
          Recording for
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          {current?.photoUri ? (
            <Image
              source={{ uri: current.photoUri }}
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
              <Text style={{ color: 'white', fontWeight: '900' }}>
                {initials(athlete || 'Unassigned')}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }} numberOfLines={1}>
              {athlete || 'Unassigned'}
            </Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 2, fontSize: 12 }}>
              Tap “Change” to switch athlete. Long-press “Change” to toggle Unassigned.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            onLongPress={() =>
              applyAthlete(athlete === 'Unassigned' ? athletes[0]?.name || 'Unassigned' : 'Unassigned')
            }
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: 'white',
              marginLeft: 10,
            }}
          >
            <Text style={{ color: 'black', fontWeight: '900' }}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const AthletePickerOverlay = () => {
    if (!pickerOpen) return null;
    return (
      <View
        pointerEvents="auto"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          padding: 20,
          zIndex: 999,
        }}
      >
        <Pressable
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          onPress={() => setPickerOpen(false)}
        />
        <View
          style={{
            backgroundColor: '#121212',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>Choose Athlete</Text>

          <Pressable
            onPress={() => {
              applyAthlete('Unassigned');
              setPickerOpen(false);
            }}
            style={{ paddingVertical: 12 }}
          >
            <Text style={{ color: 'white', fontWeight: athlete === 'Unassigned' ? '900' : '600' }}>
              • Unassigned
            </Text>
          </Pressable>

          {athletes.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                applyAthlete(a.name);
                setPickerOpen(false);
              }}
              style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
            >
              {a.photoUri ? (
                <Image
                  source={{ uri: a.photoUri }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    marginRight: 8,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>
                    {initials(a.name)}
                  </Text>
                </View>
              )}
              <Text
                style={{ color: 'white', fontWeight: athlete === a.name ? '900' : '600' }}
                numberOfLines={1}
              >
                {a.name}
              </Text>
            </Pressable>
          ))}

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 }} />

          <Text style={{ color: 'white', opacity: 0.8, marginBottom: 6 }}>New athlete</Text>
          <TextInput
            placeholder="Enter new name"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newName}
            onChangeText={setNewName}
            style={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.25)',
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => setPickerOpen(false)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const n = newName.trim();
                if (!n) return;
                const next = [{ id: `${Date.now()}`, name: n }, ...athletes];
                try {
                  await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(next));
                } catch {}
                setAthletes(next);
                applyAthlete(n);
                setNewName('');
                setPickerOpen(false);
              }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: 'white',
              }}
            >
              <Text style={{ color: 'black', fontWeight: '800' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const LockedHint = () => (
    <View
      style={{
        marginTop: 10,
        borderRadius: 14,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>
        Free plan: 1 sport unlocked
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 }}>
        Upgrade to record all sports.
      </Text>

      <TouchableOpacity
        onPress={goToPaywall}
        style={{
          marginTop: 10,
          alignSelf: 'flex-start',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: 'white',
        }}
      >
        <Text style={{ color: 'black', fontWeight: '900' }}>Upgrade</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator
        scrollEnabled={!pickerOpen}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32 }}
      >
        <AthleteCard />

        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', marginBottom: 12 }}>
          Record
        </Text>

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
          <Text style={{ fontSize: 18, color: 'black', fontWeight: '900' }}>Plain Camera</Text>
          <Text style={{ fontSize: 12, color: 'black', opacity: 0.6, marginTop: 2 }}>
            No overlay
          </Text>
        </TouchableOpacity>

        <Text style={{ color: 'white', opacity: 0.8, marginBottom: 10, fontWeight: '800' }}>
          Choose a sport
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {SPORTS.map((sport) => {
            const locked = isLockedSport(sport);
            const bg = locked ? 'rgba(255,255,255,0.18)' : 'white';
            const border = locked ? 'rgba(255,255,255,0.35)' : '#fff';
            const titleColor = locked ? 'rgba(0,0,0,0.55)' : 'black';

            return (
              <TouchableOpacity
                key={sport}
                onPress={() => go(sport)}
                activeOpacity={0.85}
                style={{
                  width: '49%',
                  paddingVertical: 34,
                  marginBottom: 16,
                  borderWidth: 2,
                  borderColor: border,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: bg,
                  position: 'relative',
                }}
              >
                {locked && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0,0,0,0.25)',
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.18)',
                    }}
                  >
                    <Text style={{ color: 'rgba(0,0,0,0.65)', fontWeight: '900', fontSize: 11 }}>
                      LOCKED
                    </Text>
                  </View>
                )}

                <Text style={{ fontSize: 22, color: titleColor, fontWeight: '800' }}>{sport}</Text>

                {locked && (
                  <Text style={{ marginTop: 6, fontSize: 11, color: 'rgba(0,0,0,0.55)', fontWeight: '800' }}>
                    Upgrade to unlock
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {access.isSignedIn && !access.isPro && !!access.allowedSport && <LockedHint />}
      </ScrollView>

      <AthletePickerOverlay />
    </SafeAreaView>
  );
}
