import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import PlaybackScreen from '../screens/PlaybackScreen';

export default function SharePage() {
  const { shareId } = useLocalSearchParams<{ shareId?: string }>();
  const sid = Array.isArray(shareId) ? shareId[0] : shareId;

  if (!sid) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
          Missing share link
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlaybackScreen />
    </>
  );
}