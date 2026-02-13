import type { ClipSidecar } from './types';

// ✅ wrestling reducers
import { reduceWrestlingFreestyle } from './reducers/wrestling/freestyle';
import { reduceWrestlingGreco } from './reducers/wrestling/greco';
import { reduceWrestlingFolkstyle } from './reducers/wrestling/wrestlingFolkstyle';

// ✅ baseball reducers
import { reduceBaseballHitting } from './reducers/baseball/hitting';
import { reduceBaseballPitching } from './reducers/baseball/pitching';

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

// ✅ Baseball
registerSportStats('baseball:hitting', reduceBaseballHitting);
registerSportStats('baseball:pitching', reduceBaseballPitching);
