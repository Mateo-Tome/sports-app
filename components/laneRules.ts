// components/modules/laneRules.ts

export type BeltLane = 'top' | 'bottom' | 'auto';

/**
 * Decide which belt lane an event should render on.
 * - 'top'    => top lane
 * - 'bottom' => bottom lane
 * - 'auto'   => EventBelt falls back to actor/default behavior
 */
export function laneForEvent(sportKey: string, kindOrKey: string): BeltLane {
  const k = String(kindOrKey || '').toLowerCase();

  if (sportKey === 'baseball:hitting') {
    if (['ball', 'hit', 'walk', 'homerun'].includes(k)) return 'top';
    if (['strike', 'foul', 'strikeout', 'out'].includes(k)) return 'bottom';
    return 'auto';
  }

  if (sportKey === 'wrestling:folkstyle') {
    // Wrestling is primarily actor-driven (home/opponent)
    return 'auto';
  }

  return 'auto';
}
