import type { ClipSidecar } from '../../types';

export type BaseballPitchingStats = {
  sportKey: 'baseball:pitching';
  totals: { clips: number; events: number };
  counts: {
    ball: number;
    strike: number;
    foul: number;

    walk: number;
    hitByPitch: number;
    hitAllowed: number;
    homerunAllowed: number;
    outRecorded: number;
    strikeout: number;

    strikeTypes: { swinging: number; looking: number; unknown: number };
    hitTypes: { single: number; double: number; triple: number; bunt: number; unknown: number };
    outTypes: Record<string, number>;
    strikeoutTypes: { swinging: number; looking: number; unknown: number };
  };

  derived?: {
    totalPitches: number;
    strikesTotal: number;
    balls: number;

    outsRecordedTotal: number;
    inningsPitchedOuts: number;
    inningsPitchedText: string;

    battersFaced: number;

    hitsTotalAllowed: number;
    baserunners: number;

    strikePctText: string;
    ballPctText: string;
    calledStrikePctText: string;
    swingingStrikePctText: string;
    kPctText: string;
    bbPctText: string;
    hbpPctText: string;
    kbbText: string;

    whipText: string;

    pitchesPerBFText: string;
    pitchesPerInningText: string;
  };

  lastUpdatedAt: number;
};

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function readKey(e: any) {
  return String(e?.key ?? e?.kind ?? '').trim().toLowerCase();
}

function readKind(meta: any) {
  const k = String(meta?.kind ?? meta?.type ?? '').trim().toLowerCase();
  if (k === 'swinging') return 'swinging';
  if (k === 'looking') return 'looking';
  return 'unknown';
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
  const rem = o % 3;
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
      hitByPitch: 0,
      hitAllowed: 0,
      homerunAllowed: 0,
      outRecorded: 0,
      strikeout: 0,

      strikeTypes: { swinging: 0, looking: 0, unknown: 0 },
      hitTypes: { single: 0, double: 0, triple: 0, bunt: 0, unknown: 0 },
      outTypes: {},
      strikeoutTypes: { swinging: 0, looking: 0, unknown: 0 },
    },
    lastUpdatedAt: 0,
  };

  for (const clip of clips) {
    const events: any[] = (clip as any).events ?? [];
    base.totals.events += events.length;

    base.lastUpdatedAt = Math.max(base.lastUpdatedAt, clamp0((clip as any).createdAt));

    for (const e of events) {
      const key = readKey(e);
      const meta = (e?.meta ?? {}) as any;

      if (key === 'ball') {
        base.counts.ball += 1;
      } else if (key === 'strike') {
        base.counts.strike += 1;
        const kind = readKind(meta);
        base.counts.strikeTypes[kind] += 1;
      } else if (key === 'foul') {
        base.counts.foul += 1;
      } else if (key === 'walk') {
        base.counts.walk += 1;
      } else if (key === 'hit_by_pitch') {
        base.counts.hitByPitch += 1;
      } else if (key === 'hit') {
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
        const kind = readKind(meta);
        base.counts.strikeoutTypes[kind] += 1;
      }
    }
  }

  const balls = base.counts.ball;
  const strikes = base.counts.strike;
  const fouls = base.counts.foul;

  const totalPitches = balls + strikes + fouls;
  const strikesTotal = strikes + fouls;

  const outsRecordedTotal = base.counts.outRecorded + base.counts.strikeout;
  const hitsTotalAllowed = base.counts.hitAllowed + base.counts.homerunAllowed;

  const battersFaced =
    outsRecordedTotal +
    hitsTotalAllowed +
    base.counts.walk +
    base.counts.hitByPitch;

  const inningsPitchedOuts = outsRecordedTotal;
  const inningsPitchedText = inningsTextFromOuts(inningsPitchedOuts);

  const baserunners = hitsTotalAllowed + base.counts.walk + base.counts.hitByPitch;

  const whip =
    inningsPitchedOuts > 0 ? baserunners / (inningsPitchedOuts / 3) : 0;

  const pitchesPerBF = battersFaced > 0 ? totalPitches / battersFaced : 0;
  const pitchesPerInning =
    inningsPitchedOuts > 0 ? totalPitches / (inningsPitchedOuts / 3) : 0;

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
    calledStrikePctText: pctText(base.counts.strikeTypes.looking, totalPitches),
    swingingStrikePctText: pctText(base.counts.strikeTypes.swinging, totalPitches),
    kPctText: pctText(base.counts.strikeout, battersFaced),
    bbPctText: pctText(base.counts.walk, battersFaced),
    hbpPctText: pctText(base.counts.hitByPitch, battersFaced),
    kbbText: kbb === Infinity ? '∞' : fixedText(kbb, 2),

    whipText: inningsPitchedOuts > 0 ? fixedText(whip, 2) : '0.00',

    pitchesPerBFText: fixedText(pitchesPerBF, 1),
    pitchesPerInningText: inningsPitchedOuts > 0 ? fixedText(pitchesPerInning, 1) : '0.0',
  };

  return base;
}