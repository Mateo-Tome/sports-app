import type { LibraryRow } from '../LibraryVideoRow';
import EventBasketballStatsCard from './EventBasketballStatsCard';
import EventVolleyballStatsCard from './EventVolleyballStatsCard';

type Props = {
  rows: LibraryRow[];
};

function getSportKey(row: LibraryRow) {
  return String((row as any).sportKey ?? row.sport ?? '').toLowerCase();
}

export default function EventStatsCard({ rows }: Props) {
  const hasBasketball = rows.some(row =>
    getSportKey(row).startsWith('basketball')
  );

  const hasVolleyball = rows.some(row =>
    getSportKey(row).startsWith('volleyball')
  );

  if (hasBasketball) {
    return <EventBasketballStatsCard rows={rows} />;
  }

  if (hasVolleyball) {
    return <EventVolleyballStatsCard rows={rows} />;
  }

  return null;
}