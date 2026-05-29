import { FlatList, Text, View } from 'react-native';

import { buildEventGroups } from '../../lib/library/eventGroups';
import LibraryEventCard from './LibraryEventCard';

type Props = {
  rows: any[];
  tabBarHeight: number;
  refreshing: boolean;
  onRefresh: () => void;
  onPressEvent?: (eventId: string) => void;
};

export default function LibraryEventsView({
  rows,
  tabBarHeight,
  refreshing,
  onRefresh,
  onPressEvent,
}: Props) {
  const events = buildEventGroups(rows);

  if (!events.length) {
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          paddingBottom: tabBarHeight + 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
          No Events Yet
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 20,
          }}
        >
          Tap the + button on a clip to add it to an Event.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.eventId}
      contentContainerStyle={{
        paddingTop: 8,
        paddingBottom: tabBarHeight + 24,
      }}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={({ item }) => (
        <LibraryEventCard
          event={item}
          onPress={() => onPressEvent?.(item.eventId)}
        />
      )}
    />
  );
}