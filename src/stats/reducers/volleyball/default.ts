import type { ClipSidecar } from '../../types';

export type VolleyballDefaultStats = {
  sportKey: 'volleyball:default';
  totals: { clips: number; events: number };
  counts: {
    // Offense
    attack: number;
    kill: number;

    // Serve
    serveIn: number;
    ace: number;
    serveError: number;

    // Defense
    block: number;
    dig: number;

    // Passing (ratings)
    pass3: number;
    pass2: number;
    pass1: number;
    pass0: number;

    // Errors
    error: number;
    net: number;

    // Other (neutral buttons you already have)
    touch: number;
    firstBall: number;
    bump: number;
  };
  derived: {
    // Attack
    killPctText: string; // K / ATK
    // Serve
    acePctText: string; // A / (SI + A + SE)
    serveInPctText: string; // (SI + A) / (SI + A + SE)
    serveErrorPctText: string; // SE / (SI + A + SE)
    // Passing
    passAvgText: string; // average 0-3
    pass3PctText: string;
    pass2PctText: string;
    pass1PctText: string;
    pass0PctText: string;
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

function pctText(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

export function reduceVolleyballDefault(clips: ClipSidecar[]): VolleyballDefaultStats {
  const base: VolleyballDefaultStats = {
    sportKey: 'volleyball:default',
    totals: { clips: clips.length, events: 0 },
    counts: {
      attack: 0,
      kill: 0,

      serveIn: 0,
      ace: 0,
      serveError: 0,

      block: 0,
      dig: 0,

      pass3: 0,
      pass2: 0,
      pass1: 0,
      pass0: 0,

      error: 0,
      net: 0,

      touch: 0,
      firstBall: 0,
      bump: 0,
    },
    derived: {
      killPctText: '0%',
      acePctText: '0%',
      serveInPctText: '0%',
      serveErrorPctText: '0%',
      passAvgText: '0.00',
      pass3PctText: '0%',
      pass2PctText: '0%',
      pass1PctText: '0%',
      pass0PctText: '0%',
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

      // ✅ matches your overlay keys exactly:
      if (key === 'kill') base.counts.kill += 1;
      else if (key === 'attack') base.counts.attack += 1;

      else if (key === 'servein') base.counts.serveIn += 1; // overlay uses "serveIn"
      else if (key === 'ace') base.counts.ace += 1;
      else if (key === 'serveerror') base.counts.serveError += 1;

      else if (key === 'block') base.counts.block += 1;
      else if (key === 'dig') base.counts.dig += 1;

      else if (key === 'passrating') {
        const r = clamp0(meta?.passRating ?? e?.value);
        if (r === 3) base.counts.pass3 += 1;
        else if (r === 2) base.counts.pass2 += 1;
        else if (r === 1) base.counts.pass1 += 1;
        else base.counts.pass0 += 1;
      }

      else if (key === 'error') base.counts.error += 1;
      else if (key === 'net') base.counts.net += 1;

      else if (key === 'touch') base.counts.touch += 1;
      else if (key === 'firstball') base.counts.firstBall += 1;
      else if (key === 'bump') base.counts.bump += 1;
    }
  }

  // Derived
  const atk = base.counts.attack + base.counts.kill; // kills imply an attack attempt
  const k = base.counts.kill;

  const serveTotal = base.counts.serveIn + base.counts.ace + base.counts.serveError;
  const passTotal = base.counts.pass3 + base.counts.pass2 + base.counts.pass1 + base.counts.pass0;

  base.derived.killPctText = pctText(k, atk);

  base.derived.acePctText = pctText(base.counts.ace, serveTotal);
  base.derived.serveInPctText = pctText(base.counts.serveIn + base.counts.ace, serveTotal);
  base.derived.serveErrorPctText = pctText(base.counts.serveError, serveTotal);

  // Pass average 0-3
  const passPoints =
    base.counts.pass3 * 3 + base.counts.pass2 * 2 + base.counts.pass1 * 1 + base.counts.pass0 * 0;
  base.derived.passAvgText = passTotal ? (passPoints / passTotal).toFixed(2) : '0.00';

  base.derived.pass3PctText = pctText(base.counts.pass3, passTotal);
  base.derived.pass2PctText = pctText(base.counts.pass2, passTotal);
  base.derived.pass1PctText = pctText(base.counts.pass1, passTotal);
  base.derived.pass0PctText = pctText(base.counts.pass0, passTotal);

  return base;
}