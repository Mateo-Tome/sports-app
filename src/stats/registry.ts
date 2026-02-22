import type { ClipSidecar } from './types';

// ✅ wrestling reducers
import { reduceWrestlingFreestyle } from './reducers/wrestling/freestyle';
import { reduceWrestlingGreco } from './reducers/wrestling/greco';
import { reduceWrestlingFolkstyle } from './reducers/wrestling/wrestlingFolkstyle';

// ✅ baseball reducers
import { reduceBaseballHitting } from './reducers/baseball/hitting';
import { reduceBaseballPitching } from './reducers/baseball/pitching';

// ✅ basketball reducer (THIS IS YOUR ACTUAL FILE)
import { reduceBasketballDefault } from './reducers/basketball/reduceBasketball';

// ✅ volleyball reducer
import { reduceVolleyballDefault } from './reducers/volleyball/default';

// ✅ BJJ reducer (NEW)
import { reduceBjjDefault } from './reducers/bjj/default';

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

// ✅ Basketball
registerSportStats('basketball:default', reduceBasketballDefault);

// ✅ Volleyball
registerSportStats('volleyball:default', reduceVolleyballDefault);

// ✅ BJJ (support multiple possible keys)
registerSportStats('bjj:default', reduceBjjDefault);
registerSportStats('bjj:gi', reduceBjjDefault);
registerSportStats('bjj:nogi', reduceBjjDefault);