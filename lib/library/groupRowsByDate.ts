import type { LibraryRow } from '../../components/library/LibraryVideoRow';

export type DateGroupedLibraryItem =
  | {
      type: 'month';
      id: string;
      title: string;
    }
  | {
      type: 'day';
      id: string;
      title: string;
      subtitle: string;
      clipCount: number;
    }
  | {
      type: 'clip';
      id: string;
      row: LibraryRow;
    };

function getRowTime(row: LibraryRow) {
  return Number(row.mtime ?? 0) || Date.now();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatDayTitle(date: Date) {
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'TODAY';
  if (isSameDay(date, yesterday)) return 'YESTERDAY';

  return date
    .toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();
}

function formatDaySubtitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

export function groupRowsByDate(rows: LibraryRow[]): DateGroupedLibraryItem[] {
  const sorted = [...rows].sort((a, b) => getRowTime(b) - getRowTime(a));

  const byDay: Record<string, LibraryRow[]> = {};

  for (const row of sorted) {
    const date = new Date(getRowTime(row));
    const key = dayKey(date);

    byDay[key] ||= [];
    byDay[key].push(row);
  }

  const dayEntries = Object.entries(byDay).sort(([, a], [, b]) => {
    return getRowTime(b[0]) - getRowTime(a[0]);
  });

  const output: DateGroupedLibraryItem[] = [];

  let currentMonth = '';

  for (const [key, dayRows] of dayEntries) {
    const date = new Date(getRowTime(dayRows[0]));
    const mKey = monthKey(date);

    if (mKey !== currentMonth) {
      currentMonth = mKey;

      output.push({
        type: 'month',
        id: `month:${mKey}`,
        title: formatMonth(date),
      });
    }

    output.push({
      type: 'day',
      id: `day:${key}`,
      title: formatDayTitle(date),
      subtitle: formatDaySubtitle(date),
      clipCount: dayRows.length,
    });

    for (const row of dayRows) {
      output.push({
        type: 'clip',
        id: `clip:${row.uri}`,
        row,
      });
    }
  }

  return output;
}