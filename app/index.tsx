// app/index.tsx
// Local-only entry: no Firebase, no auth.
// Just send the user straight into the main tabs.

import { Redirect } from 'expo-router';

export default function RootIndex() {
  return <Redirect href="/(tabs)" />;
}
