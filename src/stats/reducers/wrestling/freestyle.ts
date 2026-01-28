import type { ClipSidecar } from '../../types';

export type FreestyleStats = {
  sportKey: 'wrestling:freestyle';
  totals: { clips: number; events: number };
  points: { myKid: number; opp: number };

  // counts for common freestyle buttons
  counts: {
    takedown: { myKid: number; opp: number };  // TD2
    exposure: { myKid: number; opp: number };  // EX2
    out: { myKid: number; opp: number };       // OB1

    feetToDanger: { myKid: number; opp: number }; // FTD4
    ga4: { myKid: number; opp: number };
    ga5: { myKid: number; opp: number };

    passWarn: { myKid: number; opp: number };
    passPlus1Given: { myKid: number; opp: number }; // offender got +1 awarded to opponent
    penaltyPlus1Given: { myKid: number; opp: number };
    fleePlus1Given: { myKid: number; opp: number };
    fleePlus2Given: { myKid: number; opp: number };
  };

  lastUpdatedAt: number;
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

// Some events in your overlay award points to the *receiver* (not the offender).
// Those events often store offender inside meta.offender.
function offenderBucket(offenderActor: any, homeIsAthlete?: boolean): 'myKid' | 'opp' | 'neutral' {
  return actorBucket(offenderActor, homeIsAthlete);
}

export function reduceWrestlingFreestyle(clips: ClipSidecar[]): FreestyleStats {
  const base: FreestyleStats = {
    sportKey: 'wrestling:freestyle',
    totals: { clips: clips.length, events: 0 },
    points: { myKid: 0, opp: 0 },
    counts: {
      takedown: { myKid: 0, opp: 0 },
      exposure: { myKid: 0, opp: 0 },
      out: { myKid: 0, opp: 0 },

      feetToDanger: { myKid: 0, opp: 0 },
      ga4: { myKid: 0, opp: 0 },
      ga5: { myKid: 0, opp: 0 },

      passWarn: { myKid: 0, opp: 0 },
      passPlus1Given: { myKid: 0, opp: 0 },
      penaltyPlus1Given: { myKid: 0, opp: 0 },
      fleePlus1Given: { myKid: 0, opp: 0 },
      fleePlus2Given: { myKid: 0, opp: 0 },
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    const homeIsAthlete = (clip as any).homeIsAthlete as boolean | undefined;
    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    for (const e of events) {
      const key = String(e?.key ?? e?.kind ?? '').toLowerCase();
      const points = clamp0(e?.value ?? e?.points);
      const bucket = actorBucket(e?.actor, homeIsAthlete);

      // points: normal scoring events are attributed to actor
      if (bucket === 'myKid') base.points.myKid += points;
      if (bucket === 'opp') base.points.opp += points;

      // counts by key
      if (key === 'takedown') {
        if (bucket === 'myKid') base.counts.takedown.myKid += 1;
        if (bucket === 'opp') base.counts.takedown.opp += 1;
        continue;
      }

      if (key === 'exposure') {
        if (bucket === 'myKid') base.counts.exposure.myKid += 1;
        if (bucket === 'opp') base.counts.exposure.opp += 1;
        continue;
      }

      if (key === 'out') {
        if (bucket === 'myKid') base.counts.out.myKid += 1;
        if (bucket === 'opp') base.counts.out.opp += 1;
        continue;
      }

      if (key === 'feet_to_danger') {
        if (bucket === 'myKid') base.counts.feetToDanger.myKid += 1;
        if (bucket === 'opp') base.counts.feetToDanger.opp += 1;
        continue;
      }

      if (key === 'grand_amplitude') {
        if (points === 4) {
          if (bucket === 'myKid') base.counts.ga4.myKid += 1;
          if (bucket === 'opp') base.counts.ga4.opp += 1;
        } else if (points === 5) {
          if (bucket === 'myKid') base.counts.ga5.myKid += 1;
          if (bucket === 'opp') base.counts.ga5.opp += 1;
        }
        continue;
      }

      // passivity/penalty/flee: your overlay stores offender in meta.offender and awards points to receiver
      if (key === 'passivity') {
        const offender = e?.meta?.offender;
        const offBucket = offenderBucket(offender, homeIsAthlete);

        if (String(e?.label ?? '').toUpperCase().includes('WARN')) {
          if (offBucket === 'myKid') base.counts.passWarn.myKid += 1;
          if (offBucket === 'opp') base.counts.passWarn.opp += 1;
        } else if (points === 1) {
          if (offBucket === 'myKid') base.counts.passPlus1Given.myKid += 1;
          if (offBucket === 'opp') base.counts.passPlus1Given.opp += 1;
        }
        continue;
      }

      if (key === 'penalty') {
        const offender = e?.meta?.offender;
        const offBucket = offenderBucket(offender, homeIsAthlete);
        if (points === 1) {
          if (offBucket === 'myKid') base.counts.penaltyPlus1Given.myKid += 1;
          if (offBucket === 'opp') base.counts.penaltyPlus1Given.opp += 1;
        }
        continue;
      }

      if (key === 'flee') {
        const offender = e?.meta?.offender;
        const offBucket = offenderBucket(offender, homeIsAthlete);
        if (points === 1) {
          if (offBucket === 'myKid') base.counts.fleePlus1Given.myKid += 1;
          if (offBucket === 'opp') base.counts.fleePlus1Given.opp += 1;
        } else if (points === 2) {
          if (offBucket === 'myKid') base.counts.fleePlus2Given.myKid += 1;
          if (offBucket === 'opp') base.counts.fleePlus2Given.opp += 1;
        }
        continue;
      }
    }
  }

  return base;
}
