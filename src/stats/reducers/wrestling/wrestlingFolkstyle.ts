// src/stats/reducers/wrestlingFolkstyle.ts

import type { ClipSidecar } from '../../types';

type FolkstyleStats = {
  sportKey: 'wrestling:folkstyle';
  totals: {
    clips: number;
    events: number;
  };
  scoring: {
    myKidPoints: number;
    opponentPoints: number;

    takedown: { myKid: number; opp: number };
    escape: { myKid: number; opp: number };
    reversal: { myKid: number; opp: number };

    nearfall2: { myKid: number; opp: number };
    nearfall3: { myKid: number; opp: number };
    nearfall4: { myKid: number; opp: number };

    stallingGiven: number; // points awarded to opponent from "stalling +1/+2"
    cautionGiven: number;  // points awarded to opponent from "caution +1"
    penaltyGiven: number;  // future-proof
    pins: { myKid: number; opp: number };
  };
  lastUpdatedAt: number;
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : 0;
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function actorBucket(
  actor: any,
  homeIsAthlete: boolean | undefined,
): 'myKid' | 'opp' | 'neutral' {
  if (actor !== 'home' && actor !== 'opponent') return 'neutral';
  const isMyKid = homeIsAthlete ? actor === 'home' : actor === 'opponent';
  return isMyKid ? 'myKid' : 'opp';
}

export function reduceWrestlingFolkstyle(clips: ClipSidecar[]): FolkstyleStats {
  const base: FolkstyleStats = {
    sportKey: 'wrestling:folkstyle',
    totals: { clips: clips.length, events: 0 },
    scoring: {
      myKidPoints: 0,
      opponentPoints: 0,

      takedown: { myKid: 0, opp: 0 },
      escape: { myKid: 0, opp: 0 },
      reversal: { myKid: 0, opp: 0 },

      nearfall2: { myKid: 0, opp: 0 },
      nearfall3: { myKid: 0, opp: 0 },
      nearfall4: { myKid: 0, opp: 0 },

      stallingGiven: 0,
      cautionGiven: 0,
      penaltyGiven: 0,
      pins: { myKid: 0, opp: 0 },
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    // most reliable “which actor is athlete” is clip.homeIsAthlete
    const homeIsAthlete = (clip as any).homeIsAthlete as boolean | undefined;

    // last updated: use clip.createdAt if present, else 0
    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    for (const e of events) {
      const kind = String(e?.kind ?? e?.key ?? '').toLowerCase();
      const points = clamp0(e?.points ?? e?.value);

      // Score totals (only if this event actually has points + is attributed)
      const bucket = actorBucket(e?.actor, homeIsAthlete);
      if (bucket === 'myKid') base.scoring.myKidPoints += points;
      if (bucket === 'opp') base.scoring.opponentPoints += points;

      // Count key types
      if (kind.startsWith('takedown')) {
        if (bucket === 'myKid') base.scoring.takedown.myKid += 1;
        if (bucket === 'opp') base.scoring.takedown.opp += 1;
        continue;
      }

      if (kind.startsWith('escape')) {
        if (bucket === 'myKid') base.scoring.escape.myKid += 1;
        if (bucket === 'opp') base.scoring.escape.opp += 1;
        continue;
      }

      if (kind.startsWith('reversal')) {
        if (bucket === 'myKid') base.scoring.reversal.myKid += 1;
        if (bucket === 'opp') base.scoring.reversal.opp += 1;
        continue;
      }

      // Nearfall: your overlay uses key "nearfall" and points 2/3/4
      if (kind.startsWith('nearfall')) {
        if (points === 2) {
          if (bucket === 'myKid') base.scoring.nearfall2.myKid += 1;
          if (bucket === 'opp') base.scoring.nearfall2.opp += 1;
        } else if (points === 3) {
          if (bucket === 'myKid') base.scoring.nearfall3.myKid += 1;
          if (bucket === 'opp') base.scoring.nearfall3.opp += 1;
        } else if (points === 4) {
          if (bucket === 'myKid') base.scoring.nearfall4.myKid += 1;
          if (bucket === 'opp') base.scoring.nearfall4.opp += 1;
        }
        continue;
      }

      // Stalling / Caution: in your overlay, you sometimes award points to receiverActor
      if (kind === 'stalling') {
        // points here are "given" to someone
        base.scoring.stallingGiven += points;
        continue;
      }
      if (kind === 'caution') {
        base.scoring.cautionGiven += points;
        continue;
      }

      if (kind === 'pin') {
        if (bucket === 'myKid') base.scoring.pins.myKid += 1;
        if (bucket === 'opp') base.scoring.pins.opp += 1;
        continue;
      }
    }
  }

  return base;
}
