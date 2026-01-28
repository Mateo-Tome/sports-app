// src/stats/buildAthleteStats.ts

import { getSportStatsReducer } from './registry';
import { sportKeyFromClip } from './sportKey';
import type { AthleteStatsSummary, ClipSidecar } from './types';

/**
 * Build stats for ONE athlete from their clips
 */
export function buildAthleteStats(
  athlete: string,
  clips: ClipSidecar[],
): AthleteStatsSummary {
  const bySport: Record<string, any> = {};

  // Group clips by canonical sportKey
  const clipsBySport: Record<string, ClipSidecar[]> = {};

  for (const clip of clips) {
    const sportKey = sportKeyFromClip(clip);
    (clipsBySport[sportKey] ??= []).push(clip);
  }

  // Run reducers
  for (const sportKey of Object.keys(clipsBySport)) {
    const reducer = getSportStatsReducer(sportKey);
    if (!reducer) {
      // Optional breadcrumb so you can SEE missing reducer keys in the UI/debug:
      bySport[sportKey] = {
        sportKey,
        missingReducer: true,
        totals: {
          clips: clipsBySport[sportKey].length,
          events: clipsBySport[sportKey].reduce((s, c) => s + (c.events?.length ?? 0), 0),
        },
      };
      continue;
    }

    bySport[sportKey] = reducer(clipsBySport[sportKey]);
  }

  return {
    athlete,
    updatedAt: Date.now(),
    totals: {
      videos: clips.length,
      events: clips.reduce((sum, c) => sum + (c.events?.length ?? 0), 0),
    },
    bySport,
  };
}
