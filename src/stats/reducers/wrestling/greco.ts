import type { ClipSidecar } from '../../types';
import { reduceWrestlingFreestyle, type FreestyleStats } from './freestyle';

export type GrecoStats = Omit<FreestyleStats, 'sportKey'> & {
  sportKey: 'wrestling:greco';
  counts: FreestyleStats['counts'] & {
    defLegFoulPlus2Given: { myKid: number; opp: number };
  };
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : 0;
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function actorBucket(actor: any, homeIsAthlete?: boolean): 'myKid' | 'opp' | 'neutral' {
  if (actor !== 'home' && actor !== 'opponent') return 'neutral';
  const isMyKid = homeIsAthlete ? actor === 'home' : actor === 'opponent';
  return isMyKid ? 'myKid' : 'opp';
}

function offenderBucket(offenderActor: any, homeIsAthlete?: boolean): 'myKid' | 'opp' | 'neutral' {
  return actorBucket(offenderActor, homeIsAthlete);
}

export function reduceWrestlingGreco(clips: ClipSidecar[]): GrecoStats {
  const fs = reduceWrestlingFreestyle(clips);

  const base: GrecoStats = {
    ...fs,
    sportKey: 'wrestling:greco',
    counts: {
      ...fs.counts,
      defLegFoulPlus2Given: { myKid: 0, opp: 0 },
    },
  };

  // add greco-only scan
  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    const homeIsAthlete = (clip as any).homeIsAthlete as boolean | undefined;

    for (const e of events) {
      const key = String(e?.key ?? e?.kind ?? '').toLowerCase();
      const points = clamp0(e?.value ?? e?.points);

      if (key === 'def_leg_foul' && points === 2) {
        const offender = e?.meta?.offender;
        const offBucket = offenderBucket(offender, homeIsAthlete);
        if (offBucket === 'myKid') base.counts.defLegFoulPlus2Given.myKid += 1;
        if (offBucket === 'opp') base.counts.defLegFoulPlus2Given.opp += 1;
      }
    }
  }

  return base;
}
