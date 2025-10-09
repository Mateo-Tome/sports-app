// app/(tabs)/settings.tsx
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
// ⬇️ from (tabs) go up two levels to project root, then into lib
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ensureAnonymous, storage } from '../../lib/firebase';

// ...rest of the file stays the same


export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Ready');

  const testAuth = async () => {
    setBusy(true);
    try {
      const user = await ensureAnonymous();
      setStatus(`Signed in (anon): ${user.uid.slice(0, 6)}…`);
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

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: 'black' }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 16 }}>
        Settings
      </Text>

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
        <Text style={{ color: '#111', fontWeight: '900' }}>Test Anonymous Sign-in</Text>
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
        <Text style={{ color: '#111', fontWeight: '900' }}>Test Upload to Storage</Text>
      </TouchableOpacity>

      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: 'white', marginTop: 8 }}>{status}</Text>
      )}
    </View>
  );
}
