import type { ClipSidecar } from '../../types';

export type BasketballStats = {
  sportKey: 'basketball:default';
  totals: { clips: number; events: number };

  points: {
    total: number;
  };

  bestClip: {
    points: number;
  };

  shooting: {
    fgM: number;
    fgA: number;
    t2M: number;
    t2A: number;
    t3M: number;
    t3A: number;
    ftM: number;
    ftA: number;
  };

  counts: {
    assist: number;
    pass: number;
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

function readShotType(meta: any): '2PT' | '3PT' | 'FT' {
  const t = String(meta?.shotType ?? '').trim().toUpperCase();

  if (t === '3PT' || t === '3') return '3PT';
  if (t === 'FT' || t === 'FREE' || t === 'FREE THROW') return 'FT';

  return '2PT';
}

function pointsForShot(st: '2PT' | '3PT' | 'FT') {
  if (st === '3PT') return 3;
  if (st === 'FT') return 1;
  return 2;
}

export function reduceBasketballDefault(clips: ClipSidecar[]): BasketballStats {
  const base: BasketballStats = {
    sportKey: 'basketball:default',
    totals: { clips: clips.length, events: 0 },

    points: { total: 0 },
    bestClip: { points: 0 },

    shooting: {
      fgM: 0,
      fgA: 0,
      t2M: 0,
      t2A: 0,
      t3M: 0,
      t3A: 0,
      ftM: 0,
      ftA: 0,
    },

    counts: {
      assist: 0,
      pass: 0,
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
    const events: any[] = Array.isArray((clip as any)?.events)
      ? (clip as any).events
      : [];

    let clipPoints = 0;

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
        } else if (st === '3PT') {
          base.shooting.fgA += 1;
          base.shooting.t3A += 1;

          if (made) {
            base.shooting.fgM += 1;
            base.shooting.t3M += 1;
          }
        } else {
          base.shooting.fgA += 1;
          base.shooting.t2A += 1;

          if (made) {
            base.shooting.fgM += 1;
            base.shooting.t2M += 1;
          }
        }

        if (made) {
          const eventValue = clamp0(e?.value);
          const shotPoints = eventValue > 0 ? eventValue : pointsForShot(st);

          base.points.total += shotPoints;
          clipPoints += shotPoints;
        }

        continue;
      }

      if (key === 'assist') {
        base.counts.assist += 1;
        continue;
      }

      if (key === 'pass') {
        base.counts.pass += 1;
        continue;
      }

      if (key === 'steal') {
        base.counts.steal += 1;
        continue;
      }

      if (key === 'block') {
        base.counts.block += 1;
        continue;
      }

      if (key === 'turnover') {
        base.counts.turnover += 1;
        continue;
      }

      if (key === 'foul') {
        base.counts.foul += 1;
        continue;
      }

      if (key === 'rebound') {
        const r = String(meta?.rebound ?? meta?.kind ?? meta?.type ?? '').toLowerCase();

        if (r.startsWith('o')) base.counts.reboundOff += 1;
        else base.counts.reboundDef += 1;

        continue;
      }
    }

    base.bestClip.points = Math.max(base.bestClip.points, clipPoints);
  }

  return base;
}