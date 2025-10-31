// app/_layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 🛑 IMPORTANT: All Supabase imports (User, supabase) are REMOVED to stop auth checking.

// ----------------------------------------------------------------------
// Auth Guard Hook (TEMPORARY BETA BYPASS)
// ----------------------------------------------------------------------
function useAuthGuard() {
  // Always return true immediately, bypassing all Supabase checks and redirects.
  // This allows the app to load immediately into the welcome screen.
  return true; 
}

// ----------------------------------------------------------------------
// Root Layout Component
// ----------------------------------------------------------------------
export default function RootLayout() {
  const scheme = useColorScheme();
  const isReady = useAuthGuard(); 

  // The check for !isReady is now guaranteed to pass instantly.
  if (!isReady) {
    // This block should never run now.
    return null; 
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Public Landing Page */}
          <Stack.Screen name="welcome" />
          
          {/* Authentication Group (Sign-In, Sign-Up) */}
          <Stack.Screen name="(auth)" /> 
          
          {/* Main App Content (Protected) */}
          <Stack.Screen name="(tabs)" />
          
          <Stack.Screen name="+not-found" /> 
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}