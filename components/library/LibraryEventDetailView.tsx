import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import EventBasketballStatsCard from './EventBasketballStatsCard';
import type { LibraryRow } from './LibraryVideoRow';

type Props = {
  eventTitle: string;
  rows: LibraryRow[];
  tabBarHeight: number;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  renderVideoRow: ({ item }: { item: LibraryRow }) => React.ReactElement | null;
};

function clean(v: any): string {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

function groupRows(rows: LibraryRow[]) {
  const grouped: {
    athlete: string;
    sports: {
      sport: string;
      rows: LibraryRow[];
    }[];
  }[] = [];

  const athleteMap = new Map<string, Map<string, LibraryRow[]>>();

  for (const row of rows) {
    const athlete = clean(row.athlete) || 'Unassigned';
    const sport = clean(row.sport) || 'Unknown Sport';

    if (!athleteMap.has(athlete)) {
      athleteMap.set(athlete, new Map());
    }

    const sportMap = athleteMap.get(athlete)!;

    if (!sportMap.has(sport)) {
      sportMap.set(sport, []);
    }

    sportMap.get(sport)!.push(row);
  }

  for (const [athlete, sportMap] of athleteMap.entries()) {
    grouped.push({
      athlete,
      sports: [...sportMap.entries()].map(([sport, sportRows]) => ({
        sport,
        rows: sportRows.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0)),
      })),
    });
  }

  grouped.sort((a, b) => a.athlete.localeCompare(b.athlete));

  return grouped;
}

export default function LibraryEventDetailView({
  eventTitle,
  rows,
  tabBarHeight,
  refreshing,
  onRefresh,
  onBack,
  renderVideoRow,
}: Props) {
  const grouped = groupRows(rows);

  const flatData: Array<
    | { type: 'athlete'; key: string; title: string }
    | { type: 'sport'; key: string; title: string; count: number }
    | { type: 'clip'; key: string; row: LibraryRow }
  > = [];

  for (const athleteGroup of grouped) {
    flatData.push({
      type: 'athlete',
      key: `athlete:${athleteGroup.athlete}`,
      title: athleteGroup.athlete,
    });

    for (const sportGroup of athleteGroup.sports) {
      flatData.push({
        type: 'sport',
        key: `sport:${athleteGroup.athlete}:${sportGroup.sport}`,
        title: sportGroup.sport,
        count: sportGroup.rows.length,
      });

      for (const row of sportGroup.rows) {
        flatData.push({
          type: 'clip',
          key: row.uri,
          row,
        });
      }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'white',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '900' }} numberOfLines={1}>
            {eventTitle}
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {rows.length} {rows.length === 1 ? 'clip' : 'clips'}
          </Text>
        </View>
      </View>

      <EventBasketballStatsCard rows={rows} />

      <FlatList
        data={flatData}
        keyExtractor={(item) => item.key}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        renderItem={({ item }) => {
          if (item.type === 'athlete') {
            return (
              <Text
                style={{
                  color: 'white',
                  fontSize: 18,
                  fontWeight: '900',
                  marginHorizontal: 16,
                  marginTop: 14,
                  marginBottom: 4,
                }}
              >
                {item.title}
              </Text>
            );
          }

          if (item.type === 'sport') {
            return (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: 13,
                  fontWeight: '800',
                  marginHorizontal: 16,
                  marginTop: 8,
                  marginBottom: 4,
                }}
              >
                {item.title} • {item.count} {item.count === 1 ? 'clip' : 'clips'}
              </Text>
            );
          }

          return renderVideoRow({ item: item.row });
        }}
      />
    </View>
  );
}