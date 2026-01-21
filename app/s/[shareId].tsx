import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ShareRoute() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();

  if (!shareId || typeof shareId !== 'string') {
    return <Redirect href="/+not-found" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/screens/PlaybackScreen',
        params: { shareId },
      }}
    />
  );
}
