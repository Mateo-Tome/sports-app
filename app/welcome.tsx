// app/welcome.tsx
import { ensureAnonymous } from '@/lib/firebase';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export default function Welcome() {
  const [busy, setBusy] = useState(false);

  const continueAsGuest = async () => {
    try {
      setBusy(true);
      await ensureAnonymous();      // create/stabilize anon user
      router.replace('/(tabs)');    // into your app
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: 'white', fontSize: 30, fontWeight: '900', marginBottom: 12 }}>
        Welcome
      </Text>
      <Text style={{ color: 'white', opacity: 0.7, marginBottom: 24 }}>
        Record, highlight, and share. Start as a guest—upgrade on the web later.
      </Text>

      <TouchableOpacity
        onPress={continueAsGuest}
        disabled={busy}
        style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, opacity: busy ? 0.7 : 1 }}
      >
        <Text style={{ color: 'black', fontWeight: '900', textAlign: 'center' }}>
          {busy ? 'Setting up…' : 'Continue as guest'}
        </Text>
      </TouchableOpacity>

      {busy ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
    </View>
  );
}
