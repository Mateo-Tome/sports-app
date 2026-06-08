import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
    reduceBaseballHitting,
    type BaseballHittingStats,
} from '@/src/stats/reducers/baseball/hitting';
import {
    reduceBaseballPitching,
    type BaseballPitchingStats,
} from '@/src/stats/reducers/baseball/pitching';
import type { LibraryRow } from '../LibraryVideoRow';

type EventSidecarEntry = {
  uri: string;
  sidecar: any;
};

type Props = {
  rows: LibraryRow[];
  eventSidecars?: EventSidecarEntry[];
};

type Tab = 'hitting' | 'pitching';

function getSportKey(row: LibraryRow) {
  return String((row as any).sportKey ?? row.sport ?? '').toLowerCase();
}

function isHitting(row: LibraryRow) {
  const key = getSportKey(row);
  return key === 'baseball:hitting' || key === 'softball:hitting';
}

function isPitching(row: LibraryRow) {
  const key = getSportKey(row);
  return key === 'baseball:pitching' || key === 'softball:pitching';
}

function pctText(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function StatBox({ label, value }: { label: string | number; value: string | number }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '30%',
        padding: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 11 }}>
        {label}
      </Text>

      <Text style={{ color: 'white', fontWeight: '900', fontSize: 20, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function DetailLine({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: 'rgba(255,255,255,0.72)', marginTop: 7, fontWeight: '800' }}>
      {children}
    </Text>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 9,
        borderRadius: 999,
        alignItems: 'center',
        backgroundColor: active ? 'white' : 'rgba(255,255,255,0.08)',
      }}
    >
      <Text style={{ color: active ? 'black' : 'white', fontWeight: '900' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EventDiamondStatsCard({
  rows,
  eventSidecars = [],
}: Props) {
  const [tab, setTab] = useState<Tab>('hitting');

  const counts = useMemo(() => {
    return {
      hitting: rows.filter(isHitting).length,
      pitching: rows.filter(isPitching).length,
    };
  }, [rows]);

  const { hittingStats, pitchingStats } = useMemo<{
    hittingStats: BaseballHittingStats | null;
    pitchingStats: BaseballPitchingStats | null;
  }>(() => {
    const hittingUris = new Set(rows.filter(isHitting).map((row) => row.uri));
    const pitchingUris = new Set(rows.filter(isPitching).map((row) => row.uri));

    const hittingSidecars = eventSidecars
      .filter((entry) => hittingUris.has(entry.uri))
      .map((entry) => entry.sidecar)
      .filter(Boolean);

    const pitchingSidecars = eventSidecars
      .filter((entry) => pitchingUris.has(entry.uri))
      .map((entry) => entry.sidecar)
      .filter(Boolean);

    return {
      hittingStats: hittingSidecars.length
        ? reduceBaseballHitting(hittingSidecars as any)
        : null,
      pitchingStats: pitchingSidecars.length
        ? reduceBaseballPitching(pitchingSidecars as any)
        : null,
    };
  }, [rows, eventSidecars]);

  if (!hittingStats && !pitchingStats) return null;

  const activeTab: Tab =
    tab === 'hitting' && hittingStats
      ? 'hitting'
      : tab === 'pitching' && pitchingStats
        ? 'pitching'
        : pitchingStats
          ? 'pitching'
          : 'hitting';

  const showToggle = !!hittingStats && !!pitchingStats;
  const showingHitting = activeTab === 'hitting' && !!hittingStats;
  const showingPitching = activeTab === 'pitching' && !!pitchingStats;

  const hittingKRate = hittingStats
    ? pctText(hittingStats.counts.strikeout, hittingStats.derived.plateAppearances)
    : '0%';

  const hittingWalkRate = hittingStats
    ? pctText(hittingStats.counts.walk, hittingStats.derived.plateAppearances)
    : '0%';

  const xbh = hittingStats
    ? hittingStats.counts.hitTypes.double +
      hittingStats.counts.hitTypes.triple +
      hittingStats.counts.homerun
    : 0;

  const pitchingBallPct = pitchingStats?.derived
    ? pctText(pitchingStats.counts.ball, pitchingStats.derived.totalPitches)
    : '0%';

  const pitchingKRate = pitchingStats?.derived?.kPctText ?? '0%';
  const pitchingWalkRate = pitchingStats?.derived?.bbPctText ?? '0%';

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 10,
        padding: 14,
        borderRadius: 18,
        backgroundColor: 'rgba(220,38,38,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.35)',
      }}
    >
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
        Game Stats
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '700' }}>
        {counts.hitting} hitting clips • {counts.pitching} pitching clips
      </Text>

      {showToggle ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <TabButton label="Hitting" active={activeTab === 'hitting'} onPress={() => setTab('hitting')} />
          <TabButton label="Pitching" active={activeTab === 'pitching'} onPress={() => setTab('pitching')} />
        </View>
      ) : null}

      {showingHitting && hittingStats ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <StatBox label="AVG" value={hittingStats.derived.battingAverageText} />
            <StatBox label="OBP" value={hittingStats.derived.onBasePctText} />
            <StatBox label="RBI" value={hittingStats.counts.rbi.total} />

            <StatBox label="Hits" value={hittingStats.derived.hits} />
            <StatBox label="XBH" value={xbh} />
            <StatBox label="HR" value={hittingStats.counts.homerun} />

            <StatBox label="PA" value={hittingStats.derived.plateAppearances} />
            <StatBox label="K%" value={hittingKRate} />
            <StatBox label="Walk %" value={hittingWalkRate} />
          </View>

          <DetailLine>XBH = 2B + 3B + HR</DetailLine>

          <DetailLine>
            1B: {hittingStats.counts.hitTypes.single} • 2B: {hittingStats.counts.hitTypes.double} • 3B: {hittingStats.counts.hitTypes.triple}
          </DetailLine>

          <DetailLine>
            Walks: {hittingStats.counts.walk} • HBP: {hittingStats.counts.hitByPitch} • Strikeouts: {hittingStats.counts.strikeout}
          </DetailLine>
        </>
      ) : null}

      {showingPitching && pitchingStats?.derived ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <StatBox label="Pitches" value={pitchingStats.derived.totalPitches} />
            <StatBox label="Strike %" value={pitchingStats.derived.strikePctText} />
            <StatBox label="Ball %" value={pitchingBallPct} />

            <StatBox label="K%" value={pitchingKRate} />
            <StatBox label="Walk %" value={pitchingWalkRate} />
            <StatBox label="K/Walk" value={pitchingStats.derived.kbbText} />

            <StatBox label="Strikeouts" value={pitchingStats.counts.strikeout} />
            <StatBox label="Walks" value={pitchingStats.counts.walk} />
            <StatBox label="Hits Allowed" value={pitchingStats.derived.hitsTotalAllowed} />
          </View>

          <DetailLine>
            Balls: {pitchingStats.counts.ball} • Strikes: {pitchingStats.counts.strike} • Fouls: {pitchingStats.counts.foul}
          </DetailLine>

          <DetailLine>
            Called strikes: {pitchingStats.counts.strikeTypes.looking} • Swinging strikes: {pitchingStats.counts.strikeTypes.swinging}
          </DetailLine>

          <DetailLine>
            HBP: {pitchingStats.counts.hitByPitch} • HR allowed: {pitchingStats.counts.homerunAllowed} • Batters finished: {pitchingStats.derived.battersFaced}
          </DetailLine>
        </>
      ) : null}
    </View>
  );
}