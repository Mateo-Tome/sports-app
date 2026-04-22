import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function ShortShareRedirectPage() {
  const { shareId } = useLocalSearchParams<{ shareId?: string }>();
  const sid = Array.isArray(shareId) ? shareId[0] : shareId;

  if (!sid) return <View style={{ flex: 1, backgroundColor: 'black' }} />;

  return <Redirect href={`/share/${sid}`} />;
}