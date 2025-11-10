// components/modules/baseball/BaseballHittingPlaybackModule.tsx

import { Text, View } from 'react-native';
import { EventRow } from '../../utils';

// Define the component signature to match the Wrestling module, 
// even if we don't use all the props yet.

export default function BaseballHittingPlaybackModule({
  now,
  duration,
  events,
  homeIsAthlete,
  finalScore,
  overlayOn,
  insets,
  onSeek,
  enterAddMode,
  onPillLongPress,
  onPlayPause,
  isPlaying,
}: {
  now: number;
  duration: number;
  events: EventRow[];
  homeIsAthlete: boolean;
  finalScore: { home: number; opponent: number } | undefined;
  overlayOn: boolean;
  insets: { top: number; right: number; bottom: number; left: number };
  onSeek: (sec: number) => void;
  enterAddMode: () => void;
  onPillLongPress: (ev: EventRow) => void;
  onPlayPause: () => void;
  isPlaying: boolean;
}) {
  if (!overlayOn) return null;

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
          borderColor: 'yellow',
        }}
      >
        <Text style={{ color: 'yellow', fontWeight: 'bold' }}>
          ⚾️ Baseball Hitting Module Active! ⚾️
        </Text>
        <Text style={{ color: 'white', marginTop: 4 }}>
          Current Time: {now.toFixed(2)}s
        </Text>
        <Text style={{ color: 'white' }}>
          Events Logged: {events.length}
        </Text>
      </View>
    </View>
  );
}