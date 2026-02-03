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

/** Merge meta + meta.meta so modules can safely store nested chooser info. */
function getMetaFlat(e: EventRow): Record<string, any> {
  const m: any = e?.meta ?? {};
  const inner: any = m?.meta ?? {};
  // Prefer top-level keys on collision
  return { ...inner, ...m };
}

function normSide(v: any, homeIsAthlete: boolean): 'home' | 'opponent' | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;

  if (s === 'home' || s === 'h') return 'home';
  if (s === 'opponent' || s === 'opp' || s === 'o') return 'opponent';

  // convenience tokens
  if (['athlete', 'me', 'us', 'our', 'mykid', 'my kid'].includes(s)) return homeIsAthlete ? 'home' : 'opponent';
  if (['them', 'their', 'away', 'visitor', 'opponentteam', 'opponent team'].includes(s))
    return homeIsAthlete ? 'opponent' : 'home';

  return null;
}

/**
 * Resolve a target side for "chooser / neutral" events.
 * Examples:
 * - meta.for: 'home'|'opponent'  (awarded to)
 * - meta.offender / meta.penalized / meta.calledOn: 'home'|'opponent' (called on)
 */
function resolveTargetSideFromMeta(e: EventRow, homeIsAthlete: boolean): 'home' | 'opponent' | null {
  const m = getMetaFlat(e);

  // awarded TO
  const to =
    normSide(m.for, homeIsAthlete) ??
    normSide(m.to, homeIsAthlete) ??
    normSide(m.toSide, homeIsAthlete) ??
    normSide(m.scorer, homeIsAthlete) ??
    normSide(m.awardedTo, homeIsAthlete) ??
    normSide(m.pointTo, homeIsAthlete) ??
    normSide(m.benefit, homeIsAthlete) ??
    null;
  if (to) return to;

  // called ON (offender/penalized)
  const on =
    normSide(m.offender, homeIsAthlete) ??
    normSide(m.penalized, homeIsAthlete) ??
    normSide(m.calledOn, homeIsAthlete) ??
    normSide(m.against, homeIsAthlete) ??
    normSide(m.on, homeIsAthlete) ??
    normSide(m.who, homeIsAthlete) ??
    normSide(m.side, homeIsAthlete) ??
    null;
  if (on) return on;

  // nested target object support (optional)
  if (m?.target && typeof m.target === 'object') {
    const t = m.target;
    const tTo =
      normSide(t.for, homeIsAthlete) ??
      normSide(t.to, homeIsAthlete) ??
      normSide(t.awardedTo, homeIsAthlete) ??
      null;
    if (tTo) return tTo;

    const tOn =
      normSide(t.offender, homeIsAthlete) ??
      normSide(t.penalized, homeIsAthlete) ??
      normSide(t.calledOn, homeIsAthlete) ??
      null;
    if (tOn) return tOn;
  }

  return null;
}

function inferActorInternal(e: EventRow, homeIsAthlete: boolean): Actor {
  if (e.actor === 'home' || e.actor === 'opponent' || e.actor === 'neutral') return e.actor;

  const kind = String(e.kind || '').toLowerCase();
  const penaltyish = PENALTYISH.has(kind);

  // ✅ First: if meta indicates a target, respect it.
  const target = resolveTargetSideFromMeta(e, homeIsAthlete);
  if (target) return target;

  // ✅ If penalty-ish but we still can't resolve, keep it neutral.
  // This prevents "PASS/PEN always go to one side" across styles/sports.
  if (penaltyish) return 'neutral';

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
      else {
        // ✅ If someone ever emitted points on a neutral event, use meta target if present.
        const target = resolveTargetSideFromMeta(e, hiA);
        if (target === 'home') h += pts;
        else if (target === 'opponent') o += pts;
      }
    }
  }

  const finalScore = { home: h, opponent: o };

  const pinEv = ordered.find(e => {
    const k = String(e.kind || '').toLowerCase();
    const m: any = e?.meta ?? {};
    const winBy = String(m?.winBy || '').toLowerCase();
    const lbl = String(m?.label || '').toLowerCase();
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
