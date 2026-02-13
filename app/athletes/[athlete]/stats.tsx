import { Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildAthleteStats } from '../../../src/stats/buildAthleteStats';
import { loadVerifiedClipsForAthleteFromCloud } from '../../../src/stats/loadClipsCloud';
import { sportTitle } from '../../../src/stats/sportMeta';

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        minWidth: 120,
        flexGrow: 1,
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '900' }}>{label}</Text>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function SportRow({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginTop: 10,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text style={{ color: 'white', fontSize: 15, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontWeight: '700' }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export default function AthleteStatsHomeScreen() {
  const insets = useSafeAreaInsets();
  const { athlete } = useLocalSearchParams<{ athlete: string }>();
  const athleteName = decodeURIComponent(String(athlete ?? 'Unassigned'));

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<any>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ ONE source of truth for cross-device stats:
        // uploaded clips -> Firestore metadata -> fetch sidecars -> build stats
        const clips = await loadVerifiedClipsForAthleteFromCloud(athleteName);
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
  }, [athleteName]);

  const sportKeys = Object.keys(summary?.bySport ?? {}).sort();
  const sportsCount = sportKeys.length;

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 10 }}>
          <Text style={{ color: 'rgba(224,251,255,1)', fontWeight: '900' }}>{'← Back'}</Text>
        </TouchableOpacity>

        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }} numberOfLines={1}>
          {athleteName}
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          Stats (synced)
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>Loading stats…</Text>
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontWeight: '900' }}>Error</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            <Pill label="Videos" value={String(summary?.totals?.videos ?? 0)} />
            <Pill label="Events" value={String(summary?.totals?.events ?? 0)} />
            <Pill label="Sports" value={String(sportsCount)} />
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }}>Select a sport</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
              Stats are based on uploaded videos for this account.
            </Text>

            {sportsCount === 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                  No uploaded stats found yet for this athlete.
                  {'\n'}
                  Upload a video for {athleteName} to see synced stats on any device.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 6 }}>
                {sportKeys.map((sportKey) => (
                  <SportRow
                    key={sportKey}
                    title={sportTitle(sportKey)}
                    subtitle="Tap to view details"
                    onPress={() =>
                      router.push({
                        pathname: '/athletes/[athlete]/sport/[sportKey]',
                        params: {
                          athlete: athleteName,
                          sportKey: encodeURIComponent(sportKey),
                        },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
