import type { ClipSidecar } from '../../types';

export type BaseballPitchingStats = {
  sportKey: 'baseball:pitching';
  totals: { clips: number; events: number };
  counts: {
    ball: number;
    strike: number;
    foul: number;

    // Outcomes
    walk: number;
    hitAllowed: number; // non-HR hits
    homerunAllowed: number;
    outRecorded: number; // ONLY "out" events (kept for backward compat)
    strikeout: number;

    // Optional detail by type (if you store meta.type)
    hitTypes: { single: number; double: number; triple: number; bunt: number; unknown: number };
    outTypes: Record<string, number>;
    strikeoutTypes: { swinging: number; looking: number; unknown: number };
  };

  // ✅ NEW: derived pitching metrics (safe/backward compatible)
  derived?: {
    totalPitches: number;
    strikesTotal: number; // strikes + fouls
    balls: number;

    outsRecordedTotal: number; // outRecorded + strikeout
    inningsPitchedOuts: number;
    inningsPitchedText: string; // e.g. "2.1" means 2 and 1/3 innings

    battersFaced: number;

    hitsTotalAllowed: number; // hitAllowed + homerunAllowed
    baserunners: number; // hitsTotalAllowed + walks

    strikePctText: string;
    ballPctText: string;
    kPctText: string;
    bbPctText: string;
    kbbText: string;

    whipText: string;

    pitchesPerBFText: string;
    pitchesPerInningText: string;
  };

  lastUpdatedAt: number;
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : 0;
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function readKey(e: any) {
  return String(e?.key ?? e?.kind ?? '').trim().toLowerCase();
}

function pctText(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function fixedText(num: number, digits = 2) {
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(digits);
}

function inningsTextFromOuts(outs: number) {
  const o = Math.max(0, Math.floor(outs || 0));
  const whole = Math.floor(o / 3);
  const rem = o % 3; // 0,1,2 outs
  return `${whole}.${rem}`;
}

export function reduceBaseballPitching(clips: ClipSidecar[]): BaseballPitchingStats {
  const base: BaseballPitchingStats = {
    sportKey: 'baseball:pitching',
    totals: { clips: clips.length, events: 0 },
    counts: {
      ball: 0,
      strike: 0,
      foul: 0,

      walk: 0,
      hitAllowed: 0,
      homerunAllowed: 0,
      outRecorded: 0,
      strikeout: 0,

      hitTypes: { single: 0, double: 0, triple: 0, bunt: 0, unknown: 0 },
      outTypes: {},
      strikeoutTypes: { swinging: 0, looking: 0, unknown: 0 },
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    const createdAt = clamp0((clip as any).createdAt);
    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, createdAt);

    for (const e of events) {
      const key = readKey(e);
      const meta = (e?.meta ?? {}) as any;

      if (key === 'ball') base.counts.ball += 1;
      else if (key === 'strike') base.counts.strike += 1;
      else if (key === 'foul') base.counts.foul += 1;
      else if (key === 'walk') base.counts.walk += 1;
      else if (key === 'hit') {
        base.counts.hitAllowed += 1;
        const t = String(meta?.type ?? '').toLowerCase();
        if (t === 'single') base.counts.hitTypes.single += 1;
        else if (t === 'double') base.counts.hitTypes.double += 1;
        else if (t === 'triple') base.counts.hitTypes.triple += 1;
        else if (t === 'bunt') base.counts.hitTypes.bunt += 1;
        else base.counts.hitTypes.unknown += 1;
      } else if (key === 'homerun') {
        base.counts.homerunAllowed += 1;
      } else if (key === 'out') {
        base.counts.outRecorded += 1;
        const t = String(meta?.type ?? meta?.label ?? '').trim();
        if (t) base.counts.outTypes[t] = (base.counts.outTypes[t] ?? 0) + 1;
      } else if (key === 'strikeout') {
        base.counts.strikeout += 1;
        const kind = String(meta?.kind ?? '').toLowerCase();
        if (kind === 'swinging') base.counts.strikeoutTypes.swinging += 1;
        else if (kind === 'looking') base.counts.strikeoutTypes.looking += 1;
        else base.counts.strikeoutTypes.unknown += 1;
      }
    }
  }

  // -------------------------
  // ✅ Derived metrics (safe)
  // -------------------------
  const balls = base.counts.ball;
  const strikes = base.counts.strike;
  const fouls = base.counts.foul;

  const totalPitches = balls + strikes + fouls;
  const strikesTotal = strikes + fouls;

  // ✅ IMPORTANT: strikeouts are outs too for IP/BF/WHIP
  const outsRecordedTotal = base.counts.outRecorded + base.counts.strikeout;

  const hitsTotalAllowed = base.counts.hitAllowed + base.counts.homerunAllowed;

  // BF approximation based on what you actually log as plate appearance outcomes
  const battersFaced = outsRecordedTotal + hitsTotalAllowed + base.counts.walk;

  const inningsPitchedOuts = outsRecordedTotal;
  const inningsPitchedText = inningsTextFromOuts(inningsPitchedOuts);

  const baserunners = hitsTotalAllowed + base.counts.walk;

  const whip =
    inningsPitchedOuts > 0 ? baserunners / (inningsPitchedOuts / 3) : 0;

  const pitchesPerBF = battersFaced > 0 ? totalPitches / battersFaced : 0;
  const pitchesPerInning =
    inningsPitchedOuts > 0 ? totalPitches / (inningsPitchedOuts / 3) : 0;

  const kPct = battersFaced > 0 ? base.counts.strikeout / battersFaced : 0;
  const bbPct = battersFaced > 0 ? base.counts.walk / battersFaced : 0;

  const kbb =
    base.counts.walk > 0 ? base.counts.strikeout / base.counts.walk : Infinity;

  base.derived = {
    totalPitches,
    strikesTotal,
    balls,

    outsRecordedTotal,
    inningsPitchedOuts,
    inningsPitchedText,

    battersFaced,

    hitsTotalAllowed,
    baserunners,

    strikePctText: pctText(strikesTotal, totalPitches),
    ballPctText: pctText(balls, totalPitches),
    kPctText: pctText(base.counts.strikeout, battersFaced),
    bbPctText: pctText(base.counts.walk, battersFaced),
    kbbText: kbb === Infinity ? '∞' : fixedText(kbb, 2),

    whipText: inningsPitchedOuts > 0 ? fixedText(whip, 2) : '0.00',

    pitchesPerBFText: fixedText(pitchesPerBF, 1),
    pitchesPerInningText: inningsPitchedOuts > 0 ? fixedText(pitchesPerInning, 1) : '0.0',
  };

  return base;
}