// src/stats/registry.ts

import type { ClipSidecar } from './types';

// ✅ reducers (match your actual folder + filenames)
import { reduceWrestlingFreestyle } from './reducers/wrestling/freestyle';
import { reduceWrestlingGreco } from './reducers/wrestling/greco';
import { reduceWrestlingFolkstyle } from './reducers/wrestling/wrestlingFolkstyle';

// A reducer takes clips and returns a stats object
export type SportStatsReducer = (clips: ClipSidecar[]) => any;

// Registry: sportKey -> reducer
const registry: Record<string, SportStatsReducer> = {};

export function registerSportStats(sportKey: string, reducer: SportStatsReducer) {
  registry[sportKey] = reducer;
}

export function getSportStatsReducer(sportKey: string) {
  return registry[sportKey];
}

export function listRegisteredSports() {
  return Object.keys(registry).sort();
}

// Register reducers (V1)
registerSportStats('wrestling:folkstyle', reduceWrestlingFolkstyle);
registerSportStats('wrestling:freestyle', reduceWrestlingFreestyle);
registerSportStats('wrestling:greco', reduceWrestlingGreco);
