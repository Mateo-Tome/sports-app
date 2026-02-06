// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { auth } from '@/lib/firebase';
import { configureRevenueCat } from '@/lib/revenuecat';

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    // Configure RevenueCat once on app start.
    // Using Firebase UID keeps purchases attached to the same user across devices.
    const uid = auth.currentUser?.uid ?? null;
    configureRevenueCat(uid);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            {/* Main app tabs */}
            <Stack.Screen name="(tabs)" />

            {/* Auth group */}
            <Stack.Screen name="(auth)" />

            {/* Not-found handler */}
            <Stack.Screen name="+not-found" />
          </Stack>

          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
