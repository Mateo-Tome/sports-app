import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { sportTitle } from '../../sportMeta';

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function safeStr(v: any, fallback = '--') {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(125,211,252,0.28)',
        backgroundColor: 'rgba(14,165,233,0.08)',
        padding: 14,
      }}
    >
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }}>{title}</Text>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 104,
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(125,211,252,0.26)',
        backgroundColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 6 }}>{String(value)}</Text>
      {!!sub && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        minWidth: 108,
        flexGrow: 1,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '900' }}>{label}</Text>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{String(value)}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginTop: 16, marginBottom: 8 }}>{children}</Text>;
}

export default function SwimmingStatsCard({
  stats,
  athleteName,
}: {
  stats: any;
  athleteName: string;
}) {
  const races = Array.isArray(stats?.races) ? stats.races : [];
  const [selectedRace, setSelectedRace] = useState<string | null>(null);

  const activeRace = useMemo(() => {
    if (!races.length) return null;
    return races.find((r: any) => r.raceLabel === selectedRace) ?? races[0];
  }, [races, selectedRace]);

  return (
    <CardShell title={sportTitle('swimming:race')}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <HeroStat label="Races" value={clamp0(stats?.totals?.finishedRaces)} sub={`${clamp0(stats?.totals?.clips)} clips`} />
        <HeroStat label="Race Types" value={clamp0(stats?.totals?.raceTypes)} sub="tracked" />
        <HeroStat label="Events" value={clamp0(stats?.totals?.events)} sub="logged" />
      </View>

      <SectionTitle>Race Type</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {races.length ? (
          races.map((race: any) => {
            const active = race.raceLabel === (activeRace?.raceLabel ?? '');
            return (
              <Pressable
                key={race.raceLabel}
                onPress={() => setSelectedRace(race.raceLabel)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? 'rgba(125,211,252,0.95)' : 'rgba(255,255,255,0.18)',
                  backgroundColor: active ? 'rgba(14,165,233,0.45)' : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>{race.raceLabel}</Text>
              </Pressable>
            );
          })
        ) : (
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '800' }}>
            No finished swimming races yet.
          </Text>
        )}
      </View>

      {activeRace ? (
        <>
          <SectionTitle>{activeRace.raceLabel}</SectionTitle>

          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <HeroStat label="Best" value={safeStr(activeRace.bestTimeText)} sub={`${clamp0(activeRace.finished)} finished`} />
            <HeroStat label="Latest" value={safeStr(activeRace.latestTimeText)} sub="most recent" />
            <HeroStat label="Average" value={safeStr(activeRace.avgTimeText)} sub="race time" />
          </View>

          <SectionTitle>Splits</SectionTitle>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Chip label="Avg Split" value={safeStr(activeRace.avgSplitText)} />
            <Chip label="Fastest Split" value={safeStr(activeRace.fastestSplitText)} />
            <Chip label="Avg Strokes" value={safeStr(activeRace.avgStrokesText)} />
            <Chip label="Clips" value={clamp0(activeRace.clips)} />
          </View>
        </>
      ) : null}
    </CardShell>
  );
}