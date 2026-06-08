import { Pressable, Text } from 'react-native';

import type { LibraryEventGroup } from '../../lib/library/eventGroups';

type Props = {
  event: LibraryEventGroup;
  onPress: () => void;
};

export default function LibraryEventCard({ event, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16,
        marginVertical: 7,
        paddingHorizontal: 15,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: pressed
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(255,255,255,0.075)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
      })}
    >
      <Text
        style={{
          color: 'white',
          fontSize: 17,
          fontWeight: '900',
          letterSpacing: 0.2,
        }}
        numberOfLines={1}
      >
        {event.eventTitle}
      </Text>

      <Text
        style={{
          color: 'rgba(255,255,255,0.68)',
          marginTop: 7,
          fontSize: 13,
          fontWeight: '700',
        }}
        numberOfLines={1}
      >
        {event.clipCount} clips • {event.athleteCount} athletes
      </Text>
    </Pressable>
  );
}