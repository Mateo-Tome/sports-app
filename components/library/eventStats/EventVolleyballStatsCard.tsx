import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { readSidecarForUpload } from '@/lib/library/sidecars';
import { reduceVolleyballDefault, type VolleyballDefaultStats } from '@/src/stats/reducers/volleyball/default';
import type { LibraryRow } from '../LibraryVideoRow';

type Props = {
  rows: LibraryRow[];
};

function isVolleyball(row: LibraryRow) {
  return String((row as any).sportKey ?? row.sport ?? '')
    .toLowerCase()
    .startsWith('volleyball');
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        padding: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 12 }}>
        {label}
      </Text>
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 20, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

export default function EventVolleyballStatsCard({ rows }: Props) {
  const [stats, setStats] = useState<VolleyballDefaultStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const volleyballRows = rows.filter(isVolleyball);

      const sidecars = (
        await Promise.all(
          volleyballRows.map(async (row) => {
            try {
              return await readSidecarForUpload(row.uri);
            } catch {
              return null;
            }
          }),
        )
      ).filter(Boolean) as any[];

      if (cancelled) return;

      if (!sidecars.length) {
        setStats(null);
        return;
      }

      setStats(reduceVolleyballDefault(sidecars));
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  if (!stats) return null;

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
        Volleyball Event Stats
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '700' }}>
        {stats.totals.clips} clips • {stats.totals.events} tagged actions
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <StatBox label="Kills" value={stats.counts.kill} />
        <StatBox label="Hitting %" value={stats.derived.hittingPctText} />
        <StatBox label="Aces" value={stats.counts.ace} />
        <StatBox label="Serve In" value={stats.derived.serveInPctText} />
        <StatBox label="Pass Avg" value={stats.derived.passAvgText} />
        <StatBox label="Digs" value={stats.counts.dig} />
        <StatBox label="Blocks" value={stats.counts.block} />
        <StatBox label="Errors" value={stats.derived.totalErrors} />
      </View>

      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 14, fontWeight: '800' }}>
        Serve: {stats.counts.ace} aces • {stats.counts.serveError} errors • Efficiency {stats.derived.serveEfficiencyText}
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6, fontWeight: '800' }}>
        Pass: 3={stats.counts.pass3} • 2={stats.counts.pass2} • 1={stats.counts.pass1} • 0={stats.counts.pass0}
      </Text>
    </View>
  );
}