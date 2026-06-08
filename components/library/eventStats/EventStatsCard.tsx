import type { LibraryRow } from '../LibraryVideoRow';
import EventBasketballStatsCard from './EventBasketballStatsCard';
import EventDiamondStatsCard from './EventDiamondStatsCard';
import EventVolleyballStatsCard from './EventVolleyballStatsCard';

type EventSidecarEntry = {
  uri: string;
  sidecar: any;
};

type Props = {
  rows: LibraryRow[];
  eventSidecars?: EventSidecarEntry[];
};

function getSportKey(row: LibraryRow) {
  return String((row as any).sportKey ?? row.sport ?? '').toLowerCase();
}

export default function EventStatsCard({ rows, eventSidecars = [] }: Props) {
  const hasBasketball = rows.some((row) =>
    getSportKey(row).startsWith('basketball'),
  );

  const hasVolleyball = rows.some((row) =>
    getSportKey(row).startsWith('volleyball'),
  );

  const hasDiamond = rows.some((row) => {
    const key = getSportKey(row);
    return key.startsWith('baseball') || key.startsWith('softball');
  });

  if (hasBasketball) {
    return <EventBasketballStatsCard rows={rows} eventSidecars={eventSidecars} />;
  }

  if (hasVolleyball) {
    return <EventVolleyballStatsCard rows={rows} />;
  }

  if (hasDiamond) {
    return <EventDiamondStatsCard rows={rows} />;
  }

  return null;
}