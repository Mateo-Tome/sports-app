import type { LibraryRow } from '../../components/library/LibraryVideoRow';

export type LibraryEventGroup = {
  eventId: string;
  eventTitle: string;
  clipCount: number;
  athleteCount: number;
  sportLabels: string[];
  latestAt: number;
  rows: LibraryRow[];
};

function clean(v: any): string {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

export function buildEventGroups(rows: LibraryRow[]): LibraryEventGroup[] {
  const groups = new Map<string, LibraryRow[]>();

  for (const row of rows) {
    const eventId = clean(row.gameId) || clean(row.gameTitle);
    if (!eventId) continue;

    const existing = groups.get(eventId) ?? [];
    existing.push(row);
    groups.set(eventId, existing);
  }

  return [...groups.entries()]
    .map(([eventId, eventRows]) => {
      const athleteIds = new Set<string>();
      const sportLabels = new Set<string>();

      let latestAt = 0;

      for (const row of eventRows) {
        const athleteKey = clean(row.athleteId) || clean(row.athlete);
        if (athleteKey) athleteIds.add(athleteKey);

        const sport = clean(row.sport);
        if (sport) sportLabels.add(sport);

        latestAt = Math.max(latestAt, row.mtime ?? 0);
      }

      return {
        eventId,
        eventTitle: clean(eventRows[0]?.gameTitle) || eventId || 'Untitled Event',
        clipCount: eventRows.length,
        athleteCount: athleteIds.size,
        sportLabels: [...sportLabels],
        latestAt,
        rows: eventRows,
      };
    })
    .sort((a, b) => b.latestAt - a.latestAt);
}