// app/(auth)/_layout.tsx (Simplified)

import { Stack } from 'expo-router';

export default function AuthLayout() {
  // useEffect removed - global auth state is handled in the root layout

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}