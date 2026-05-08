import type { ClipSidecar } from '../../types';

type Bucket = 'myKid' | 'opp' | 'neutral';

type ActionSplit = {
  myKid: number;
  opp: number;
};

type PointBreakdown = {
  takedown: number;
  exposure: number;
  stepOut: number;
  feetToDanger: number;
  grandAmplitude: number;
  opponentPenalty: number;
  other: number;
};

type RecordStats = {
  wins: number;
  losses: number;
  ties: number;
  winPctText: string;
};

export type FreestyleStats = {
  sportKey: 'wrestling:freestyle';

  totals: {
    clips: number;
    events: number;
  };

  points: {
    myKid: number;
    opp: number;
  };

  counts: {
    takedown: ActionSplit;
    exposure: ActionSplit;
    out: ActionSplit;

    feetToDanger: ActionSplit;
    ga4: ActionSplit;
    ga5: ActionSplit;

    passWarn: ActionSplit;
    passPlus1Given: ActionSplit;
    penaltyPlus1Given: ActionSplit;
    fleePlus1Given: ActionSplit;
    fleePlus2Given: ActionSplit;
  };

  derived: {
    matches: number;

    record: RecordStats;

    myPointsPerMatch: number;
    opponentPointsPerMatch: number;

    takedownsPerMatch: number;
    exposurePerMatch: number;
    stepOutsPerMatch: number;
    feetToDangerPerMatch: number;
    grandAmplitudePerMatch: number;
    bigMovesPerMatch: number;

    technicalPointsCreated: number;
    technicalPointsAllowed: number;

    disciplineFlagsAgainstMyKid: number;
    disciplineFlagsAgainstOpponent: number;

    bestScoringAction: string;

    pointBreakdown: PointBreakdown;
    pointBreakdownPct: Record<keyof PointBreakdown, number>;
  };

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

function winPctText(wins: number, losses: number, ties: number) {
  const total = wins + losses + ties;
  if (!total) return '0%';
  return `${Math.round((wins / total) * 100)}%`;
}

function readResult(clip: any): 'win' | 'loss' | 'tie' | null {
  const raw =
    clip?.result ??
    clip?.matchResult ??
    clip?.outcome ??
    clip?.libraryStyle?.result ??
    clip?.metadata?.result ??
    null;

  const s = String(raw ?? '').trim().toLowerCase();

  if (['w', 'win', 'won', 'victory'].includes(s)) return 'win';
  if (['l', 'loss', 'lost', 'lose'].includes(s)) return 'loss';
  if (['t', 'tie', 'draw'].includes(s)) return 'tie';

  return null;
}

function makeSplit(): ActionSplit {
  return { myKid: 0, opp: 0 };
}

function addSplit(split: ActionSplit, bucket: Bucket, amount = 1) {
  if (bucket === 'myKid') split.myKid += amount;
  if (bucket === 'opp') split.opp += amount;
}

function actorBucket(actor: any, homeIsAthlete?: boolean): Bucket {
  if (actor !== 'home' && actor !== 'opponent') return 'neutral';

  const athleteIsHome = homeIsAthlete !== false;
  const isMyKid = athleteIsHome ? actor === 'home' : actor === 'opponent';

  return isMyKid ? 'myKid' : 'opp';
}

function readKind(e: any) {
  return String(e?.key ?? e?.kind ?? '').trim().toLowerCase();
}

function readMeta(e: any) {
  const meta = e?.meta ?? {};
  const inner = meta?.meta ?? {};
  return { ...inner, ...meta };
}

function addPointBreakdown(
  breakdown: PointBreakdown,
  kind: string,
  points: number,
) {
  if (points <= 0) return;

  if (kind === 'takedown') breakdown.takedown += points;
  else if (kind === 'exposure') breakdown.exposure += points;
  else if (kind === 'out') breakdown.stepOut += points;
  else if (kind === 'feet_to_danger') breakdown.feetToDanger += points;
  else if (kind === 'grand_amplitude') breakdown.grandAmplitude += points;
  else if (kind === 'passivity' || kind === 'penalty' || kind === 'flee') {
    breakdown.opponentPenalty += points;
  } else {
    breakdown.other += points;
  }
}

function bestActionFromBreakdown(breakdown: PointBreakdown) {
  const rows = [
    { label: 'Takedowns', value: breakdown.takedown },
    { label: 'Turns / exposure', value: breakdown.exposure },
    { label: 'Step-outs', value: breakdown.stepOut },
    { label: 'Feet to danger', value: breakdown.feetToDanger },
    { label: 'Big throws', value: breakdown.grandAmplitude },
    { label: 'Opponent penalties', value: breakdown.opponentPenalty },
    { label: 'Other', value: breakdown.other },
  ].sort((a, b) => b.value - a.value);

  if (!rows[0] || rows[0].value <= 0) return 'No scoring yet';

  return rows[0].label;
}

export function reduceWrestlingFreestyle(clips: ClipSidecar[]): FreestyleStats {
  const pointBreakdown: PointBreakdown = {
    takedown: 0,
    exposure: 0,
    stepOut: 0,
    feetToDanger: 0,
    grandAmplitude: 0,
    opponentPenalty: 0,
    other: 0,
  };

  const base: FreestyleStats = {
    sportKey: 'wrestling:freestyle',
    totals: { clips: clips.length, events: 0 },
    points: { myKid: 0, opp: 0 },
    counts: {
      takedown: makeSplit(),
      exposure: makeSplit(),
      out: makeSplit(),
      feetToDanger: makeSplit(),
      ga4: makeSplit(),
      ga5: makeSplit(),
      passWarn: makeSplit(),
      passPlus1Given: makeSplit(),
      penaltyPlus1Given: makeSplit(),
      fleePlus1Given: makeSplit(),
      fleePlus2Given: makeSplit(),
    },
    derived: {
      matches: clips.length,
      record: {
        wins: 0,
        losses: 0,
        ties: 0,
        winPctText: '0%',
      },
      myPointsPerMatch: 0,
      opponentPointsPerMatch: 0,
      takedownsPerMatch: 0,
      exposurePerMatch: 0,
      stepOutsPerMatch: 0,
      feetToDangerPerMatch: 0,
      grandAmplitudePerMatch: 0,
      bigMovesPerMatch: 0,
      technicalPointsCreated: 0,
      technicalPointsAllowed: 0,
      disciplineFlagsAgainstMyKid: 0,
      disciplineFlagsAgainstOpponent: 0,
      bestScoringAction: 'No scoring yet',
      pointBreakdown,
      pointBreakdownPct: {
        takedown: 0,
        exposure: 0,
        stepOut: 0,
        feetToDanger: 0,
        grandAmplitude: 0,
        opponentPenalty: 0,
        other: 0,
      },
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    const result = readResult(clip as any);
    if (result === 'win') base.derived.record.wins += 1;
    if (result === 'loss') base.derived.record.losses += 1;
    if (result === 'tie') base.derived.record.ties += 1;

    const homeIsAthlete = (clip as any).homeIsAthlete as boolean | undefined;
    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    for (const e of events) {
      const kind = readKind(e);
      const meta = readMeta(e);
      const points = clamp0(e?.value ?? e?.points);
      const bucket = actorBucket(e?.actor, homeIsAthlete);

      if (bucket === 'myKid') {
        base.points.myKid += points;
        addPointBreakdown(pointBreakdown, kind, points);
      }

      if (bucket === 'opp') {
        base.points.opp += points;
      }

      if (kind === 'takedown') {
        addSplit(base.counts.takedown, bucket);
        continue;
      }

      if (kind === 'exposure') {
        addSplit(base.counts.exposure, bucket);
        continue;
      }

      if (kind === 'out') {
        addSplit(base.counts.out, bucket);
        continue;
      }

      if (kind === 'feet_to_danger') {
        addSplit(base.counts.feetToDanger, bucket);
        continue;
      }

      if (kind === 'grand_amplitude') {
        if (points === 4) addSplit(base.counts.ga4, bucket);
        else if (points === 5) addSplit(base.counts.ga5, bucket);
        else if (points >= 4) addSplit(base.counts.ga4, bucket);
        continue;
      }

      if (kind === 'passivity') {
        const offenderBucket = actorBucket(meta?.offender, homeIsAthlete);
        const label = String(e?.label ?? meta?.label ?? '').toUpperCase();

        if (label.includes('WARN') || points === 0) {
          addSplit(base.counts.passWarn, offenderBucket);
        } else if (points === 1) {
          addSplit(base.counts.passPlus1Given, offenderBucket);
        }

        continue;
      }

      if (kind === 'penalty') {
        const offenderBucket = actorBucket(meta?.offender, homeIsAthlete);
        if (points === 1) addSplit(base.counts.penaltyPlus1Given, offenderBucket);
        continue;
      }

      if (kind === 'flee') {
        const offenderBucket = actorBucket(meta?.offender, homeIsAthlete);

        if (points === 1) addSplit(base.counts.fleePlus1Given, offenderBucket);
        else if (points === 2) addSplit(base.counts.fleePlus2Given, offenderBucket);

        continue;
      }
    }
  }

  const matches = Math.max(1, clips.length);

  const gaTotalMyKid = base.counts.ga4.myKid + base.counts.ga5.myKid;

  const disciplineAgainstMyKid =
    base.counts.passWarn.myKid +
    base.counts.passPlus1Given.myKid +
    base.counts.penaltyPlus1Given.myKid +
    base.counts.fleePlus1Given.myKid +
    base.counts.fleePlus2Given.myKid;

  const disciplineAgainstOpponent =
    base.counts.passWarn.opp +
    base.counts.passPlus1Given.opp +
    base.counts.penaltyPlus1Given.opp +
    base.counts.fleePlus1Given.opp +
    base.counts.fleePlus2Given.opp;

  base.derived.record.winPctText = winPctText(
    base.derived.record.wins,
    base.derived.record.losses,
    base.derived.record.ties,
  );

  base.derived.myPointsPerMatch = round1(base.points.myKid / matches);
  base.derived.opponentPointsPerMatch = round1(base.points.opp / matches);

  base.derived.takedownsPerMatch = round1(base.counts.takedown.myKid / matches);
  base.derived.exposurePerMatch = round1(base.counts.exposure.myKid / matches);
  base.derived.stepOutsPerMatch = round1(base.counts.out.myKid / matches);
  base.derived.feetToDangerPerMatch = round1(base.counts.feetToDanger.myKid / matches);
  base.derived.grandAmplitudePerMatch = round1(gaTotalMyKid / matches);
  base.derived.bigMovesPerMatch = round1(
    (base.counts.feetToDanger.myKid + gaTotalMyKid) / matches,
  );

  base.derived.technicalPointsCreated =
    pointBreakdown.takedown +
    pointBreakdown.exposure +
    pointBreakdown.stepOut +
    pointBreakdown.feetToDanger +
    pointBreakdown.grandAmplitude;

  base.derived.technicalPointsAllowed = base.points.opp;

  base.derived.disciplineFlagsAgainstMyKid = disciplineAgainstMyKid;
  base.derived.disciplineFlagsAgainstOpponent = disciplineAgainstOpponent;

  base.derived.bestScoringAction = bestActionFromBreakdown(pointBreakdown);

  const pointTotal =
    pointBreakdown.takedown +
    pointBreakdown.exposure +
    pointBreakdown.stepOut +
    pointBreakdown.feetToDanger +
    pointBreakdown.grandAmplitude +
    pointBreakdown.opponentPenalty +
    pointBreakdown.other;

  base.derived.pointBreakdownPct = {
    takedown: pct(pointBreakdown.takedown, pointTotal),
    exposure: pct(pointBreakdown.exposure, pointTotal),
    stepOut: pct(pointBreakdown.stepOut, pointTotal),
    feetToDanger: pct(pointBreakdown.feetToDanger, pointTotal),
    grandAmplitude: pct(pointBreakdown.grandAmplitude, pointTotal),
    opponentPenalty: pct(pointBreakdown.opponentPenalty, pointTotal),
    other: pct(pointBreakdown.other, pointTotal),
  };

  return base;
}