import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { readSidecarForUpload } from '../../lib/library/sidecars';
import { reduceBasketballDefault } from '../../src/stats/reducers/basketball/reduceBasketball';
import type { LibraryRow } from './LibraryVideoRow';

type Props = {
  rows: LibraryRow[];
};

export default function EventBasketballStatsCard({ rows }: Props) {
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const basketballRows = rows.filter((row) =>
        String(row.sport ?? '').toLowerCase().startsWith('basketball')
      );

      const sidecars = [];

      for (const row of basketballRows) {
        const sidecar = await readSidecarForUpload(row.uri);
        if (sidecar) sidecars.push(sidecar);
      }

      const nextStats = reduceBasketballDefault(sidecars as any);

      if (!cancelled) setStats(nextStats);
    }

    run().catch((e) => {
      console.log('[EventBasketballStatsCard] failed:', e);
      if (!cancelled) setStats(null);
    });

    return () => {
      cancelled = true;
    };
  }, [rows]);

  if (!stats || stats.totals.clips === 0) return null;

  const reb = stats.counts.reboundOff + stats.counts.reboundDef;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 12,
        padding: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 13, opacity: 0.7 }}>
        GAME STATS
      </Text>

      <Text style={{ color: 'white', fontWeight: '900', fontSize: 34, marginTop: 6 }}>
        {stats.points.total} PTS
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '700' }}>
        {stats.totals.clips} clips • {stats.totals.events} events • Best clip {stats.bestClip.points} pts
      </Text>

      <View style={{ marginTop: 12, gap: 6 }}>
        <Text style={{ color: 'white', fontWeight: '800' }}>
          2PT {stats.shooting.t2M}/{stats.shooting.t2A} • 3PT {stats.shooting.t3M}/{stats.shooting.t3A} • FT {stats.shooting.ftM}/{stats.shooting.ftA}
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '800' }}>
          AST {stats.counts.assist} • REB {reb} • STL {stats.counts.steal} • BLK {stats.counts.block}
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '800' }}>
          TO {stats.counts.turnover} • FOUL {stats.counts.foul} • PASS {stats.counts.pass}
        </Text>
      </View>
    </View>
  );
}