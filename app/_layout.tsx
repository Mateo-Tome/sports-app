// app/_layout.tsx
import { auth } from '@/lib/firebase';
import { Stack, router, useSegments } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const segments = useSegments();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (user === undefined) return;

    const inAuthGroup = segments[0] === '(auth)';
    const signedIn = !!user && !user.isAnonymous;

    if (!signedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (signedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments]);

  if (user === undefined) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#ef4444" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}