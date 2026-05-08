
import type { ClipSidecar } from '../../types';

type Bucket = 'myKid' | 'opp' | 'neutral';
type Split = { myKid: number; opp: number };

export type BjjStats = {
  sportKey: 'bjj:default' | 'bjj:gi' | 'bjj:nogi';
  totals: {
    clips: number;
    events: number;
  };
  points: {
    myKid: number;
    opp: number;
  };
  counts: {
    takedown: Split;
    sweep: Split;
    kneeOnBelly: Split;
    guardPass: Split;
    mount: Split;
    backControl: Split;
    advantage: Split;
    penaltyGiven: Split;
    finish: Split;
  };
  derived: {
    matches: number;
    record: {
      wins: number;
      losses: number;
      ties: number;
      winPctText: string;
    };
    pointsPerMatch: number;
    opponentPointsPerMatch: number;
    takedownsPerMatch: number;
    sweepsPerMatch: number;
    passesPerMatch: number;
    dominantPositionsPerMatch: number;
    finishRateText: string;
    bestScoringAction: string;
    pointBreakdown: {
      takedown: number;
      sweep: number;
      kneeOnBelly: number;
      guardPass: number;
      mount: number;
      backControl: number;
      penalty: number;
      other: number;
    };
    pointBreakdownPct: Record<string, number>;
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

function makeSplit(): Split {
  return { myKid: 0, opp: 0 };
}

function actorBucket(actor: any, homeIsAthlete?: boolean): Bucket {
  if (actor !== 'home' && actor !== 'opponent') return 'neutral';
  const athleteIsHome = homeIsAthlete !== false;
  const isMyKid = athleteIsHome ? actor === 'home' : actor === 'opponent';
  return isMyKid ? 'myKid' : 'opp';
}

function addSplit(split: Split, bucket: Bucket) {
  if (bucket === 'myKid') split.myKid += 1;
  if (bucket === 'opp') split.opp += 1;
}

function readKind(e: any) {
  return String(e?.key ?? e?.kind ?? '').trim().toLowerCase();
}

function readMeta(e: any) {
  const meta = e?.meta ?? {};
  const inner = meta?.meta ?? {};
  return { ...inner, ...meta };
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

function winPctText(wins: number, losses: number, ties: number) {
  const total = wins + losses + ties;
  if (!total) return '0%';
  return `${Math.round((wins / total) * 100)}%`;
}

function bestAction(breakdown: BjjStats['derived']['pointBreakdown']) {
  const rows = [
    { label: 'Takedowns', value: breakdown.takedown },
    { label: 'Sweeps', value: breakdown.sweep },
    { label: 'Guard passes', value: breakdown.guardPass },
    { label: 'Mount', value: breakdown.mount },
    { label: 'Back control', value: breakdown.backControl },
    { label: 'Knee on belly', value: breakdown.kneeOnBelly },
  ].sort((a, b) => b.value - a.value);

  if (!rows[0] || rows[0].value <= 0) return 'No scoring yet';
  return rows[0].label;
}

export function reduceBjjDefault(clips: ClipSidecar[]): BjjStats {
  const breakdown: BjjStats['derived']['pointBreakdown'] = {
    takedown: 0,
    sweep: 0,
    kneeOnBelly: 0,
    guardPass: 0,
    mount: 0,
    backControl: 0,
    penalty: 0,
    other: 0,
  };

  const base: BjjStats = {
    sportKey: 'bjj:default',
    totals: { clips: clips.length, events: 0 },
    points: { myKid: 0, opp: 0 },
    counts: {
      takedown: makeSplit(),
      sweep: makeSplit(),
      kneeOnBelly: makeSplit(),
      guardPass: makeSplit(),
      mount: makeSplit(),
      backControl: makeSplit(),
      advantage: makeSplit(),
      penaltyGiven: makeSplit(),
      finish: makeSplit(),
    },
    derived: {
      matches: clips.length,
      record: {
        wins: 0,
        losses: 0,
        ties: 0,
        winPctText: '0%',
      },
      pointsPerMatch: 0,
      opponentPointsPerMatch: 0,
      takedownsPerMatch: 0,
      sweepsPerMatch: 0,
      passesPerMatch: 0,
      dominantPositionsPerMatch: 0,
      finishRateText: '0%',
      bestScoringAction: 'No scoring yet',
      pointBreakdown: breakdown,
      pointBreakdownPct: {
        takedown: 0,
        sweep: 0,
        kneeOnBelly: 0,
        guardPass: 0,
        mount: 0,
        backControl: 0,
        penalty: 0,
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
      const bucket = actorBucket(e?.actor, homeIsAthlete);
      const offenderBucket = actorBucket(meta?.offender, homeIsAthlete);
      const points = clamp0(e?.value ?? e?.points ?? meta?.points);

      if (bucket === 'myKid') base.points.myKid += points;
      if (bucket === 'opp') base.points.opp += points;

      const addBreakdown = (key: keyof typeof breakdown) => {
        if (bucket === 'myKid') breakdown[key] += points;
      };

      if (kind === 'takedown') {
        addSplit(base.counts.takedown, bucket);
        addBreakdown('takedown');
        continue;
      }

      if (kind === 'sweep') {
        addSplit(base.counts.sweep, bucket);
        addBreakdown('sweep');
        continue;
      }

      if (kind === 'knee_on_belly') {
        addSplit(base.counts.kneeOnBelly, bucket);
        addBreakdown('kneeOnBelly');
        continue;
      }

      if (kind === 'guard_pass') {
        addSplit(base.counts.guardPass, bucket);
        addBreakdown('guardPass');
        continue;
      }

      if (kind === 'mount') {
        addSplit(base.counts.mount, bucket);
        addBreakdown('mount');
        continue;
      }

      if (kind === 'back_control') {
        addSplit(base.counts.backControl, bucket);
        addBreakdown('backControl');
        continue;
      }

      if (kind === 'advantage') {
        addSplit(base.counts.advantage, bucket);
        continue;
      }

      if (kind === 'penalty') {
        addSplit(base.counts.penaltyGiven, offenderBucket);
        if (bucket === 'myKid') breakdown.penalty += points;
        continue;
      }

      if (kind === 'finish') {
        addSplit(base.counts.finish, bucket);
        continue;
      }

      if (bucket === 'myKid') breakdown.other += points;
    }
  }

  const matches = Math.max(1, clips.length);

  const dominantPositions =
    base.counts.kneeOnBelly.myKid +
    base.counts.mount.myKid +
    base.counts.backControl.myKid;

  base.derived.record.winPctText = winPctText(
    base.derived.record.wins,
    base.derived.record.losses,
    base.derived.record.ties,
  );

  base.derived.pointsPerMatch = round1(base.points.myKid / matches);
  base.derived.opponentPointsPerMatch = round1(base.points.opp / matches);
  base.derived.takedownsPerMatch = round1(base.counts.takedown.myKid / matches);
  base.derived.sweepsPerMatch = round1(base.counts.sweep.myKid / matches);
  base.derived.passesPerMatch = round1(base.counts.guardPass.myKid / matches);
  base.derived.dominantPositionsPerMatch = round1(dominantPositions / matches);
  base.derived.finishRateText = `${pct(base.counts.finish.myKid, clips.length)}%`;
  base.derived.bestScoringAction = bestAction(breakdown);

  const total =
    breakdown.takedown +
    breakdown.sweep +
    breakdown.kneeOnBelly +
    breakdown.guardPass +
    breakdown.mount +
    breakdown.backControl +
    breakdown.penalty +
    breakdown.other;

  base.derived.pointBreakdownPct = {
    takedown: pct(breakdown.takedown, total),
    sweep: pct(breakdown.sweep, total),
    kneeOnBelly: pct(breakdown.kneeOnBelly, total),
    guardPass: pct(breakdown.guardPass, total),
    mount: pct(breakdown.mount, total),
    backControl: pct(breakdown.backControl, total),
    penalty: pct(breakdown.penalty, total),
    other: pct(breakdown.other, total),
  };

  return base;
}

export const reduceBjjGi = reduceBjjDefault;
export const reduceBjjNoGi = reduceBjjDefault;