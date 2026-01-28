import * as FileSystem from 'expo-file-system';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildAthleteStats } from '../../../../src/stats/buildAthleteStats';
import { sportTitle } from '../../../../src/stats/sportMeta';
import type { ClipSidecar } from '../../../../src/stats/types';
import { renderSportStatsCard } from '../../../../src/stats/ui/renderSportStats';

const VIDEOS_DIR = `${FileSystem.documentDirectory}videos`;

async function listDirSafe(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !info.isDirectory) return [];
    return await FileSystem.readDirectoryAsync(uri);
  } catch {
    return [];
  }
}

async function readJsonSafe<T>(uri: string): Promise<T | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadClipsForAthleteByScanning(athleteName: string): Promise<ClipSidecar[]> {
  const clips: ClipSidecar[] = [];

  const athleteDirs = await listDirSafe(VIDEOS_DIR);
  for (const athleteDirName of athleteDirs) {
    const athleteDirUri = `${VIDEOS_DIR}/${athleteDirName}`;
    const sportDirs = await listDirSafe(athleteDirUri);

    for (const sportDirName of sportDirs) {
      const sportDirUri = `${athleteDirUri}/${sportDirName}`;
      const files = await listDirSafe(sportDirUri);

      for (const f of files) {
        if (!f.toLowerCase().endsWith('.json')) continue;
        const jsonUri = `${sportDirUri}/${f}`;
        const clip = await readJsonSafe<ClipSidecar>(jsonUri);
        if (!clip) continue;

        if ((clip.athlete ?? '').trim() === athleteName.trim()) {
          clips.push(clip);
        }
      }
    }
  }

  clips.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return clips;
}

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
        <Text style={{ color: 'rgba(224,251,255,1)', fontWeight: '900' }}>{'← Back'}</Text>
      </TouchableOpacity>

      <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{subtitle}</Text>
      )}
    </View>
  );
}

export default function AthleteSportStatsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ athlete: string; sportKey: string }>();

  const athleteName = decodeURIComponent(String(params.athlete ?? 'Unassigned'));

  // NOTE: sportKey contains ":" so it may arrive URL-encoded
  const sportKey = decodeURIComponent(String(params.sportKey ?? ''));

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<any>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const clips = await loadClipsForAthleteByScanning(athleteName);
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

  const sportStats = summary?.bySport?.[sportKey];

  return (
    <View style={{ flex: 1, backgroundColor: 'black', paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <Header
        title={sportTitle(sportKey)}
        subtitle={athleteName}
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontWeight: '900' }}>Error</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>{error}</Text>
        </View>
      ) : !sportStats ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontWeight: '900' }}>No stats yet</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
            This athlete has no saved clips for {sportTitle(sportKey)}.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}>
          {renderSportStatsCard(sportKey, sportStats, athleteName)}
        </ScrollView>
      )}
    </View>
  );
}
