// src/stats/reducers/bjj/default.ts
import type { ClipSidecar } from '../../types';

export type BjjDefaultStats = {
  sportKey: 'bjj:default' | 'bjj:gi' | 'bjj:nogi';
  totals: { clips: number; events: number };

  counts: {
    takedown: number;
    sweep: number;
    knee_on_belly: number;
    guard_pass: number;
    mount: number;
    back_control: number;

    advantage: number;
    penalty: number;

    finish: number; // submission button
  };

  derived: {
    scoreForAthleteText: string; // just "X pts"
    scoreForOpponentText: string;
    finishesText: string; // "N"
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

function isGiClip(clip: any) {
  const style = String(clip?.style ?? '').trim().toLowerCase();
  return style === 'gi';
}
function isNoGiClip(clip: any) {
  const style = String(clip?.style ?? '').trim().toLowerCase();
  return style === 'nogi' || style === 'no-gi' || style === 'no_gi';
}

export function reduceBjjDefault(clips: ClipSidecar[]): BjjDefaultStats {
  // Pick the “most correct” sportKey label for this reducer output:
  // If all clips are gi -> bjj:gi, if all nogi -> bjj:nogi, else bjj:default
  const allGi = clips.length > 0 && clips.every(isGiClip);
  const allNoGi = clips.length > 0 && clips.every(isNoGiClip);
  const sportKey: BjjDefaultStats['sportKey'] = allGi ? 'bjj:gi' : allNoGi ? 'bjj:nogi' : 'bjj:default';

  const base: BjjDefaultStats = {
    sportKey,
    totals: { clips: clips.length, events: 0 },
    counts: {
      takedown: 0,
      sweep: 0,
      knee_on_belly: 0,
      guard_pass: 0,
      mount: 0,
      back_control: 0,
      advantage: 0,
      penalty: 0,
      finish: 0,
    },
    derived: {
      scoreForAthleteText: '0 pts',
      scoreForOpponentText: '0 pts',
      finishesText: '0',
    },
    lastUpdatedAt: 0,
  };

  // We’ll compute simple totals based on points + actor
  let homePts = 0;
  let oppPts = 0;

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    for (const e of events) {
      const key = readKey(e);

      if (key === 'takedown') base.counts.takedown += 1;
      else if (key === 'sweep') base.counts.sweep += 1;
      else if (key === 'knee_on_belly') base.counts.knee_on_belly += 1;
      else if (key === 'guard_pass') base.counts.guard_pass += 1;
      else if (key === 'mount') base.counts.mount += 1;
      else if (key === 'back_control') base.counts.back_control += 1;
      else if (key === 'advantage') base.counts.advantage += 1;
      else if (key === 'penalty') base.counts.penalty += 1;
      else if (key === 'finish') base.counts.finish += 1;

      const pts = typeof e?.points === 'number' ? e.points : typeof e?.value === 'number' ? e.value : 0;
      if (pts > 0) {
        if (e.actor === 'home') homePts += pts;
        else if (e.actor === 'opponent') oppPts += pts;
      }
    }
  }

  // By default, most of your app treats "home" as athlete if homeIsAthlete !== false.
  // But in stats we may not have a consistent homeIsAthlete per clip.
  // So we just show totals for Home vs Opponent.
  base.derived.scoreForAthleteText = `${homePts} pts`;
  base.derived.scoreForOpponentText = `${oppPts} pts`;
  base.derived.finishesText = String(base.counts.finish);

  return base;
}