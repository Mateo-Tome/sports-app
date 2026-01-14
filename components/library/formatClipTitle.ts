// components/library/formatClipTitle.ts

import type { LibraryRow } from './LibraryVideoRow';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function formatClipTitle(row: Pick<LibraryRow, 'displayName' | 'athlete' | 'sport' | 'mtime'>) {
  const athlete = (row.athlete || 'Unassigned').trim() || 'Unassigned';
  const sport = (row.sport || 'unknown').trim() || 'unknown';

  let when = '';
  if (typeof row.mtime === 'number' && row.mtime > 0) {
    const d = new Date(row.mtime);
    const month = d.toLocaleString(undefined, { month: 'short' });
    const day = d.getDate();
    const hh = d.getHours();
    const mm = pad2(d.getMinutes());
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hh12 = ((hh + 11) % 12) + 1;
    when = `${month} ${day} at ${hh12}:${mm} ${ampm}`;
  }

  // If you later want “folkstyle” or a custom title, keep using displayName for that.
  // For now this matches your Next.js vibe: "Athlete • sport • date"
  const parts = [athlete, sport];
  if (when) parts.push(when);

  return parts.join(' • ');
}
