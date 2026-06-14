import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, authReady } from '../../lib/firebase';
import {
  getCloudAthletes,
  setCloudAthletes,
} from '../../src/hooks/athletes/cloudAthletes';

import { persistAthleteProfilePhoto } from '../../src/lib/athletePhotos';
import { uploadAthleteProfilePhotoToB2 } from '../../src/lib/athletePhotoUpload';

type Athlete = {
  id: string;
  name: string;
  photoLocalUri?: string | null;
  photoUrl?: string | null;
  photoKey?: string | null;
  photoUpdatedAt?: number | null;
};

type CameraFacing = 'back' | 'front';

function toStringOrNull(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

function toNumberOrNull(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function athletesKey(uid: string) {
  return `athletes:list:${uid}`;
}

async function getActiveUid(): Promise<string | null> {
  const u = auth.currentUser ?? (await authReady());

  if (!u || u.isAnonymous) {
    return null;
  }

  return u.uid;
}

async function readLocalList(uid: string) {
  try {
    const raw = await AsyncStorage.getItem(athletesKey(uid));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeLocalList(uid: string, list: Athlete[]) {
  await AsyncStorage.setItem(athletesKey(uid), JSON.stringify(list));
}

async function updateLocalAthlete(
  uid: string,
  athleteId: string,
  patch: Partial<Athlete>,
) {
  const list = await readLocalList(uid);

  const next = list.map((a) => {
    if (a.id !== athleteId) return a;

    return {
      ...a,
      ...patch,
      photoLocalUri: patch.photoLocalUri ?? a.photoLocalUri ?? null,
      photoUrl: patch.photoUrl ?? a.photoUrl ?? null,
      photoKey: patch.photoKey ?? a.photoKey ?? null,
      photoUpdatedAt: patch.photoUpdatedAt ?? a.photoUpdatedAt ?? null,
    };
  });

  await writeLocalList(uid, next);
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
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      setMountCam(false);
      return;
    }

    setCameraReady(false);

    const first = setTimeout(() => {
      setMountCam(true);
    }, 150);

    return () => {
      clearTimeout(first);
    };
  }, [permission?.granted]);

  const flipCamera = () => {
    if (busy || previewUri) return;

    setCameraReady(false);
    setMountCam(false);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));

    setTimeout(() => {
      setMountCam(true);
    }, 120);
  };

  async function take() {
    if (!cameraReady || busy || previewUri) return;

    if (!athleteId) {
      Alert.alert('Missing athleteId');
      return;
    }

    setBusy(true);

    try {
      const res = await (camRef.current as any)?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      const uri = res?.uri;

      if (!uri) {
        throw new Error('No image captured');
      }

      setPreviewUri(uri);
      setCameraReady(false);
      setMountCam(false);
    } catch (e: any) {
      console.log('[ProfilePhotoCamera] take failed:', e);
      Alert.alert('Failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function usePhoto() {
    if (!previewUri || busy) return;

    if (!athleteId) {
      Alert.alert('Missing athleteId');
      return;
    }

    setBusy(true);

    try {
      const uid = await getActiveUid();

      if (!uid) {
        Alert.alert('Sign in required', 'Please sign in before saving a profile photo.');
        return;
      }

      const savedUri = await persistAthleteProfilePhoto(previewUri, athleteId);
      const updatedAt = Date.now();

      await updateLocalAthlete(uid, athleteId, {
        photoLocalUri: savedUri,
        photoUpdatedAt: updatedAt,
      });

      nav.goBack();

      try {
        const upload = await uploadAthleteProfilePhotoToB2({
          athleteId,
          localFileUri: savedUri,
        });

        const local = await updateLocalAthlete(uid, athleteId, {
          photoUrl: upload.photoUrl,
          photoKey: upload.photoKey,
          photoUpdatedAt: updatedAt,
        });

        const cloud = await getCloudAthletes(uid);
        const byId = new Map<string, Athlete>();

        for (const c of cloud as any[]) {
          byId.set(String(c.id), c as Athlete);
        }

        for (const a of local) {
          byId.set(a.id, {
            id: a.id,
            name: a.name,
            photoUrl: toStringOrNull(a.photoUrl),
            photoKey: toStringOrNull(a.photoKey),
            photoUpdatedAt: toNumberOrNull(a.photoUpdatedAt),
          });
        }

        await setCloudAthletes(uid, Array.from(byId.values()) as any);
      } catch (uploadError) {
        console.log('[ProfilePhotoCamera] upload later failed:', uploadError);
      }
    } catch (e: any) {
      console.log('[ProfilePhotoCamera] save failed:', e);
      Alert.alert('Failed', String(e?.message ?? e));
      setBusy(false);
    }
  }

  const retake = () => {
    if (busy) return;

    setPreviewUri(null);
    setCameraReady(false);
    setMountCam(false);

    setTimeout(() => {
      setMountCam(true);
    }, 120);
  };

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 10, textAlign: 'center' }}>
          Camera Access Needed
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 18 }}>
          Allow camera access to take an athlete profile photo.
        </Text>

        <TouchableOpacity
          onPress={async () => {
            const res = await requestPermission();

            if (res.granted) {
              setCameraReady(false);
              setMountCam(false);
              setTimeout(() => setMountCam(true), 150);
            }
          }}
          style={{
            backgroundColor: 'white',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: 'black', fontWeight: '900' }}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={{ flex: 1 }} resizeMode="cover" />
      ) : mountCam ? (
        <CameraView
          ref={camRef}
          style={{ flex: 1 }}
          facing={facing}
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => {
            console.log('[ProfilePhotoCamera] mount error:', e);
            setCameraReady(false);
            setMountCam(false);
            setTimeout(() => setMountCam(true), 250);
          }}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="white" />
          <Text style={{ color: 'white', marginTop: 12 }}>Opening Camera...</Text>
        </View>
      )}

      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={() => nav.goBack()}
          disabled={busy}
          style={{
            backgroundColor: 'rgba(0,0,0,0.65)',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>Close</Text>
        </TouchableOpacity>

        {!previewUri && (
          <TouchableOpacity
            onPress={flipCamera}
            disabled={busy}
            style={{
              backgroundColor: 'rgba(0,0,0,0.65)',
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              Flip: {facing === 'back' ? 'Back' : 'Front'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 20,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        {previewUri ? (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TouchableOpacity
              disabled={busy}
              onPress={retake}
              style={{
                opacity: busy ? 0.5 : 1,
                backgroundColor: 'rgba(0,0,0,0.65)',
                paddingHorizontal: 22,
                paddingVertical: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={busy}
              onPress={usePhoto}
              style={{
                opacity: busy ? 0.5 : 1,
                backgroundColor: 'white',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: 'black', fontWeight: '900' }}>
                {busy ? 'Saving...' : 'Use Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            disabled={!cameraReady || busy}
            onPress={take}
            style={{
              opacity: cameraReady && !busy ? 1 : 0.5,
              backgroundColor: 'white',
              paddingHorizontal: 26,
              paddingVertical: 15,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: 'black', fontWeight: '900' }}>
              {busy ? 'Saving...' : 'Take Photo'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}