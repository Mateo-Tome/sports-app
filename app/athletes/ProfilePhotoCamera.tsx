// app/athlete/ProfilePhotoCamera.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ensureAnonymous } from '../../lib/firebase';
import { getCloudAthletes, setCloudAthletes } from '../../src/hooks/athletes/cloudAthletes';
import { persistAthleteProfilePhoto } from '../../src/lib/athletePhotos';
import { uploadAthleteProfilePhotoToB2 } from '../../src/lib/athletePhotoUpload';

const ATHLETES_KEY = 'athletes:list';

type Athlete = {
  id: string;
  name: string;
  photoLocalUri?: string | null;
  photoUrl?: string | null;
};

function toStringOrNull(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

async function updateLocalAthlete(athleteId: string, patch: Partial<Athlete>) {
  const raw = await AsyncStorage.getItem(ATHLETES_KEY);
  const list: Athlete[] = raw ? JSON.parse(raw) : [];

  const next = list.map((a) => {
    if (a.id !== athleteId) return a;
    return {
      ...a,
      ...patch,
      photoLocalUri: patch.photoLocalUri ?? a.photoLocalUri ?? null,
      photoUrl: patch.photoUrl ?? a.photoUrl ?? null,
    };
  });

  await AsyncStorage.setItem(ATHLETES_KEY, JSON.stringify(next));
  return next;
}

export default function ProfilePhotoCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const camRef = useRef<CameraView>(null);

  const params = useLocalSearchParams();
  const athleteId = String((params as any)?.athleteId ?? '').trim();

  const [mountCam, setMountCam] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission?.granted) {
      setMountCam(true);
      setCameraReady(false);

      const t = setTimeout(() => {
        if (!cameraReady) {
          setMountCam(false);
          setTimeout(() => setMountCam(true), 30);
        }
      }, 1200);

      return () => clearTimeout(t);
    }
  }, [permission?.granted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'white' }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const take = async () => {
    if (!cameraReady || busy) return;

    if (!athleteId) {
      Alert.alert('Missing athleteId', 'Open this screen with params: ?athleteId=...');
      return;
    }

    setBusy(true);

    try {
      const res = await (camRef.current as any)?.takePictureAsync?.({
        skipProcessing: true,
        quality: 0.9,
      });

      const uri = res?.uri as string | undefined;
      if (!uri) {
        Alert.alert('Failed', 'No image captured');
        return;
      }

      // Optional: permissions to save to Photos app (not required for in-app save)
      try {
        await MediaLibrary.requestPermissionsAsync();
      } catch {
        // ignore
      }

      // 1) Persist local (documentDirectory)
      const savedUri = await persistAthleteProfilePhoto(uri, athleteId);
      console.log('[ProfilePhotoCamera] savedUri:', savedUri);

      // Update local immediately so THIS device shows it right away
      await updateLocalAthlete(athleteId, { photoLocalUri: savedUri });

      // 2) Upload to Backblaze B2
      const { photoUrl } = await uploadAthleteProfilePhotoToB2({
        athleteId,
        localFileUri: savedUri,
      });
      console.log('[ProfilePhotoCamera] photoUrl:', photoUrl);

      // Update local with cross-device URL
      const localAfter = await updateLocalAthlete(athleteId, { photoUrl });

      // 3) Push to cloud so OTHER devices get it on Sync
      const user = await ensureAnonymous();
      const uid = user.uid;

      const cloud = await getCloudAthletes(uid);

      // Merge: keep cloud names; keep local photoLocalUri on this device; photoUrl must be set
      const byId = new Map<string, Athlete>();
      for (const c of cloud as any) byId.set(c.id, c);

      for (const l of localAfter) {
        const c = byId.get(l.id);
        byId.set(l.id, {
          id: l.id,
          name: (c?.name ?? l.name).trim(),
          photoLocalUri: toStringOrNull(l.photoLocalUri) ?? toStringOrNull(c?.photoLocalUri) ?? null,
          photoUrl: toStringOrNull(l.photoUrl) ?? toStringOrNull(c?.photoUrl) ?? null,
        });
      }

      await setCloudAthletes(uid, Array.from(byId.values()));

      Alert.alert('Saved', 'Profile photo saved + uploaded.');
      (nav as any)?.goBack?.();
    } catch (e: any) {
      console.log('[ProfilePhotoCamera] failed:', e);
      Alert.alert('Failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {mountCam ? (
        <CameraView
          ref={camRef}
          style={{ flex: 1 }}
          facing="front"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e: any) => {
            const msg = e?.message || e?.nativeEvent?.message || 'Camera mount error';
            console.warn('[profile camera mount error]', e);
            Alert.alert('Camera error', msg);
            setCameraReady(false);
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: 'black' }} />
      )}

      <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 0, right: 0, alignItems: 'center' }}>
        <TouchableOpacity
          disabled={!cameraReady || busy}
          onPress={take}
          style={{
            opacity: cameraReady && !busy ? 1 : 0.5,
            backgroundColor: 'white',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: 'black', fontWeight: '900' }}>{busy ? 'Saving…' : 'Take Photo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
