import type { ClipSidecar } from '../../types';
import { reduceWrestlingFreestyle, type FreestyleStats } from './freestyle';

type ActionSplit = { myKid: number; opp: number };

export type GrecoStats = Omit<FreestyleStats, 'sportKey' | 'counts' | 'derived'> & {
  sportKey: 'wrestling:greco';
  counts: FreestyleStats['counts'] & {
    defLegFoulPlus2Given: ActionSplit;
    illegalLegAttackGiven: ActionSplit;
  };
  derived: FreestyleStats['derived'] & {
    grecoProfile: {
      turnsPerMatch: number;
      throwsPerMatch: number;
      stepOutsPerMatch: number;
      legFoulProblems: number;
      grecoBestArea: string;
    };
  };
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function round1(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function actorBucket(actor: any, homeIsAthlete?: boolean): 'myKid' | 'opp' | 'neutral' {
  if (actor !== 'home' && actor !== 'opponent') return 'neutral';

  const athleteIsHome = homeIsAthlete !== false;
  const isMyKid = athleteIsHome ? actor === 'home' : actor === 'opponent';

  return isMyKid ? 'myKid' : 'opp';
}

function addSplit(split: ActionSplit, bucket: 'myKid' | 'opp' | 'neutral') {
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

function bestGrecoArea(turns: number, throws: number, stepOuts: number) {
  const rows = [
    { label: 'Turns / exposure', value: turns },
    { label: 'Throws / amplitude', value: throws },
    { label: 'Step-outs', value: stepOuts },
  ].sort((a, b) => b.value - a.value);

  if (!rows[0] || rows[0].value <= 0) return 'No scoring yet';
  return rows[0].label;
}

export function reduceWrestlingGreco(clips: ClipSidecar[]): GrecoStats {
  const fs = reduceWrestlingFreestyle(clips);

  const base: GrecoStats = {
    ...fs,
    sportKey: 'wrestling:greco',
    counts: {
      ...fs.counts,
      defLegFoulPlus2Given: { myKid: 0, opp: 0 },
      illegalLegAttackGiven: { myKid: 0, opp: 0 },
    },
    derived: {
      ...fs.derived,
      grecoProfile: {
        turnsPerMatch: 0,
        throwsPerMatch: 0,
        stepOutsPerMatch: 0,
        legFoulProblems: 0,
        grecoBestArea: 'No scoring yet',
      },
    },
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    const homeIsAthlete = (clip as any).homeIsAthlete as boolean | undefined;

    for (const e of events) {
      const kind = readKind(e);
      const meta = readMeta(e);
      const points = clamp0(e?.value ?? e?.points);

      if (kind === 'def_leg_foul' && points === 2) {
        const offBucket = actorBucket(meta?.offender, homeIsAthlete);
        addSplit(base.counts.defLegFoulPlus2Given, offBucket);
        continue;
      }

      if (
        (kind === 'illegal_leg_attack' ||
          kind === 'leg_attack' ||
          kind === 'leg_foul') &&
        points > 0
      ) {
        const offBucket = actorBucket(meta?.offender, homeIsAthlete);
        addSplit(base.counts.illegalLegAttackGiven, offBucket);
        continue;
      }
    }
  }

  const matches = Math.max(1, clips.length);

  const turns = base.counts.exposure.myKid;
  const throws = base.counts.ga4.myKid + base.counts.ga5.myKid;
  const stepOuts = base.counts.out.myKid;

  const legFoulProblems =
    base.counts.defLegFoulPlus2Given.myKid +
    base.counts.illegalLegAttackGiven.myKid;

  base.derived.grecoProfile = {
    turnsPerMatch: round1(turns / matches),
    throwsPerMatch: round1(throws / matches),
    stepOutsPerMatch: round1(stepOuts / matches),
    legFoulProblems,
    grecoBestArea: bestGrecoArea(turns, throws, stepOuts),
  };

  return base;
}