import type { ClipSidecar } from './types';

import { reduceWrestlingFreestyle } from './reducers/wrestling/freestyle';
import { reduceWrestlingGreco } from './reducers/wrestling/greco';
import { reduceWrestlingFolkstyle } from './reducers/wrestling/wrestlingFolkstyle';

import { reduceBaseballHitting } from './reducers/baseball/hitting';
import { reduceBaseballPitching } from './reducers/baseball/pitching';

import { reduceBasketballDefault } from './reducers/basketball/reduceBasketball';

import { reduceBjjDefault, reduceBjjGi, reduceBjjNoGi } from './reducers/bjj/default';
import { reduceVolleyballDefault } from './reducers/volleyball/default';

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

registerSportStats('wrestling:folkstyle', reduceWrestlingFolkstyle);
registerSportStats('wrestling:freestyle', reduceWrestlingFreestyle);
registerSportStats('wrestling:greco', reduceWrestlingGreco);

registerSportStats('baseball:hitting', reduceBaseballHitting);
registerSportStats('baseball:pitching', reduceBaseballPitching);

registerSportStats('basketball:default', reduceBasketballDefault);

registerSportStats('volleyball:default', reduceVolleyballDefault);
registerSportStats('volleyball:match', reduceVolleyballDefault);
registerSportStats('bjj:default', reduceBjjDefault);
registerSportStats('bjj:gi', reduceBjjGi);
registerSportStats('bjj:nogi', reduceBjjNoGi);