import type { ClipSidecar } from '../../types';

export type BaseballHittingStats = {
  sportKey: 'baseball:hitting';
  totals: { clips: number; events: number };
  counts: {
    ball: number;
    strike: number;
    foul: number;
    walk: number;
    hit: number;
    homerun: number;
    out: number;
    strikeout: number;

    // Optional detail by type (if you store meta.type)
    hitTypes: { single: number; double: number; triple: number; bunt: number; unknown: number };
    outTypes: Record<string, number>; // e.g. "Fly Out", "Ground Out"
    strikeoutTypes: { swinging: number; looking: number; unknown: number };
  };
  lastUpdatedAt: number;
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : 0;
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function readKey(e: any) {
  return String(e?.key ?? e?.kind ?? '').trim().toLowerCase();
}

export function reduceBaseballHitting(clips: ClipSidecar[]): BaseballHittingStats {
  const base: BaseballHittingStats = {
    sportKey: 'baseball:hitting',
    totals: { clips: clips.length, events: 0 },
    counts: {
      ball: 0,
      strike: 0,
      foul: 0,
      walk: 0,
      hit: 0,
      homerun: 0,
      out: 0,
      strikeout: 0,

      hitTypes: { single: 0, double: 0, triple: 0, bunt: 0, unknown: 0 },
      outTypes: {},
      strikeoutTypes: { swinging: 0, looking: 0, unknown: 0 },
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    for (const e of events) {
      const key = readKey(e);
      const meta = (e?.meta ?? {}) as any;

      if (key === 'ball') base.counts.ball += 1;
      else if (key === 'strike') base.counts.strike += 1;
      else if (key === 'foul') base.counts.foul += 1;
      else if (key === 'walk') base.counts.walk += 1;
      else if (key === 'hit') {
        base.counts.hit += 1;

        // If you store meta.type = 'single'|'double'|'triple'|'bunt'
        const t = String(meta?.type ?? '').toLowerCase();
        if (t === 'single') base.counts.hitTypes.single += 1;
        else if (t === 'double') base.counts.hitTypes.double += 1;
        else if (t === 'triple') base.counts.hitTypes.triple += 1;
        else if (t === 'bunt') base.counts.hitTypes.bunt += 1;
        else base.counts.hitTypes.unknown += 1;
      } else if (key === 'homerun') base.counts.homerun += 1;
      else if (key === 'out') {
        base.counts.out += 1;
        // If you store meta.type as label like "Fly Out"
        const t = String(meta?.type ?? meta?.label ?? '').trim();
        if (t) base.counts.outTypes[t] = (base.counts.outTypes[t] ?? 0) + 1;
      } else if (key === 'strikeout') {
        base.counts.strikeout += 1;
        const kind = String(meta?.kind ?? '').toLowerCase();
        if (kind === 'swinging') base.counts.strikeoutTypes.swinging += 1;
        else if (kind === 'looking') base.counts.strikeoutTypes.looking += 1;
        else base.counts.strikeoutTypes.unknown += 1;
      }
    }
  }

  return base;
}
