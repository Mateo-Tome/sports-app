import { Stack, useLocalSearchParams } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import PlaybackScreen from '../screens/PlaybackScreen';

export default function SharePage() {
  const { shareId } = useLocalSearchParams<{ shareId?: string }>();

  // normalize param
  const sid = Array.isArray(shareId) ? shareId[0] : shareId;

  // guard
  if (!sid) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'white', fontWeight: '900' }}>Missing shareId</Text>
      </View>
    );
  }

  // This route is mainly for WEB
  if (Platform.OS !== 'web') {
    return <PlaybackScreen />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlaybackScreen />
    </>
  );
}
