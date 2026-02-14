import type { ClipSidecar } from '../../types';

export type BasketballStats = {
  sportKey: 'basketball:default';
  totals: { clips: number; events: number };

  // scoring
  points: { total: number };

  // shooting splits
  shooting: {
    fgM: number;
    fgA: number;
    t3M: number;
    t3A: number;
    ftM: number;
    ftA: number;
  };

  // other actions
  counts: {
    assist: number;
    steal: number;
    block: number;
    reboundOff: number;
    reboundDef: number;
    turnover: number;
    foul: number;
  };

  lastUpdatedAt: number;
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function readKey(e: any) {
  return String(e?.key ?? e?.kind ?? '').trim().toLowerCase();
}

// Your overlay uses meta.shotType: '2PT' | '3PT' | 'FT'
function readShotType(meta: any): '2PT' | '3PT' | 'FT' {
  const t = String(meta?.shotType ?? '').toUpperCase();
  if (t === '3PT' || t === '3' || t.includes('3')) return '3PT';
  if (t === 'FT' || t.includes('FT') || t.includes('FREE')) return 'FT';
  return '2PT';
}

export function reduceBasketballDefault(clips: ClipSidecar[]): BasketballStats {
  const base: BasketballStats = {
    sportKey: 'basketball:default',
    totals: { clips: clips.length, events: 0 },
    points: { total: 0 },
    shooting: {
      fgM: 0, fgA: 0,
      t3M: 0, t3A: 0,
      ftM: 0, ftA: 0,
    },
    counts: {
      assist: 0,
      steal: 0,
      block: 0,
      reboundOff: 0,
      reboundDef: 0,
      turnover: 0,
      foul: 0,
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

      if (key === 'shot') {
        const made = !!meta?.made;
        const st = readShotType(meta);

        if (st === 'FT') {
          base.shooting.ftA += 1;
          if (made) base.shooting.ftM += 1;
        } else {
          base.shooting.fgA += 1;
          if (made) base.shooting.fgM += 1;

          if (st === '3PT') {
            base.shooting.t3A += 1;
            if (made) base.shooting.t3M += 1;
          }
        }

        // your overlay sets value = points for makes, 0 for misses
        base.points.total += clamp0(e?.value);
        continue;
      }

      if (key === 'assist') { base.counts.assist += 1; continue; }
      if (key === 'steal') { base.counts.steal += 1; continue; }
      if (key === 'block') { base.counts.block += 1; continue; }
      if (key === 'turnover') { base.counts.turnover += 1; continue; }
      if (key === 'foul') { base.counts.foul += 1; continue; }

      if (key === 'rebound') {
        // overlay uses meta.rebound: 'off' | 'def'
        const r = String(meta?.rebound ?? meta?.kind ?? meta?.type ?? '').toLowerCase();
        if (r.startsWith('o')) base.counts.reboundOff += 1;
        else base.counts.reboundDef += 1;
        continue;
      }
    }
  }

  return base;
}
