import type { LibraryRow } from '../LibraryVideoRow';
import EventBasketballStatsCard from './EventBasketballStatsCard';

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

  if (hasBasketball) {
    return <EventBasketballStatsCard rows={rows} />;
  }

  return null;
}