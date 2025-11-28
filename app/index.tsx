// app/index.tsx
import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Temporary: always go straight to your main tabs layout.
  // We’ll re-introduce auth routing / welcome later.
  return <Redirect href="/(tabs)" />;
}
