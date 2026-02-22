// lib/library/sports/volleyball/volleyballLibraryBits.ts
import { registerSportLibraryBits } from '../../sportLibraryStyleRegistry';

type AnyEvent = {
  key?: string;
  value?: number | null;
  meta?: any;
};

type BuilderArgs = { sport: string; sidecar: any | null };

function pickVolleyballEdgeColor(events: AnyEvent[]): string {
  const list = Array.isArray(events) ? events : [];
  const has = (k: string) => list.some((e) => String(e?.key || '') === k);

  // deepest red first
  if (has('attackError')) return '#7f1d1d';

  // other “bad”
  if (has('serveError') || has('net') || has('ballHandlingError') || has('error')) {
    return '#dc2626';
  }

  // strong “good”
  if (has('kill') || has('ace') || has('block')) return '#16a34a';

  // mild “good”
  if (has('dig') || has('touch') || has('firstBall') || has('serveIn') || has('attack')) {
    return '#38bdf8';
  }

  return 'rgba(255,255,255,0.18)';
}

function compactVolleyballBadge(events: AnyEvent[]): { text: string; color: string } | null {
  const list = Array.isArray(events) ? events : [];
  const counts: Record<string, number> = {};

  for (const e of list) {
    const k = String(e?.key || '');
    if (!k) continue;
    counts[k] = (counts[k] || 0) + 1;
  }

  const bits: string[] = [];
  if (counts.kill) bits.push(`K${counts.kill}`);
  if (counts.ace) bits.push(`A${counts.ace}`);
  if (counts.block) bits.push(`B${counts.block}`);
  if (counts.attackError) bits.push(`AE${counts.attackError}`);
  if (counts.serveError) bits.push(`SE${counts.serveError}`);

  if (!bits.length) return null;

  const edge = pickVolleyballEdgeColor(list);
  return { text: bits.slice(0, 3).join(' '), color: edge || 'rgba(255,255,255,0.35)' };
}

registerSportLibraryBits(
  (sport: string) =>
    String(sport || '').toLowerCase() === 'volleyball:match' ||
    String(sport || '').toLowerCase().startsWith('volleyball'),

  ({ sidecar }: BuilderArgs) => {
    const events = (sidecar?.events ?? sidecar?.overlayEvents ?? sidecar?.data?.events ?? []) as AnyEvent[];
    const edgeColor = pickVolleyballEdgeColor(events);
    const badge = compactVolleyballBadge(events);

    return {
      edgeColor,
      badgeText: badge?.text ?? null,
      badgeColor: badge?.color ?? edgeColor ?? null,
      highlightGold: null,
    };
  },
);