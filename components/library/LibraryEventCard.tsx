import { Pressable, Text } from 'react-native';

import type { LibraryEventGroup } from '../../lib/library/eventGroups';

type Props = {
  event: LibraryEventGroup;
  onPress: () => void;
};

function formatSports(labels: string[]) {
  if (!labels.length) return 'Unknown sport';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, 2).join(', ')}${labels.length > 2 ? ' +' + (labels.length - 2) : ''}`;
}

export default function LibraryEventCard({ event, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Text style={{ color: 'white', fontSize: 17, fontWeight: '900' }} numberOfLines={1}>
        {event.eventTitle}
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 8, fontWeight: '700' }}>
        {event.clipCount} clips • {event.athleteCount} athletes
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 6 }} numberOfLines={1}>
        {formatSports(event.sportLabels)}
      </Text>
    </Pressable>
  );
}