// app/screens/playbackCore.ts

/* === shared types ==================== */
export type Actor = 'home' | 'opponent' | 'neutral';

export type EventRow = {
  _id?: string;
  t: number;
  kind: string;
  points?: number;
  actor?: Actor;
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

export type Winner = 'home' | 'opponent' | null;
export type OutcomeLetter = 'W' | 'L' | 'T';
export type EndedBy = 'pin' | 'decision';

export type Sidecar = {
  athlete?: string;
  sport?: string;
  style?: string;
  createdAt?: number;
  events?: EventRow[];
  finalScore?: { home: number; opponent: number };
  homeIsAthlete?: boolean;
  homeColorIsGreen?: boolean;
  appVersion?: number;
  outcome?: OutcomeLetter;
  winner?: Winner;
  endedBy?: EndedBy | null;
  athletePinned?: boolean;
  athleteWasPinned?: boolean;
  modifiedAt?: number;
};

/* === helpers ==================== */

export const fmt = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const abbrKind = (k?: string) => {
  if (!k) return 'EV';
  switch ((k || '').toLowerCase()) {
    case 'takedown':
      return 'T';
    case 'escape':
      return 'E';
    case 'reversal':
      return 'R';
    case 'nearfall':
      return 'NF';
    case 'stall':
    case 'stalling':
      return 'ST';
    case 'caution':
      return 'C';
    case 'penalty':
      return 'P';
    case 'warning':
      return 'W';
    case 'pin':
      return 'PIN';
    default:
      return k.slice(0, 2).toUpperCase();
  }
};

export const PENALTYISH = new Set(['stall', 'stalling', 'caution', 'penalty', 'warning']);

export function toActor(a: any): Actor {
  return a === 'home' || a === 'opponent' || a === 'neutral' ? a : 'neutral';
}

function inferActorInternal(e: EventRow, homeIsAthlete: boolean): Actor {
  if (e.actor === 'home' || e.actor === 'opponent' || e.actor === 'neutral') return e.actor;

  const kind = String(e.kind || '').toLowerCase();
  const penaltyish = PENALTYISH.has(kind);
  const m = e.meta ?? {};

  const norm = (v: any): 'home' | 'opponent' | null => {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return null;
    if (['home', 'h'].includes(s)) return 'home';
    if (['opponent', 'opp', 'o'].includes(s)) return 'opponent';
    if (['athlete', 'me', 'us', 'our'].includes(s)) return homeIsAthlete ? 'home' : 'opponent';
    if (['them', 'their', 'away', 'visitor'].includes(s)) return homeIsAthlete ? 'opponent' : 'home';
    return null;
  };

  const to =
    norm(m.to) ??
    norm(m.toSide) ??
    norm(m.scorer) ??
    norm(m.awardedTo) ??
    norm(m.pointTo) ??
    norm(m.benefit) ??
    null;
  if (to) return to;

  const against =
    norm(m.against) ??
    norm(m.on) ??
    norm(m.calledOn) ??
    norm(m.penalized) ??
    norm(m.who) ??
    norm(m.side) ??
    null;
  if (against === 'home') return 'opponent';
  if (against === 'opponent') return 'home';

  if (penaltyish && typeof e.points === 'number' && e.points > 0) {
    return homeIsAthlete ? 'home' : 'opponent';
  }
  if (penaltyish) return homeIsAthlete ? 'home' : 'opponent';

  return 'neutral';
}

export function normalizeEvents(evts: EventRow[], homeIsAthlete: boolean): EventRow[] {
  return evts.map(e => ({ ...e, actor: inferActorInternal(e, homeIsAthlete) }));
}

export const assignIds = (list: EventRow[]) =>
  list.map((e, i) => (e._id ? e : { ...e, _id: `${Math.round(e.t * 1000)}_${i}` }));

export function deriveOutcome(
  evts: EventRow[],
  hiA: boolean
): {
  finalScore: { home: number; opponent: number };
  outcome: OutcomeLetter;
  winner: Winner;
  endedBy: EndedBy;
  athletePinned: boolean;
  athleteWasPinned: boolean;
} {
  const ordered = [...evts].sort((a, b) => a.t - b.t);
  let h = 0,
    o = 0;

  for (const e of ordered) {
    const pts = typeof e.points === 'number' ? e.points : 0;
    if (pts > 0) {
      if (e.actor === 'home') h += pts;
      else if (e.actor === 'opponent') o += pts;
    }
  }

  const finalScore = { home: h, opponent: o };

  const pinEv = ordered.find(e => {
    const k = String(e.kind || '').toLowerCase();
    const winBy = String(e?.meta?.winBy || '').toLowerCase();
    const lbl = String(e?.meta?.label || '').toLowerCase();
    return k === 'pin' || k === 'fall' || winBy === 'pin' || lbl.includes('pin') || lbl.includes('fall');
  });

  const endedBy: EndedBy = pinEv ? 'pin' : 'decision';
  const mySide: 'home' | 'opponent' = hiA ? 'home' : 'opponent';
  const athletePinned = !!pinEv && pinEv.actor === mySide;
  const athleteWasPinned = !!pinEv && !athletePinned;

  let outcome: OutcomeLetter;
  if (endedBy === 'pin') {
    outcome = athletePinned ? 'W' : 'L';
  } else {
    const my = hiA ? h : o;
    const opp = hiA ? o : h;
    outcome = my > opp ? 'W' : my < opp ? 'L' : 'T';
  }

  const winner: Winner = outcome === 'T' ? null : ((h > o ? 'home' : 'opponent') as 'home' | 'opponent');

  return { finalScore, outcome, winner, endedBy, athletePinned, athleteWasPinned };
}
