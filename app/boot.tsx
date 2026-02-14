// app/boot.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { auth } from '@/lib/firebase';

const GUEST_OK_KEY = 'guest_ok';

export default function Boot() {
  const didNavRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (didNavRef.current) return;
      didNavRef.current = true;

      const isSignedOut = !u;
      const isGuest = !!u?.isAnonymous;

      const guestOk = (await AsyncStorage.getItem(GUEST_OK_KEY)) === '1';
      const shouldShowAuth = isSignedOut || (isGuest && !guestOk);

      if (shouldShowAuth) router.replace('/(auth)/sign-in');
      else router.replace('/(tabs)');
    });

    return unsub;
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
      <Text style={{ color: 'white', marginTop: 12, fontWeight: '700' }}>Loading…</Text>
    </View>
  );
}
