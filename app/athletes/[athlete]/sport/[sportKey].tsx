// app/athletes/[athlete]/sport/[sportKey].tsx
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildAthleteStats } from '../../../../src/stats/buildAthleteStats';
import { loadVerifiedClipsForAthleteFromCloud } from '../../../../src/stats/loadClipsCloud';
import { loadClipsForAthleteFromLocal } from '../../../../src/stats/loadClipsLocal';
import { sportTitle } from '../../../../src/stats/sportMeta';
import { renderSportStatsCard } from '../../../../src/stats/ui/renderSportStats';

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <TouchableOpacity onPress={onBack} style={{ paddingVertical: 10 }}>
        <Text style={{ color: 'rgba(224,251,255,1)', fontWeight: '900' }}>
          {'← Back'}
        </Text>
      </TouchableOpacity>

      <Text
        style={{ color: 'white', fontSize: 22, fontWeight: '900' }}
        numberOfLines={1}
      >
        {title}
      </Text>

      {!!subtitle && (
        <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

export default function AthleteSportStatsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    athlete: string;
    sportKey: string;
    source?: string;
  }>();

  const athleteName = decodeURIComponent(String(params.athlete ?? 'Unassigned'));
  const sportKey = decodeURIComponent(String(params.sportKey ?? ''));
  const source = (params.source === 'cloud' ? 'cloud' : 'local') as
    | 'local'
    | 'cloud';

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<any>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const clips =
          source === 'cloud'
            ? await loadVerifiedClipsForAthleteFromCloud(athleteName)
            : await loadClipsForAthleteFromLocal(athleteName);

        const s = buildAthleteStats(athleteName, clips);

        if (!alive) return;
        setSummary(s);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Failed to load stats');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [athleteName, source]);

  const sportStats = summary?.bySport?.[sportKey];

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <Header
        title={sportTitle(sportKey)}
        subtitle={`${athleteName} • ${source === 'cloud' ? 'Cloud' : 'Local'}`}
        onBack={() => router.back()}
      />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator />
          <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>
            Loading…
          </Text>
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontWeight: '900' }}>Error</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
            {error}
          </Text>
        </View>
      ) : !sportStats ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontWeight: '900' }}>No stats yet</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
            {source === 'cloud'
              ? `No uploaded videos found for ${sportTitle(
                  sportKey,
                )}.\nUpload a video for ${athleteName} to see synced stats on any device.`
              : `No local videos found for ${sportTitle(
                  sportKey,
                )} on this device.\nRecord a video for ${athleteName} to see local stats immediately.`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        >
          {renderSportStatsCard(sportKey, sportStats, athleteName)}
        </ScrollView>
      )}
    </View>
  );
}
