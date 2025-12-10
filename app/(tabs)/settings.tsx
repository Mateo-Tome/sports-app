// app/(tabs)/settings.tsx
import { router } from 'expo-router';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { signOut } from 'firebase/auth';
import { auth, ensureAnonymous, storage } from '../../lib/firebase';
import { fetchMyVideos } from '../../lib/videos';

type CloudVideo = {
  id: string;
  storageKey: string;
  sidecarRef?: string;
  createdAt: number;
  shareId: string;
};

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Ready');

  // keep the cloud videos we fetch for this account
  const [cloudVideos, setCloudVideos] = useState<CloudVideo[]>([]);

  // DEV: log who we are on mount (per device)
  useEffect(() => {
    const u = auth.currentUser;
    console.log('[Settings] Current user on this device:', {
      uid: u?.uid,
      email: u?.email,
      isAnonymous: u?.isAnonymous,
    });
  }, []);

  // DEV: show who we are right now (for the text label)
  const describeCurrentUser = () => {
    const u = auth.currentUser;
    if (!u) return 'Not signed in';
    if (u.isAnonymous) return `Guest user: ${u.uid.slice(0, 6)}…`;
    return `Signed in as: ${u.email ?? u.uid.slice(0, 6) + '…'}`;
  };

  const testAuth = async () => {
    setBusy(true);
    try {
      const user = await ensureAnonymous();
      setStatus(`Signed in (anon): ${user.uid.slice(0, 6)}…`);
      console.log('[Settings] ensureAnonymous result:', {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
      });
    } catch (e: any) {
      setStatus(`Auth error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const testUpload = async () => {
    setBusy(true);
    try {
      const user = await ensureAnonymous();
      console.log('[Settings] testUpload using user:', {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
      });

      const path = `test/${user.uid}/${Date.now()}.txt`;
      const data = new Blob(
        [`hello from app @ ${new Date().toISOString()}`],
        {
          type: 'text/plain',
        },
      );
      const r = ref(storage, path);
      await uploadBytes(r, data);
      const url = await getDownloadURL(r);
      setStatus(`Uploaded ✓  (${url.slice(0, 48)}…)`);
    } catch (e: any) {
      setStatus(`Upload error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  // Fetch cloud videos for this user
  const debugFetchCloud = async () => {
    setBusy(true);
    try {
      const vids = await fetchMyVideos();
      console.log('🔥 fetchMyVideos (from Settings) ->', vids);
      setCloudVideos(vids); // save to state so we can render them
      setStatus(`Fetched ${vids.length} cloud videos`);
    } catch (e: any) {
      setStatus(`fetchMyVideos error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  // When you tap a cloud video, get its download URL and navigate to cloud playback
  const handleOpenCloudVideo = async (video: CloudVideo) => {
    setBusy(true);
    try {
      const r = ref(storage, video.storageKey);
      const url = await getDownloadURL(r);
      console.log('[Settings] Cloud video download URL:', {
        shareId: video.shareId,
        storageKey: video.storageKey,
        url,
      });

      setStatus(`Got URL for ${video.shareId}`);

      // Navigate to the simple cloud playback screen
      router.push({
        pathname: '/cloud-playback',
        params: {
          uri: url,
          shareId: video.shareId,
        },
      });
    } catch (e: any) {
      setStatus(`getDownloadURL error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const goToSignIn = () => {
    // (auth) is a group, so the path is just "/sign-in"
    router.push('/sign-in');
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      console.log('[Settings] Signed out on this device');
      setStatus(
        'Signed out. Next upload/record will create or use a user again.',
      );
    } catch (e: any) {
      setStatus(`Sign-out error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: 'black' }}>
      <Text
        style={{
          color: 'white',
          fontSize: 24,
          fontWeight: '900',
          marginBottom: 16,
        }}
      >
        Settings
      </Text>

      {/* CURRENT AUTH STATUS */}
      <Text style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
        {describeCurrentUser()}
      </Text>

      {/* MANAGE ACCOUNT */}
      <TouchableOpacity
        onPress={goToSignIn}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Go to Sign In / Create Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSignOut}
        style={{
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>
          Sign out (dev)
        </Text>
      </TouchableOpacity>

      {/* ORIGINAL TEST BUTTONS */}
      <TouchableOpacity
        onPress={testAuth}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Test Anonymous Sign-in
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={testUpload}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Test Upload to Storage
        </Text>
      </TouchableOpacity>

      {/* Fetch cloud videos for this account */}
      <TouchableOpacity
        onPress={debugFetchCloud}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Debug: Fetch Cloud Videos
        </Text>
      </TouchableOpacity>

      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: 'white', marginTop: 8 }}>{status}</Text>
      )}

      {/* Simple cloud videos debug list */}
      <View style={{ marginTop: 16 }}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontWeight: '700',
            marginBottom: 4,
          }}
        >
          Cloud videos for this account: {cloudVideos.length}
        </Text>

        {cloudVideos.map((v) => (
          <TouchableOpacity
            key={v.id}
            onPress={() => handleOpenCloudVideo(v)}
            style={{
              paddingVertical: 4,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Text style={{ color: 'white', fontSize: 12 }}>
              shareId: {v.shareId}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              storageKey: {v.storageKey}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              createdAt: {new Date(v.createdAt).toLocaleString()}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              (Tap to open cloud playback)
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
