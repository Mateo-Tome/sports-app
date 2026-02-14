// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // Always land somewhere real. Your _layout.tsx will still redirect to auth if needed.
  return <Redirect href="/(tabs)" />;
}
