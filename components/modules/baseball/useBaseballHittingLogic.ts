// components/modules/baseball/useBaseballHittingLogic.ts

export const BALL_COLOR = '#22c55e'; // green
export const STRIKE_COLOR = '#ef4444'; // red
export const FOUL_COLOR = '#eab308'; // yellow
export const HIT_COLOR = '#22c55e'; // green
export const OUT_COLOR = '#f97316'; // orange
export const HR_COLOR = '#eab308'; // yellow/gold
export const WALK_COLOR = '#0ea5e9'; // cyan/blue for walk
export const K_COLOR = '#CF1020'; // fire truck red
export const FRAME_COLOR = 'rgba(255,255,255,0.35)';

export const KEY_COLOR: Record<string, string> = {
  ball: BALL_COLOR,
  strike: STRIKE_COLOR,
  foul: FOUL_COLOR,
  hit: HIT_COLOR,
  out: OUT_COLOR,
  homerun: HR_COLOR,
  walk: WALK_COLOR,
  strikeout: K_COLOR,
};

// -------- time helpers (seconds-first) ----------
// In your app, playback `now` is seconds.
// Most of your events are seconds (PlaybackScreen creates EventRow.t as seconds).
// But some older sidecars might have ms. We normalize to seconds safely.
function toSec(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // if it looks like milliseconds within a clip (e.g., 12000ms) OR epoch ms, convert to seconds
  if (n >= 1e6) return n / 1000; // big values: almost certainly ms
  // if it’s normal clip-time seconds, keep it
  return n;
}

function getEventTimeSec(ev: any): number | null {
  const t = ev?.t ?? ev?.time ?? ev?.ts;
  if (typeof t === 'number' && Number.isFinite(t)) return toSec(t);
  if (typeof t === 'string') {
    const parsed = Number(t);
    if (Number.isFinite(parsed)) return toSec(parsed);
  }
  return null;
}

function getKind(ev: any): string {
  return String(ev?.kind ?? ev?.key ?? ev?.label ?? '')
    .trim()
    .toLowerCase();
}

function sortEventsByTime(events: any[]): any[] {
  return [...events].sort((a, b) => {
    const ta = getEventTimeSec(a);
    const tb = getEventTimeSec(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });
}

/**
 * Derive {balls,strikes,fouls} at playback time by rebuilding the baseball count
 * from the event sequence itself.
 *
 * Why this changed:
 * - The old version trusted saved count snapshots in event meta.
 * - That breaks when a past event is edited/replaced on playback because older
 *   saved meta can become stale.
 *
 * This version only uses baseball event kinds:
 * - ball
 * - strike
 * - foul
 * - walk
 * - strikeout
 * - out
 * - hit
 * - homerun
 *
 * Reset rules:
 * - walk resets count
 * - strikeout resets count
 * - out resets count
 * - hit resets count
 * - homerun resets count
 *
 * Foul rule:
 * - foul adds a strike only if strikes < 2
 * - fouls always increment the foul counter
 */
export function deriveCountAtTime(events: any[] | undefined, now: number | undefined) {
  const nowSec = typeof now === 'number' && Number.isFinite(now) ? toSec(now) : 0;

  if (!Array.isArray(events) || events.length === 0) {
    return { balls: 0, strikes: 0, fouls: 0 };
  }

  const ordered = sortEventsByTime(events);

  let balls = 0;
  let strikes = 0;
  let fouls = 0;

  for (let i = 0; i < ordered.length; i++) {
    const ev = ordered[i];
    const evSec = getEventTimeSec(ev);

    // Stop once we pass the current playback time.
    if (evSec != null && evSec > nowSec) break;

    const kind = getKind(ev);

    switch (kind) {
      case 'ball': {
        balls = Math.min(balls + 1, 4);
        break;
      }

      case 'strike': {
        strikes = Math.min(strikes + 1, 3);
        break;
      }

      case 'foul':
      case 'foul ball': {
        fouls += 1;
        if (strikes < 2) {
          strikes += 1;
        }
        break;
      }

      // terminal / reset events
      case 'walk':
      case 'strikeout':
      case 'out':
      case 'hit':
      case 'homerun':
      case 'home run':
      case 'hr allowed':
      case 'hit allowed': {
        balls = 0;
        strikes = 0;
        fouls = 0;
        break;
      }

      default:
        break;
    }
  }

  return { balls, strikes, fouls };
}