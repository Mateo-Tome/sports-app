// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ATHLETES_KEY = 'athletes:list';
const CURRENT_ATHLETE_KEY = 'currentAthleteName';

type Athlete = { id: string; name: string };

export default function HomeAthletes() {
  const insets = useSafeAreaInsets();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [currentAthlete, setCurrentAthlete] = useState<string>('Unassigned');

  const [addOpen, setAddOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ATHLETES_KEY);
      const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
      setAthletes(list);

      const ca = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
      if (ca && ca.trim()) setCurrentAthlete(ca.trim());
    } catch (e) {
      console.log('athletes load error:', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    const next = [{ id, name: n }, ...athletes];
    await saveAthletes(next);
    setNameInput('');
    setAddOpen(false);
  };

  const setCurrent = async (name: string) => {
    const v = name.trim() || 'Unassigned';
    await AsyncStorage.setItem(CURRENT_ATHLETE_KEY, v);
    setCurrentAthlete(v);
  };

  const quickRecord = async (name: string) => {
    await setCurrent(name);
    // For now, default to wrestling/folkstyle; we’ll add a sport picker next step.
    router.push('/(tabs)/recordingScreen');
  };

  const renderItem = ({ item }: { item: Athlete }) => {
    const isCurrent = currentAthlete === item.name;
    return (
      <View
        style={{
          padding: 12,
          marginHorizontal: 16,
          marginVertical: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>{item.name}</Text>
        <Text style={{ color: 'white', opacity: 0.7, marginTop: 4 }}>
          {isCurrent ? '✅ Current athlete' : 'Tap a button below'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <TouchableOpacity
            onPress={() => setCurrent(item.name)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: isCurrent ? 'white' : 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: isCurrent ? 'black' : 'white', fontWeight: '800' }}>
              {isCurrent ? 'Current' : 'Set Current'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => quickRecord(item.name)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: 'red',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Record this athlete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>Athletes</Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setAddOpen(true)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Add Athlete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={load}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current athlete pill */}
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <Text style={{ color: 'white', opacity: 0.8 }}>
          Current athlete: <Text style={{ fontWeight: '800' }}>{currentAthlete || 'Unassigned'}</Text>
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={athletes}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>
            No athletes yet. Tap “Add Athlete” to create one.
          </Text>
        }
      />

      {/* Add Athlete modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#121212', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Add Athlete</Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 8 }}>Enter the athlete’s name.</Text>

            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g., John"
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
                onPress={() => setAddOpen(false)}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={addAthlete}
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
}
