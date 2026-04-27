// src/stats/reducers/wrestling/wrestlingFolkstyle.ts

import type { ClipSidecar } from '../../types';

type Bucket = 'myKid' | 'opp' | 'neutral';
type PeriodKey = 'p1' | 'p2' | 'p3' | 'ot';

type ActionSplit = { myKid: number; opp: number };

type PeriodStats = {
  takedown: ActionSplit;
  escape: ActionSplit;
  reversal: ActionSplit;
  nearfall: ActionSplit;
  pins: ActionSplit;
  myKidPoints: number;
  opponentPoints: number;
};

type PointBreakdown = {
  takedown: number;
  escape: number;
  reversal: number;
  nearfall: number;
  penalty: number;
  other: number;
};

type PeriodShare = {
  p1: number;
  p2: number;
  p3: number;
  ot: number;
};

export type FolkstyleStats = {
  sportKey: 'wrestling:folkstyle';
  totals: {
    clips: number;
    events: number;
  };
  scoring: {
    myKidPoints: number;
    opponentPoints: number;

    takedown: ActionSplit;
    escape: ActionSplit;
    reversal: ActionSplit;

    nearfall2: ActionSplit;
    nearfall3: ActionSplit;
    nearfall4: ActionSplit;

    stallingGiven: number;
    cautionGiven: number;
    penaltyGiven: number;
    pins: ActionSplit;
  };

  derived: {
    matches: number;

    myPointsPerMatch: number;
    opponentPointsPerMatch: number;

    takedownsPerMatch: number;
    escapesPerMatch: number;
    reversalsPerMatch: number;
    nearfallEventsPerMatch: number;

    pinRate: number;
    pinRateText: string;

    pointBreakdown: PointBreakdown;
    pointBreakdownPct: Record<keyof PointBreakdown, number>;

    // ✅ NEW: what % of athlete takedowns happened in each period
    takedownPeriodSharePct: PeriodShare;
  };

  periods: Record<PeriodKey, PeriodStats>;

  lastUpdatedAt: number;
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function round1(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function actorBucket(actor: any, homeIsAthlete: boolean | undefined): Bucket {
  if (actor !== 'home' && actor !== 'opponent') return 'neutral';

  const athleteIsHome = homeIsAthlete !== false;
  const isMyKid = athleteIsHome ? actor === 'home' : actor === 'opponent';

  return isMyKid ? 'myKid' : 'opp';
}

function makeSplit(): ActionSplit {
  return { myKid: 0, opp: 0 };
}

function makePeriodStats(): PeriodStats {
  return {
    takedown: makeSplit(),
    escape: makeSplit(),
    reversal: makeSplit(),
    nearfall: makeSplit(),
    pins: makeSplit(),
    myKidPoints: 0,
    opponentPoints: 0,
  };
}

function makePeriods(): Record<PeriodKey, PeriodStats> {
  return {
    p1: makePeriodStats(),
    p2: makePeriodStats(),
    p3: makePeriodStats(),
    ot: makePeriodStats(),
  };
}

function makePeriodShare(): PeriodShare {
  return { p1: 0, p2: 0, p3: 0, ot: 0 };
}

function addSplit(split: ActionSplit, bucket: Bucket, amount = 1) {
  if (bucket === 'myKid') split.myKid += amount;
  if (bucket === 'opp') split.opp += amount;
}

function readKind(e: any) {
  return String(e?.kind ?? e?.key ?? '').trim().toLowerCase();
}

function readMeta(e: any) {
  const meta = e?.meta ?? {};
  const inner = meta?.meta ?? {};
  return { ...inner, ...meta };
}

function readPeriodFromEvent(e: any): number | null {
  const meta = readMeta(e);

  const raw =
    meta?.period ??
    meta?.periodNumber ??
    e?.period ??
    e?.periodNumber ??
    null;

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);

  const label = String(meta?.label ?? e?.label ?? e?.kind ?? e?.key ?? '').trim();

  const m =
    label.match(/^p\s*(\d+)/i) ||
    label.match(/^period\s*(\d+)/i) ||
    label.match(/period\s*(\d+)/i);

  if (m?.[1]) {
    const p = Number(m[1]);
    if (Number.isFinite(p) && p > 0) return Math.floor(p);
  }

  return null;
}

function periodKeyFromNumber(n: number): PeriodKey {
  if (n <= 1) return 'p1';
  if (n === 2) return 'p2';
  if (n === 3) return 'p3';
  return 'ot';
}

function isPeriodMarker(kind: string, e: any) {
  if (kind === 'period') return true;
  if (kind.startsWith('period')) return true;
  if (/^p\d+$/i.test(String(e?.label ?? ''))) return true;
  return readPeriodFromEvent(e) != null && kind.includes('period');
}

function addPointBreakdown(breakdown: PointBreakdown, kind: string, points: number) {
  if (points <= 0) return;

  if (kind.startsWith('takedown')) breakdown.takedown += points;
  else if (kind.startsWith('escape')) breakdown.escape += points;
  else if (kind.startsWith('reversal')) breakdown.reversal += points;
  else if (kind.startsWith('nearfall')) breakdown.nearfall += points;
  else if (kind === 'stalling' || kind === 'caution' || kind === 'penalty') {
    breakdown.penalty += points;
  } else {
    breakdown.other += points;
  }
}

export function reduceWrestlingFolkstyle(clips: ClipSidecar[]): FolkstyleStats {
  const pointBreakdown: PointBreakdown = {
    takedown: 0,
    escape: 0,
    reversal: 0,
    nearfall: 0,
    penalty: 0,
    other: 0,
  };

  const base: FolkstyleStats = {
    sportKey: 'wrestling:folkstyle',
    totals: { clips: clips.length, events: 0 },
    scoring: {
      myKidPoints: 0,
      opponentPoints: 0,

      takedown: makeSplit(),
      escape: makeSplit(),
      reversal: makeSplit(),

      nearfall2: makeSplit(),
      nearfall3: makeSplit(),
      nearfall4: makeSplit(),

      stallingGiven: 0,
      cautionGiven: 0,
      penaltyGiven: 0,
      pins: makeSplit(),
    },
    derived: {
      matches: clips.length,

      myPointsPerMatch: 0,
      opponentPointsPerMatch: 0,

      takedownsPerMatch: 0,
      escapesPerMatch: 0,
      reversalsPerMatch: 0,
      nearfallEventsPerMatch: 0,

      pinRate: 0,
      pinRateText: '0%',

      pointBreakdown,
      pointBreakdownPct: {
        takedown: 0,
        escape: 0,
        reversal: 0,
        nearfall: 0,
        penalty: 0,
        other: 0,
      },

      takedownPeriodSharePct: makePeriodShare(),
    },
    periods: makePeriods(),
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = [...((clip as any).events ?? [])].sort(
      (a, b) => clamp0(a?.t) - clamp0(b?.t),
    );

    base.totals.events += events.length;

    const homeIsAthlete = (clip as any).homeIsAthlete as boolean | undefined;
    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    let currentPeriod: PeriodKey = 'p1';

    for (const e of events) {
      const kind = readKind(e);
      const points = clamp0(e?.points ?? e?.value);
      const bucket = actorBucket(e?.actor, homeIsAthlete);

      const periodNum = readPeriodFromEvent(e);

      // Period marker changes period for future events.
      // Everything before first period marker counts as P1.
      if (isPeriodMarker(kind, e) && periodNum != null) {
        currentPeriod = periodKeyFromNumber(periodNum);
        continue;
      }

      const period = base.periods[currentPeriod];

      if (bucket === 'myKid') {
        base.scoring.myKidPoints += points;
        period.myKidPoints += points;
        addPointBreakdown(pointBreakdown, kind, points);
      }

      if (bucket === 'opp') {
        base.scoring.opponentPoints += points;
        period.opponentPoints += points;
      }

      if (kind.startsWith('takedown')) {
        addSplit(base.scoring.takedown, bucket);
        addSplit(period.takedown, bucket);
        continue;
      }

      if (kind.startsWith('escape')) {
        addSplit(base.scoring.escape, bucket);
        addSplit(period.escape, bucket);
        continue;
      }

      if (kind.startsWith('reversal')) {
        addSplit(base.scoring.reversal, bucket);
        addSplit(period.reversal, bucket);
        continue;
      }

      if (kind.startsWith('nearfall')) {
        addSplit(period.nearfall, bucket);

        if (points === 2) addSplit(base.scoring.nearfall2, bucket);
        else if (points === 3) addSplit(base.scoring.nearfall3, bucket);
        else if (points === 4) addSplit(base.scoring.nearfall4, bucket);

        continue;
      }

      if (kind === 'stalling') {
        base.scoring.stallingGiven += points;
        continue;
      }

      if (kind === 'caution') {
        base.scoring.cautionGiven += points;
        continue;
      }

      if (kind === 'penalty') {
        base.scoring.penaltyGiven += points;
        continue;
      }

      if (kind === 'pin') {
        addSplit(base.scoring.pins, bucket);
        addSplit(period.pins, bucket);
        continue;
      }
    }
  }

  const matches = Math.max(1, clips.length);
  const nearfallTotal =
    base.scoring.nearfall2.myKid +
    base.scoring.nearfall3.myKid +
    base.scoring.nearfall4.myKid;

  base.derived.myPointsPerMatch = round1(base.scoring.myKidPoints / matches);
  base.derived.opponentPointsPerMatch = round1(base.scoring.opponentPoints / matches);

  base.derived.takedownsPerMatch = round1(base.scoring.takedown.myKid / matches);
  base.derived.escapesPerMatch = round1(base.scoring.escape.myKid / matches);
  base.derived.reversalsPerMatch = round1(base.scoring.reversal.myKid / matches);
  base.derived.nearfallEventsPerMatch = round1(nearfallTotal / matches);

  base.derived.pinRate = clips.length ? base.scoring.pins.myKid / clips.length : 0;
  base.derived.pinRateText = `${pct(base.scoring.pins.myKid, clips.length)}%`;

  const pointTotal =
    pointBreakdown.takedown +
    pointBreakdown.escape +
    pointBreakdown.reversal +
    pointBreakdown.nearfall +
    pointBreakdown.penalty +
    pointBreakdown.other;

  base.derived.pointBreakdownPct = {
    takedown: pct(pointBreakdown.takedown, pointTotal),
    escape: pct(pointBreakdown.escape, pointTotal),
    reversal: pct(pointBreakdown.reversal, pointTotal),
    nearfall: pct(pointBreakdown.nearfall, pointTotal),
    penalty: pct(pointBreakdown.penalty, pointTotal),
    other: pct(pointBreakdown.other, pointTotal),
  };

  const tdTotal = base.scoring.takedown.myKid;
  base.derived.takedownPeriodSharePct = {
    p1: pct(base.periods.p1.takedown.myKid, tdTotal),
    p2: pct(base.periods.p2.takedown.myKid, tdTotal),
    p3: pct(base.periods.p3.takedown.myKid, tdTotal),
    ot: pct(base.periods.ot.takedown.myKid, tdTotal),
  };

  return base;
}