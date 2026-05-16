import type { ClipSidecar } from './types';

import { reduceWrestlingFreestyle } from './reducers/wrestling/freestyle';
import { reduceWrestlingGreco } from './reducers/wrestling/greco';
import { reduceWrestlingFolkstyle } from './reducers/wrestling/wrestlingFolkstyle';

import { reduceBaseballHitting } from './reducers/baseball/hitting';
import { reduceBaseballPitching } from './reducers/baseball/pitching';

import { reduceBasketballDefault } from './reducers/basketball/reduceBasketball';

import { reduceBjjDefault, reduceBjjGi, reduceBjjNoGi } from './reducers/bjj/default';

import { reduceVolleyballDefault } from './reducers/volleyball/default';

import { reduceSwimmingRace } from './reducers/swimming/race';

export type SportStatsReducer = (clips: ClipSidecar[]) => any;

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

// Wrestling
registerSportStats('wrestling:folkstyle', reduceWrestlingFolkstyle);
registerSportStats('wrestling:freestyle', reduceWrestlingFreestyle);
registerSportStats('wrestling:greco', reduceWrestlingGreco);

// Baseball
registerSportStats('baseball:hitting', reduceBaseballHitting);
registerSportStats('baseball:pitching', reduceBaseballPitching);

// Softball
registerSportStats('softball:hitting', reduceBaseballHitting);
registerSportStats('softball:pitching', reduceBaseballPitching);

// Swimming
registerSportStats('swimming:race', reduceSwimmingRace);
registerSportStats('swimming:default', reduceSwimmingRace);

// Basketball
registerSportStats('basketball:default', reduceBasketballDefault);

// Volleyball
registerSportStats('volleyball:default', reduceVolleyballDefault);
registerSportStats('volleyball:match', reduceVolleyballDefault);

// BJJ
registerSportStats('bjj:default', reduceBjjDefault);
registerSportStats('bjj:gi', reduceBjjGi);
registerSportStats('bjj:nogi', reduceBjjNoGi);