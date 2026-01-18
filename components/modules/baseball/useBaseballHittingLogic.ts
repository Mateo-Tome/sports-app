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

function getCountMeta(ev: any): any | null {
  // support both meta and meta.meta nesting
  return ev?.meta?.meta ?? ev?.meta ?? null;
}

/**
 * Derive {balls,strikes,fouls} at playback time (nowSec) by scanning events.
 * We pick the *last* event <= now that has count fields.
 */
export function deriveCountAtTime(events: any[] | undefined, now: number | undefined) {
  const nowSec = typeof now === 'number' && Number.isFinite(now) ? toSec(now) : 0;

  if (!Array.isArray(events) || events.length === 0) {
    return { balls: 0, strikes: 0, fouls: 0 };
  }

  // Sort by time so we can break early correctly
  const ordered = [...events].sort((a, b) => {
    const ta = getEventTimeSec(a);
    const tb = getEventTimeSec(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  let found: { balls: number; strikes: number; fouls: number } | null = null;

  for (let i = 0; i < ordered.length; i++) {
    const ev: any = ordered[i];

    const evSec = getEventTimeSec(ev);
    // If event time exists and is after playback time, stop.
    // ✅ Do NOT use truthy checks; nowSec can be 0.
    if (evSec != null && evSec > nowSec) break;

    const m = getCountMeta(ev);
    if (!m) continue;

    const hasCountMeta =
      typeof m.balls === 'number' ||
      typeof m.strikes === 'number' ||
      typeof m.fouls === 'number' ||
      typeof m.ballsAfter === 'number' ||
      typeof m.strikesAfter === 'number' ||
      typeof m.foulsAfter === 'number';

    if (!hasCountMeta) continue;

    found = {
      balls:
        typeof m.ballsAfter === 'number'
          ? m.ballsAfter
          : typeof m.balls === 'number'
          ? m.balls
          : 0,
      strikes:
        typeof m.strikesAfter === 'number'
          ? m.strikesAfter
          : typeof m.strikes === 'number'
          ? m.strikes
          : 0,
      fouls:
        typeof m.foulsAfter === 'number'
          ? m.foulsAfter
          : typeof m.fouls === 'number'
          ? m.fouls
          : 0,
    };
  }

  return found ?? { balls: 0, strikes: 0, fouls: 0 };
}
