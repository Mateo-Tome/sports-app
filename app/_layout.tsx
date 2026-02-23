// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { InteractionManager, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { configureRevenueCat } from '@/lib/revenuecat';

const GUEST_OK_KEY = 'guest_ok';

export default function RootLayout() {
  const scheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const didNavRef = useRef(false);
  const didConfigureRCRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setBooted(true);

      // ✅ Configure RevenueCat at most once at startup, safely and deferred.
      if (!didConfigureRCRef.current) {
        didConfigureRCRef.current = true;
        InteractionManager.runAfterInteractions(() => {
          void configureRevenueCat(u?.uid ?? null);
        });
      }

      // allow nav effect to run again when auth changes
      didNavRef.current = false;
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!booted) return;

    let cancelled = false;

    (async () => {
      const inAuth = segments[0] === '(auth)';

      // ✅ Public routes (must be viewable while signed-out)
      // segments example for /privacy => ["privacy"]
      // segments example for /terms   => ["terms"]
      const isPublic = segments[0] === 'privacy' || segments[0] === 'terms';

      const isSignedOut = !user;
      const isGuest = !!user?.isAnonymous;
      const isRealUser = !!user && !user.isAnonymous;

      const guestOk = (await AsyncStorage.getItem(GUEST_OK_KEY)) === '1';
      const shouldShowAuth = isSignedOut || (isGuest && !guestOk);

      if (cancelled) return;

      // ✅ If signed out/guest-not-ok, allow public pages to render with NO redirect
      if (shouldShowAuth && isPublic) return;

      // Existing behavior
      if (shouldShowAuth && inAuth) return;
      if (!shouldShowAuth && !inAuth) return;

      if (didNavRef.current) return;
      didNavRef.current = true;

      if (shouldShowAuth) {
        router.replace('/(auth)/sign-in');
      } else if (isRealUser || isGuest) {
        router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [booted, user, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}