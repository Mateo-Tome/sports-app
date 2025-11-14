// components/modules/wrestling/WrestlingFolkstylePlaybackModule.tsx
import { Text, View } from 'react-native';
import type { PlaybackModuleProps } from '../types';

export default function WrestlingFolkstylePlaybackModule({
  now,
  duration,
  events,
  overlayOn,
  insets,
  liveScore,
}: PlaybackModuleProps) {
  if (!overlayOn) return null;

  const homeScore = liveScore?.home ?? 0;
  const oppScore  = liveScore?.opponent ?? 0;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 100,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          padding: 12,
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#22c55e', // green border for wrestling
        }}
      >
        <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>
          🤼 Folkstyle Wrestling
        </Text>

        <Text style={{ color: 'white', marginTop: 4 }}>
          Time: {now.toFixed(2)}s • Events: {events.length}
        </Text>

        <Text style={{ color: 'white', marginTop: 4 }}>
          Score: {homeScore} – {oppScore}
        </Text>
      </View>
    </View>
  );
}
