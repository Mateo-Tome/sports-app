// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ATHLETES_KEY = 'athletes:list';
const CURRENT_ATHLETE_KEY = 'currentAthleteName';

type Athlete = { id: string; name: string; photoUri?: string | null };

function imagesMediaTypes(): any {
  const MT = (ImagePicker as any).MediaType;
  if (MT && typeof MT === 'object' && MT.images) return [MT.images];
  const MTO = (ImagePicker as any).MediaTypeOptions;
  if (MTO && MTO.Images) return MTO.Images;
  return ['images'];
}
const wait = (ms = 160) => new Promise(res => setTimeout(res, ms));

async function pickImageWithChoice(): Promise<string | null> {
  let cam = await ImagePicker.getCameraPermissionsAsync();
  let lib = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (cam.status !== 'granted') cam = await ImagePicker.requestCameraPermissionsAsync();
  if (lib.status !== 'granted') lib = await ImagePicker.requestMediaLibraryPermissionsAsync();

  const blocked = (p: any) => p.status === 'denied' && p.canAskAgain === false;
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
    return null;
  }

  if (Platform.OS === 'web') {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: imagesMediaTypes(),
      allowsEditing: true,
      quality: 0.85,
    });
    return res.canceled ? null : res.assets?.[0]?.uri ?? null;
  }

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (idx) => {
          try {
            if (idx === 1) {
              await wait(120);
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: imagesMediaTypes(),
                allowsEditing: true,
                quality: 0.85,
              });
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            } else if (idx === 2) {
              await wait(120);
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: imagesMediaTypes(),
                allowsEditing: true,
                quality: 0.85,
              });
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

  // Android
  return new Promise((resolve) => {
    const defer = (fn: () => Promise<void>) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => { fn().catch(() => resolve(null)); }, 220);
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
                mediaTypes: imagesMediaTypes(),
                allowsEditing: true,
                quality: 0.85,
              });
              resolve(res.canceled ? null : res.assets?.[0]?.uri ?? null);
            }),
        },
        {
          text: 'Choose from Library',
          onPress: () =>
            defer(async () => {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: imagesMediaTypes(),
                allowsEditing: true,
                quality: 0.85,
              });
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

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ATHLETES_KEY);
      const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
      setAthletes(list);
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
    if (!n) { Alert.alert('Name required', 'Please enter a name.'); return; }
    const id = `${Date.now()}`;
    const next: Athlete[] = [{ id, name: n, photoUri: pendingPhoto }, ...athletes];
    await saveAthletes(next);
    setNameInput(''); setPendingPhoto(null); setAddOpen(false);
  };

  const pickPendingPhoto = async () => {
    const uri = await pickImageWithChoice();
    if (uri) setPendingPhoto(uri);
  };

  const setPhotoForAthlete = async (id: string) => {
    const uri = await pickImageWithChoice();
    if (!uri) return;
    const next = athletes.map(a => a.id === id ? { ...a, photoUri: uri } : a);
    await saveAthletes(next);
  };

  const renameAthlete = async (id: string, newName: string) => {
    const name = newName.trim();
    if (!name) { Alert.alert('Name required'); return; }
    const next = athletes.map(a => a.id === id ? { ...a, name } : a);
    await saveAthletes(next);
  };

  const deleteAthleteShell = async (id: string) => {
    const next = athletes.filter(a => a.id !== id);
    await saveAthletes(next);
    const current = await AsyncStorage.getItem(CURRENT_ATHLETE_KEY);
    if (current && !next.find(a => a.name === current)) {
      await AsyncStorage.removeItem(CURRENT_ATHLETE_KEY);
    }
  };

  const recordNoAthlete = async () => {
    await AsyncStorage.removeItem(CURRENT_ATHLETE_KEY);
    router.push({
      pathname: '/recordingScreen',             // 👈 go to your multi-sport picker
      params: { athlete: 'Unassigned' },
    });
  };
  
  const recordWithAthlete = async (name: string) => {
    const clean = name.trim();
    await AsyncStorage.setItem(CURRENT_ATHLETE_KEY, clean); // ok to keep for your other flows
    router.push({
      pathname: '/recordingScreen',             // 👈 go to your multi-sport picker
      params: { athlete: clean },
    });
  };
  
  

  const AthleteCard = ({ a }: { a: Athlete }) => {
    const [editOpen, setEditOpen] = useState(false);
    const [renameInput, setRenameInput] = useState(a.name);

    return (
      <View style={{
        padding: 12, marginHorizontal: 16, marginVertical: 8,
        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 12
      }}>
        {a.photoUri ? (
          <Image source={{ uri: a.photoUri }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'white', opacity: 0.7, fontSize: 22 }}>👤</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{a.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => recordWithAthlete(a.name)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'red' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhotoForAthlete(a.id)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>{a.photoUri ? 'Change Photo' : 'Set Photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditOpen(true)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteAthleteShell(a.id)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(220,0,0,0.9)' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal transparent visible={editOpen} animationType="fade" onRequestClose={() => setEditOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#121212', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Rename Athlete</Text>
              <TextInput
                value={renameInput}
                onChangeText={setRenameInput}
                placeholder="Name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', color: 'white' }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setEditOpen(false)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => { await renameAthlete(a.id, renameInput); setEditOpen(false); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'white' }}>
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
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>Athletes</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity onPress={recordNoAthlete} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'red' }}>
            <Text style={{ color: 'white', fontWeight: '800' }}>Record (No Athlete)</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddOpen(true)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'white' }}>
            <Text style={{ color: 'white', fontWeight: '800' }}>Add Athlete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={load} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'white' }}>
            <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={athletes}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AthleteCard a={item} />}
        ListEmptyComponent={<Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 40 }}>No athletes yet. Tap “Add Athlete”.</Text>}
      />

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#121212', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Add Athlete</Text>
            <Text style={{ color: 'white', opacity: 0.7, marginTop: 8 }}>Enter a name and (optionally) pick a photo.</Text>
            <TextInput value={nameInput} onChangeText={setNameInput} placeholder="e.g., Jordan" placeholderTextColor="rgba(255,255,255,0.4)" style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', color: 'white' }} />
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {pendingPhoto ? (
                <Image source={{ uri: pendingPhoto }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: 'white', opacity: 0.6 }}>👤</Text>
                </View>
              )}
              <TouchableOpacity onPress={pickPendingPhoto} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'white' }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>{pendingPhoto ? 'Change Photo' : 'Pick Photo'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <TouchableOpacity onPress={() => { setAddOpen(false); setPendingPhoto(null); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addAthlete} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'white' }}>
                <Text style={{ color: 'black', fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}



