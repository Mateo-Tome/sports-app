// app/(tabs)/settings.tsx
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { signOut } from 'firebase/auth';
import { testGetUploadUrl } from '../../lib/backend';
import { auth, ensureAnonymous, storage } from '../../lib/firebase';
import { uploadVideoToB2 } from '../../lib/uploadVideoToB2';
import { fetchMyVideos, type VideoRow } from '../../lib/videos';

// 🔥 TEMP: hardcode a shareId you know exists in Firestore shareIndex/videos
const TEST_SHARE_ID = 'vXdCFK3k5Ke6';

function createdAtToMs(createdAt: VideoRow['createdAt']): number | null {
  try {
    if (!createdAt) return null;

    // Firestore Timestamp-like { seconds }
    if (typeof createdAt === 'object' && createdAt && 'seconds' in (createdAt as any)) {
      return Number((createdAt as any).seconds) * 1000;
    }

    if (typeof createdAt === 'number') return createdAt;

    const d = new Date(String(createdAt));
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch {
    return null;
  }
}

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Ready');

  // ✅ FIX: store VideoRow[] (matches fetchMyVideos)
  const [cloudVideos, setCloudVideos] = useState<VideoRow[]>([]);

  useEffect(() => {
    const u = auth.currentUser;
    console.log('[Settings] Current user on this device:', {
      uid: u?.uid,
      email: u?.email,
      isAnonymous: u?.isAnonymous,
    });
  }, []);

  const describeCurrentUser = () => {
    const u = auth.currentUser;
    if (!u) return 'Not signed in';
    if (u.isAnonymous) return `Guest user: ${u.uid.slice(0, 6)}…`;
    return `Signed in as: ${u.email ?? u.uid.slice(0, 6) + '…'}`;
  };

  const goToSignIn = () => router.push('/sign-in');

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

  const debugLogIdToken = async () => {
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error('No currentUser. Sign in first.');
      const token = await u.getIdToken(true);
      console.log('🔥🔥🔥 ID TOKEN 🔥🔥🔥');
      console.log(token);
      setStatus('Logged ID token to console ✓');
    } catch (e: any) {
      setStatus(`Token error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  // Existing Firebase Storage test (unchanged)
  const testUpload = async () => {
    setBusy(true);
    try {
      const user = await ensureAnonymous();
      console.log('[Settings] testUpload using user:', {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
      });

      const path = `test/${user.uid}/${Date.now()}.txt`;
      const data = new Blob([`hello from app @ ${new Date().toISOString()}`], {
        type: 'text/plain',
      });

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
      setCloudVideos(vids);
      setStatus(`Fetched ${vids.length} cloud videos`);
    } catch (e: any) {
      setStatus(`fetchMyVideos error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  // ✅ FIX: accept VideoRow, and don't assume storageKey exists
  const handleOpenCloudVideo = async (video: VideoRow) => {
    setBusy(true);
    try {
      // 1) If this clip is still Firebase Storage era
      if (video.storageKey) {
        const r = ref(storage, video.storageKey);
        const url = await getDownloadURL(r);

        console.log('[Settings] Cloud video download URL:', {
          shareId: video.shareId,
          storageKey: video.storageKey,
          url,
        });

        setStatus(`Got URL for ${video.shareId ?? video.id}`);

        router.push({
          pathname: '/cloud-playback',
          params: {
            uri: url,
            shareId: video.shareId ?? '',
          },
        } as any);

        return;
      }

      // 2) Otherwise open by shareId (your cloud-playback should resolve signed URL)
      if (video.shareId) {
        setStatus(`Open by shareId: ${video.shareId}`);
        router.push({
          pathname: '/cloud-playback',
          params: { shareId: video.shareId },
        } as any);
        return;
      }

      throw new Error('No storageKey and no shareId on this video doc.');
    } catch (e: any) {
      setStatus(`Open error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      console.log('[Settings] Signed out on this device');
      setStatus('Signed out. Next upload/record will create or use a user again.');
    } catch (e: any) {
      setStatus(`Sign-out error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const testBackendUploadEndpoint = async () => {
    setBusy(true);
    try {
      await ensureAnonymous();

      console.log('[Settings] Calling testGetUploadUrl...');
      const r: any = await testGetUploadUrl();

      const bucket = r?.bucketName ?? 'unknown';
      const hasUploadUrl = !!r?.uploadUrl;

      setStatus(`Backend OK ✓ bucket=${bucket} uploadUrl=${hasUploadUrl ? 'yes' : 'no'}`);
    } catch (e: any) {
      console.log('❌ [Settings] testBackendUploadEndpoint error:', e);
      setStatus(`Backend error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const testB2Upload = async () => {
    setBusy(true);
    try {
      const user = await ensureAnonymous();

      console.log('[Settings] testB2Upload using user:', {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
      });

      const r: any = await testGetUploadUrl();

      if (!r?.uploadUrl || !r?.uploadAuthToken) {
        throw new Error(
          `testGetUploadUrl did not return uploadUrl/uploadAuthToken. Got: ${JSON.stringify(r)}`
        );
      }

      const localPath = FileSystem.cacheDirectory + `b2-test-${Date.now()}.txt`;

      await FileSystem.writeAsStringAsync(
        localPath,
        `hello b2 @ ${new Date().toISOString()}\nuid=${user.uid}\n`,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      const out = await uploadVideoToB2({
        uploadUrl: r.uploadUrl,
        uploadAuthToken: r.uploadAuthToken,
        uid: user.uid,
        localFileUri: localPath,
        originalFileName: 'hello.txt',
        mimeType: 'text/plain',
      });

      console.log('✅ B2 upload success:', out);
      setStatus(`B2 upload OK ✓ fileId=${out?.fileId ?? 'unknown'}`);
    } catch (e: any) {
      console.log('❌ testB2Upload error:', e);
      setStatus(`B2 upload error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const openTestSharePlayback = () => {
    router.push({
      pathname: '/screens/PlaybackScreen',
      params: { shareId: TEST_SHARE_ID },
    } as any);
  };

  // Just for display formatting in the list
  const cloudList = useMemo(() => {
    return cloudVideos.map((v) => {
      const ms = createdAtToMs(v.createdAt);
      return { v, createdLabel: ms ? new Date(ms).toLocaleString() : '—' };
    });
  }, [cloudVideos]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: 'black' }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 16 }}>
        Settings
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
        {describeCurrentUser()}
      </Text>

      <Pressable
        onPress={openTestSharePlayback}
        style={{
          backgroundColor: '#22c55e',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          TEST SHARE PLAYBACK (shareId: {TEST_SHARE_ID})
        </Text>
      </Pressable>

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
        onPress={debugLogIdToken}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Debug: Log ID Token
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

      <TouchableOpacity
        onPress={testBackendUploadEndpoint}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Test Backend Upload Endpoint
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={testB2Upload}
        style={{
          backgroundColor: 'white',
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>
          Test Upload to Backblaze (B2)
        </Text>
      </TouchableOpacity>

      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: 'white', marginTop: 8 }}>{status}</Text>
      )}

      <View style={{ marginTop: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginBottom: 4 }}>
          Cloud videos for this account: {cloudVideos.length}
        </Text>

        {cloudList.map(({ v, createdLabel }) => (
          <TouchableOpacity
            key={v.id}
            onPress={() => handleOpenCloudVideo(v)}
            style={{
              paddingVertical: 4,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Text style={{ color: 'white', fontSize: 12 }}>shareId: {v.shareId ?? '—'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              storageKey: {v.storageKey ?? '—'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              createdAt: {createdLabel}
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
