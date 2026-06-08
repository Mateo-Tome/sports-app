import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { reduceBasketballDefault } from '../../../src/stats/reducers/basketball/reduceBasketball';
import type { LibraryRow } from '../LibraryVideoRow';

type EventSidecarEntry = {
  uri: string;
  sidecar: any;
};

type Props = {
  rows: LibraryRow[];
  eventSidecars?: EventSidecarEntry[];
};

function pct(made: number, attempts: number) {
  if (!attempts) return '0%';
  return `${Math.round((made / attempts) * 100)}%`;
}

function isBasketball(row: LibraryRow) {
  return String((row as any).sportKey ?? row.sport ?? '')
    .toLowerCase()
    .startsWith('basketball');
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '47%',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '900' }}>
        {label}
      </Text>

      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 2 }}>
        {value}
      </Text>

      {!!sub && (
        <Text style={{ color: 'rgba(255,255,255,0.52)', fontSize: 10, fontWeight: '800', marginTop: 1 }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function ShootingRow({
  label,
  made,
  attempts,
}: {
  label: string;
  made: number;
  attempts: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '30%',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.20)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '900' }}>
        {label}
      </Text>

      <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginTop: 2 }}>
        {made}/{attempts}
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', marginTop: 1 }}>
        {pct(made, attempts)}
      </Text>
    </View>
  );
}

export default function EventBasketballStatsCard({
  rows,
  eventSidecars = [],
}: Props) {
  const stats = useMemo(() => {
    const basketballUris = new Set(
      rows.filter(isBasketball).map((row) => row.uri),
    );

    const basketballSidecars = eventSidecars
      .filter((entry) => basketballUris.has(entry.uri))
      .map((entry) => entry.sidecar)
      .filter(Boolean);

    if (!basketballSidecars.length) return null;

    return reduceBasketballDefault(basketballSidecars as any);
  }, [rows, eventSidecars]);

  if (!stats || stats.totals.clips === 0) return null;

  const reb = stats.counts.reboundOff + stats.counts.reboundDef;
  const fgPct = pct(stats.shooting.fgM, stats.shooting.fgA);

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 10,
        padding: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 12, opacity: 0.7 }}>
        GAME STATS
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <StatBox label="POINTS" value={`${stats.points.total}`} sub="total" />
        <StatBox label="FG%" value={fgPct} sub={`${stats.shooting.fgM}/${stats.shooting.fgA}`} />
        <StatBox label="BEST CLIP" value={`${stats.bestClip.points}`} sub="points" />
        <StatBox label="CLIPS" value={`${stats.totals.clips}`} sub={`${stats.totals.events} events`} />
      </View>

      <View
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.12)',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900', marginBottom: 7 }}>
          Shooting
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <ShootingRow label="2PT" made={stats.shooting.t2M} attempts={stats.shooting.t2A} />
          <ShootingRow label="3PT" made={stats.shooting.t3M} attempts={stats.shooting.t3A} />
          <ShootingRow label="FT" made={stats.shooting.ftM} attempts={stats.shooting.ftA} />
        </View>
      </View>

      <View
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.12)',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900', marginBottom: 6 }}>
          Impact
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '800', lineHeight: 21 }}>
          AST {stats.counts.assist} • REB {reb} • STL {stats.counts.steal} • BLK {stats.counts.block}
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.62)', fontWeight: '800', lineHeight: 21 }}>
          TO {stats.counts.turnover} • FOUL {stats.counts.foul} • PASS {stats.counts.pass}
        </Text>
      </View>
    </View>
  );
}