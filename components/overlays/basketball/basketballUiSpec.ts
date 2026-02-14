// components/overlays/basketball/basketballUiSpec.ts

export type BeltLane = 'top' | 'bottom';
export type ShotType = '2PT' | '3PT' | 'FT';

export const BB_COLORS = {
  assist: '#22c55e',
  pass: '#14b8a6',
  steal: '#38bdf8',
  block: '#a855f7',
  rebound: '#f59e0b',

  shot2: '#60a5fa',
  shot3: '#3b82f6',
  ft: '#93c5fd',

  turnover: '#ef4444',
  foul: '#f97316', // ✅ "danger orange"
  miss: '#ef4444', // red for misses

  neutral: 'rgba(148,163,184,0.92)',
};

export type OverlayBtn = {
  id: string;
  label: string;
  sub?: string;
  action:
    | 'assist'
    | 'pass'
    | 'rebound' // opens picker
    | 'steal'
    | 'block'
    | 'turnover'
    | 'shot2'   // opens picker
    | 'shot3'   // opens picker
    | 'ft'      // opens picker
    | 'foul';
  ringColor: string;
};

export const LEFT_BTNS: OverlayBtn[] = [
  { id: 'L_AST', label: 'AST', sub: 'Assist', action: 'assist', ringColor: BB_COLORS.assist },
  { id: 'L_PASS', label: 'PASS', sub: 'Pass', action: 'pass', ringColor: BB_COLORS.pass },
  { id: 'L_REB', label: 'REB', sub: 'Rebound', action: 'rebound', ringColor: BB_COLORS.rebound },

  { id: 'L_STL', label: 'STL', sub: 'Steal', action: 'steal', ringColor: BB_COLORS.steal },
  { id: 'L_BLK', label: 'BLK', sub: 'Block', action: 'block', ringColor: BB_COLORS.block },
  { id: 'L_TO', label: 'TO', sub: 'Turnover', action: 'turnover', ringColor: BB_COLORS.turnover },
];

export const RIGHT_BTNS: OverlayBtn[] = [
  { id: 'R_2', label: '2PT', sub: 'Shot', action: 'shot2', ringColor: BB_COLORS.shot2 },
  { id: 'R_3', label: '3PT', sub: 'Shot', action: 'shot3', ringColor: BB_COLORS.shot3 },
  { id: 'R_FT', label: 'FT', sub: 'Free', action: 'ft', ringColor: BB_COLORS.ft },
  { id: 'R_PF', label: 'PF', sub: 'Foul', action: 'foul', ringColor: BB_COLORS.foul },
];

export function laneForAction(action: string, extra?: any): BeltLane {
  const a = String(action || '').toLowerCase();

  // shot depends on made
  if (a === 'shot') return extra?.made ? 'bottom' : 'top';

  // bad
  if (a === 'turnover' || a === 'foul') return 'top';

  // good
  if (a === 'assist' || a === 'pass' || a === 'rebound' || a === 'steal' || a === 'block') return 'bottom';

  return 'bottom';
}

export function tintForShot(type: ShotType, made: boolean) {
  if (!made) return BB_COLORS.miss;
  if (type === '2PT') return BB_COLORS.shot2;
  if (type === '3PT') return BB_COLORS.shot3;
  return BB_COLORS.ft;
}

export function pointsForShot(type: ShotType) {
  if (type === '2PT') return 2;
  if (type === '3PT') return 3;
  return 1;
}
