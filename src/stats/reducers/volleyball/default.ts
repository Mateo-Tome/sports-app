import type { ClipSidecar } from '../../types';

export type VolleyballDefaultStats = {
  sportKey: 'volleyball:default';
  totals: { clips: number; events: number };

  counts: {
    attack: number;
    kill: number;

    serveIn: number;
    ace: number;
    serveError: number;

    block: number;
    dig: number;

    pass3: number;
    pass2: number;
    pass1: number;
    pass0: number;

    attackError: number;
    net: number;
    ballHandlingError: number;
    error: number;

    touch: number;
    firstBall: number;
    bump: number;
  };

  derived: {
    attackAttempts: number;
    hittingPct: number;
    hittingPctText: string;
    killPctText: string;

    serveTotal: number;
    acePctText: string;
    aceErrorRatioText: string;
    serveInPctText: string;
    serveErrorPctText: string;
    serveEfficiency: number;
    serveEfficiencyText: string;

    passTotal: number;
    passAvgText: string;
    pass3PctText: string;
    pass2PctText: string;
    pass1PctText: string;
    pass0PctText: string;

    totalErrors: number;
    defenseImpact: number;
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

function decimal3(n: number) {
  if (!Number.isFinite(n)) return '.000';
  const fixed = n.toFixed(3);
  if (fixed === '-0.000') return '.000';
  if (fixed.startsWith('0')) return fixed.slice(1);
  if (fixed.startsWith('-0')) return `-${fixed.slice(2)}`;
  return fixed;
}

function signedDecimal3(n: number) {
  if (!Number.isFinite(n)) return '.000';
  if (n > 0) return `+${decimal3(n)}`;
  return decimal3(n);
}

export function reduceVolleyballDefault(
  clips: ClipSidecar[],
): VolleyballDefaultStats {
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

      attackError: 0,
      net: 0,
      ballHandlingError: 0,
      error: 0,

      touch: 0,
      firstBall: 0,
      bump: 0,
    },
    derived: {
      attackAttempts: 0,
      hittingPct: 0,
      hittingPctText: '.000',
      killPctText: '0%',

      serveTotal: 0,
      acePctText: '0%',
      aceErrorRatioText: '0:0',
      serveInPctText: '0%',
      serveErrorPctText: '0%',
      serveEfficiency: 0,
      serveEfficiencyText: '.000',

      passTotal: 0,
      passAvgText: '0.00',
      pass3PctText: '0%',
      pass2PctText: '0%',
      pass1PctText: '0%',
      pass0PctText: '0%',

      totalErrors: 0,
      defenseImpact: 0,
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

      if (key === 'kill') base.counts.kill += 1;
      else if (key === 'attack') base.counts.attack += 1;

      else if (key === 'servein') base.counts.serveIn += 1;
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

      else if (key === 'attackerror') base.counts.attackError += 1;
      else if (key === 'net') base.counts.net += 1;
      else if (key === 'ballhandlingerror') base.counts.ballHandlingError += 1;
      else if (key === 'error') base.counts.error += 1;

      else if (key === 'touch') base.counts.touch += 1;
      else if (key === 'firstball') base.counts.firstBall += 1;
      else if (key === 'bump') base.counts.bump += 1;
    }
  }

  const kills = base.counts.kill;
  const attacks = base.counts.attack;
  const attackErrors = base.counts.attackError;

  // Kill and attackError both count as attack attempts.
  const attackAttempts = attacks + kills + attackErrors;

  const serveTotal =
    base.counts.serveIn + base.counts.ace + base.counts.serveError;

  const passTotal =
    base.counts.pass3 +
    base.counts.pass2 +
    base.counts.pass1 +
    base.counts.pass0;

  const totalErrors =
    base.counts.attackError +
    base.counts.serveError +
    base.counts.net +
    base.counts.ballHandlingError +
    base.counts.error;

  const defenseImpact =
    base.counts.dig + base.counts.block + base.counts.touch + base.counts.firstBall;

  const hittingPct = attackAttempts
    ? (kills - attackErrors) / attackAttempts
    : 0;

  const serveEfficiency = serveTotal
    ? (base.counts.ace - base.counts.serveError) / serveTotal
    : 0;

  const passPoints =
    base.counts.pass3 * 3 +
    base.counts.pass2 * 2 +
    base.counts.pass1 * 1 +
    base.counts.pass0 * 0;

  base.derived.attackAttempts = attackAttempts;
  base.derived.hittingPct = hittingPct;
  base.derived.hittingPctText = decimal3(hittingPct);
  base.derived.killPctText = pctText(kills, attackAttempts);

  base.derived.serveTotal = serveTotal;
  base.derived.acePctText = pctText(base.counts.ace, serveTotal);
  base.derived.aceErrorRatioText = `${base.counts.ace}:${base.counts.serveError}`;
  base.derived.serveInPctText = pctText(
    base.counts.serveIn + base.counts.ace,
    serveTotal,
  );
  base.derived.serveErrorPctText = pctText(base.counts.serveError, serveTotal);
  base.derived.serveEfficiency = serveEfficiency;
  base.derived.serveEfficiencyText = signedDecimal3(serveEfficiency);

  base.derived.passTotal = passTotal;
  base.derived.passAvgText = passTotal
    ? (passPoints / passTotal).toFixed(2)
    : '0.00';
  base.derived.pass3PctText = pctText(base.counts.pass3, passTotal);
  base.derived.pass2PctText = pctText(base.counts.pass2, passTotal);
  base.derived.pass1PctText = pctText(base.counts.pass1, passTotal);
  base.derived.pass0PctText = pctText(base.counts.pass0, passTotal);

  base.derived.totalErrors = totalErrors;
  base.derived.defenseImpact = defenseImpact;

  return base;
}