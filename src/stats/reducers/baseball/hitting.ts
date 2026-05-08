import type { ClipSidecar } from '../../types';

export type BaseballHittingStats = {
  sportKey: 'baseball:hitting';
  totals: { clips: number; events: number };
  counts: {
    ball: number;
    strike: number;
    foul: number;
    walk: number;
    hitByPitch: number;
    hit: number;
    homerun: number;
    out: number;
    strikeout: number;

    rbi: {
      total: number;
      hit: number;
      homerun: number;
      walk: number;
      hitByPitch: number;
      out: number;
    };

    strikeTypes: { swinging: number; looking: number; unknown: number };
    hitTypes: { single: number; double: number; triple: number; bunt: number; unknown: number };
    outTypes: Record<string, number>;
    strikeoutTypes: { swinging: number; looking: number; unknown: number };
  };

  derived: {
    hits: number;
    atBats: number;
    plateAppearances: number;
    battingAverage: number;
    battingAverageText: string;
    onBasePct: number;
    onBasePctText: string;
    rbiPerClip: number;
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

function format3(n: number) {
  if (!Number.isFinite(n)) return '.000';
  const s = n.toFixed(3);
  return s.startsWith('0') ? s.slice(1) : s;
}

function readKind(meta: any) {
  const k = String(meta?.kind ?? meta?.type ?? '').trim().toLowerCase();
  if (k === 'swinging') return 'swinging';
  if (k === 'looking') return 'looking';
  return 'unknown';
}

function readMeta(e: any) {
  const meta = e?.meta ?? {};
  const inner = meta?.meta ?? {};
  return { ...inner, ...meta };
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
      hitByPitch: 0,
      hit: 0,
      homerun: 0,
      out: 0,
      strikeout: 0,

      rbi: {
        total: 0,
        hit: 0,
        homerun: 0,
        walk: 0,
        hitByPitch: 0,
        out: 0,
      },

      strikeTypes: { swinging: 0, looking: 0, unknown: 0 },
      hitTypes: { single: 0, double: 0, triple: 0, bunt: 0, unknown: 0 },
      outTypes: {},
      strikeoutTypes: { swinging: 0, looking: 0, unknown: 0 },
    },
    derived: {
      hits: 0,
      atBats: 0,
      plateAppearances: 0,
      battingAverage: 0,
      battingAverageText: '.000',
      onBasePct: 0,
      onBasePctText: '.000',
      rbiPerClip: 0,
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, clamp0((clip as any).createdAt));

    for (const e of events) {
      const key = readKey(e);
      const meta = readMeta(e);

      const rbi = clamp0(meta?.rbi);
      if (rbi > 0) {
        base.counts.rbi.total += rbi;

        if (key === 'hit') base.counts.rbi.hit += rbi;
        else if (key === 'homerun') base.counts.rbi.homerun += rbi;
        else if (key === 'walk') base.counts.rbi.walk += rbi;
        else if (key === 'hit_by_pitch') base.counts.rbi.hitByPitch += rbi;
        else if (key === 'out') base.counts.rbi.out += rbi;
      }

      if (key === 'ball') {
        base.counts.ball += 1;
      } else if (key === 'strike') {
        base.counts.strike += 1;
        const kind = readKind(meta);
        base.counts.strikeTypes[kind] += 1;
      } else if (key === 'foul') {
        base.counts.foul += 1;
      } else if (key === 'walk') {
        base.counts.walk += 1;
      } else if (key === 'hit_by_pitch') {
        base.counts.hitByPitch += 1;
      } else if (key === 'hit') {
        base.counts.hit += 1;

        const t = String(meta?.type ?? '').toLowerCase();
        if (t === 'single') base.counts.hitTypes.single += 1;
        else if (t === 'double') base.counts.hitTypes.double += 1;
        else if (t === 'triple') base.counts.hitTypes.triple += 1;
        else if (t === 'bunt') base.counts.hitTypes.bunt += 1;
        else base.counts.hitTypes.unknown += 1;
      } else if (key === 'homerun') {
        base.counts.homerun += 1;
      } else if (key === 'out') {
        base.counts.out += 1;
        const t = String(meta?.type ?? meta?.label ?? '').trim();
        if (t) base.counts.outTypes[t] = (base.counts.outTypes[t] ?? 0) + 1;
      } else if (key === 'strikeout') {
        base.counts.strikeout += 1;
        const kind = readKind(meta);
        base.counts.strikeoutTypes[kind] += 1;
      }
    }
  }

  const hitsTotal = base.counts.hit + base.counts.homerun;
  const atBats = hitsTotal + base.counts.out + base.counts.strikeout;
  const plateAppearances = atBats + base.counts.walk + base.counts.hitByPitch;

  const onBase = hitsTotal + base.counts.walk + base.counts.hitByPitch;

  base.derived.hits = hitsTotal;
  base.derived.atBats = atBats;
  base.derived.plateAppearances = plateAppearances;

  base.derived.battingAverage = atBats > 0 ? hitsTotal / atBats : 0;
  base.derived.battingAverageText = format3(base.derived.battingAverage);

  base.derived.onBasePct = plateAppearances > 0 ? onBase / plateAppearances : 0;
  base.derived.onBasePctText = format3(base.derived.onBasePct);

  base.derived.rbiPerClip =
    clips.length > 0 ? Math.round((base.counts.rbi.total / clips.length) * 10) / 10 : 0;

  return base;
}