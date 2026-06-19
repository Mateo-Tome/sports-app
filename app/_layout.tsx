// app/_layout.tsx
import { authReady } from '@/lib/firebase';
import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const user = await authReady();

      if (!alive) return;

      const inAuthGroup = segments[0] === '(auth)';

      if (!user || user.isAnonymous) {
        if (!inAuthGroup) {
          router.replace('/(auth)/sign-in');
        }
      } else if (inAuthGroup) {
        router.replace('/(tabs)');
      }

      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [segments]);

  if (!ready) {
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