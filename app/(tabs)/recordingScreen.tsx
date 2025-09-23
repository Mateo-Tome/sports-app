// app/(tabs)/recordingScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SPORTS = ['Wrestling', 'Basketball', 'Baseball', 'Volleyball', 'BJJ'] as const;

type Athlete = { id: string; name: string; photoUri?: string | null };
const ATHLETES_KEY = 'athletes:list';

// util: read param as string
const paramToStr = (v: unknown, fallback = '') =>
  Array.isArray(v) ? String(v[0] ?? fallback) : (v == null ? fallback : String(v));

export default function RecordingScreen() {
  const params = useLocalSearchParams<{ athlete?: string | string[] }>();
  const initialAthlete = useMemo(
    () => (paramToStr(params.athlete, 'Unassigned').trim() || 'Unassigned'),
    [params.athlete]
  );

  const [athlete, setAthlete] = useState<string>(initialAthlete);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ATHLETES_KEY);
        setAthletes(raw ? JSON.parse(raw) : []);
      } catch {
        setAthletes([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (initialAthlete && initialAthlete !== athlete) {
      setAthlete(initialAthlete);
    }
  }, [initialAthlete, athlete]);

  // ...rest of your component

  // ---------- Navigation helpers (always forward the athlete) ----------
  const toCam = (sportKey: string, styleKey: string) =>
    router.push({
      pathname: '/record/camera' as any,
      params: { sport: sportKey, style: styleKey, athlete },
    });

  const go = (sport: (typeof SPORTS)[number]) => {
    if (sport === 'Wrestling') {
      router.push({
        pathname: '/screens/wrestlingselection' as any,
        params: { athlete }, // ← forward it so the next screen shows it too
      });
      return;
    }
    switch (sport) {
      case 'Basketball':
        toCam('basketball', 'default');
        break;
      case 'Baseball':
        toCam('baseball', 'default');
        break;
      case 'Volleyball':
        toCam('volleyball', 'default');
        break;
      case 'BJJ':
        toCam('bjj', 'gi'); // add gi/nogi picker later if you want
        break;
    }
  };

  // ---------- UI bits ----------
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || 'U';

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
          {/* Avatar */}
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
            <Text
              style={{ color: 'white', fontSize: 20, fontWeight: '900' }}
              numberOfLines={1}
            >
              {athlete || 'Unassigned'}
            </Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 2, fontSize: 12 }}>
              Tap “Change” to switch athlete. Long-press “Change” to toggle Unassigned.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            onLongPress={() =>
              setAthlete((prev) =>
                prev === 'Unassigned' ? athletes[0]?.name || 'Unassigned' : 'Unassigned'
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
            <Text style={{ color: 'black', fontWeight: '900' }}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const AthletePickerModal = () => (
    <Modal
      visible={pickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setPickerOpen(false)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          padding: 20,
        }}
      >
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
              setAthlete('Unassigned');
              setPickerOpen(false);
            }}
            style={{ paddingVertical: 12 }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: athlete === 'Unassigned' ? '900' : '600',
              }}
            >
              • Unassigned
            </Text>
          </Pressable>

          {athletes.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setAthlete(a.name);
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
                style={{
                  color: 'white',
                  fontWeight: athlete === a.name ? '900' : '600',
                }}
                numberOfLines={1}
              >
                {a.name}
              </Text>
            </Pressable>
          ))}

          <View
            style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 }}
          />

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
          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}
          >
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
                setAthlete(n);
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
    </Modal>
  );

  // ---------- Render ----------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
        {/* Athlete indicator (clean & professional) */}
        <AthleteCard />

        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', marginBottom: 12 }}>
          Record
        </Text>

        {/* Plain camera (no overlay) */}
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
          <Text style={{ fontSize: 12, color: 'black', opacity: 0.6, marginTop: 2 }}>No overlay</Text>
        </TouchableOpacity>

        <Text style={{ color: 'white', opacity: 0.8, marginBottom: 10, fontWeight: '800' }}>
          Or choose a sport
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {SPORTS.map((sport) => (
            <TouchableOpacity
              key={sport}
              onPress={() => go(sport)}
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
              }}
            >
              <Text style={{ fontSize: 22, color: 'black', fontWeight: '800' }}>{sport}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <AthletePickerModal />
    </SafeAreaView>
  );
}








