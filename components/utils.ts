// components/utils.ts

/* ==================== types ==================== */
export type Actor = 'home' | 'opponent' | 'neutral';

export type EventRow = {
  _id?: string; // local id for edits
  t: number;
  kind: string;
  points?: number;
  actor?: Actor;
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

// **MISSING TYPES ADDED HERE**
export type Winner = 'home' | 'opponent' | null;
export type OutcomeLetter = 'W' | 'L' | 'T';
export type EndedBy = 'pin' | 'decision';

/* === colors === */
export const GREEN = '#16a34a';
export const RED   = '#dc2626';
export const GREY  = '#9ca3af';

/* ==================== helpers ==================== */
export const fmt = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const abbrKind = (k?: string) => {
  if (!k) return 'EV';
  switch ((k || '').toLowerCase()) {
    case 'takedown':  return 'T';
    case 'escape':    return 'E';
    case 'reversal':  return 'R';
    case 'nearfall':  return 'NF';
    case 'stall':
    case 'stalling':  return 'ST';
    case 'caution':   return 'C';
    case 'penalty':   return 'P';
    case 'warning':   return 'W';
    case 'pin':       return 'PIN';
    default:          return k.slice(0, 2).toUpperCase();
  }
};

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const toActor = (a: any): Actor =>
  a === 'home' || a === 'opponent' || a === 'neutral' ? a : 'neutral';