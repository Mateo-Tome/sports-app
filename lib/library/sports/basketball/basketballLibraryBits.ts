// lib/library/sports/basketball/basketballLibraryBits.ts
import { registerSportLibraryBits } from '../../sportLibraryStyleRegistry';

type AnyEvent = {
  key?: string;
  value?: number | null; // points for made shots (or 0)
  meta?: any;
};

const GREEN = '#16a34a';
const YELLOW = '#eab308';
const RED = '#dc2626';

function normShotType(meta: any): '2' | '3' | 'ft' {
  const raw = String(meta?.shotType ?? '').toLowerCase();
  if (raw === 'ft' || raw === 'free' || raw === 'freethrow' || raw === '1' || raw === '1pt') return 'ft';
  if (raw === '3' || raw === '3pt' || raw === '3pt.' || raw === 'three' || raw === '3ptshot') return '3';
  // your overlay uses '2PT' => '2pt' => falls here (good)
  return '2';
}

function normRebKind(meta: any): 'off' | 'def' {
  // overlay sends { rebound: 'off' | 'def' }
  const r = String(meta?.rebound ?? meta?.kind ?? meta?.type ?? '').toLowerCase();
  if (r.startsWith('o')) return 'off';
  return 'def';
}

/**
 * Basketball grading (consistent + coach-friendly):
 * - Badge shows the box-score bits people understand: "PTS 7 • FG 3/3 • FT 1/2 • TO 0"
 * - Border color uses a possession-ish normalized impact with shrinkage so short clips don't lie
 * - No gray ever: only red / yellow / green (+ optional gold)
 * - Gold = elite clip: no TO, high efficiency, enough volume, + at least one impact play
 */
function gradeBasketballClip(events: AnyEvent[]) {
  let pts = 0;

  let fga = 0;
  let fgm = 0;

  let fta = 0;
  let ftm = 0;

  let tos = 0;
  let fouls = 0;

  let ast = 0;
  let stl = 0;
  let blk = 0;
  let rebOff = 0;
  let rebDef = 0;

  for (const e of Array.isArray(events) ? events : []) {
    const key = String(e?.key || '').toLowerCase();
    const meta = e?.meta || {};
    const v = typeof e?.value === 'number' ? e.value : 0;

    if (key === 'shot') {
      const made = !!meta.made;
      const t = normShotType(meta);

      if (t === 'ft') {
        fta += 1;
        if (made) ftm += 1;
      } else {
        fga += 1;
        if (made) fgm += 1;
      }

      if (made) {
        const p = v > 0 ? v : t === '3' ? 3 : t === 'ft' ? 1 : 2;
        pts += p;
      }
      continue;
    }

    if (key === 'turnover') {
      tos += 1;
      continue;
    }

    if (key === 'foul') {
      fouls += 1;
      continue;
    }

    if (key === 'assist') {
      ast += 1;
      continue;
    }
    if (key === 'steal') {
      stl += 1;
      continue;
    }
    if (key === 'block') {
      blk += 1;
      continue;
    }

    if (key === 'rebound') {
      const k = normRebKind(meta);
      if (k === 'off') rebOff += 1;
      else rebDef += 1;
      continue;
    }
  }

  // --- badge (coach-friendly, compact) ---
  const badgeParts: string[] = [];
  badgeParts.push(`PTS ${pts}`);
  badgeParts.push(`FG ${fgm}/${fga}`);
  if (fta > 0) badgeParts.push(`FT ${ftm}/${fta}`);
  badgeParts.push(`TO ${tos}`);
  // add “impact” stats only if present (keeps pill from becoming a novel)
  if (stl > 0) badgeParts.push(`STL ${stl}`);
  if (ast > 0) badgeParts.push(`AST ${ast}`);
  if (blk > 0) badgeParts.push(`BLK ${blk}`);
  if (rebOff + rebDef > 0) badgeParts.push(`REB ${rebOff + rebDef}`);
  const badgeText = badgeParts.join(' • ');

  // If literally nothing happened, neutral yellow
  if (!events || events.length === 0) {
    return { edgeColor: YELLOW, badgeText: 'PTS 0 • FG 0/0 • TO 0', badgeColor: YELLOW, highlightGold: false };
  }

  // --- scoring model ---
  // Possessions estimate (standard-ish): FGA + TO + 0.44*FTA
  const poss = fga + tos + 0.44 * fta;

  // Shrink so tiny clips don’t swing too hard (key for consistency)
  const possAdj = poss + 2;

  // Positives (hustle is real value, but less than points)
  const hustle =
    stl * 1.4 +
    blk * 1.0 +
    ast * 0.8 +
    rebOff * 0.9 +
    rebDef * 0.35;

  // Negatives
  const misses = (fga - fgm);
  const ftMisses = (fta - ftm);

  const penalty =
    tos * 2.2 +
    misses * 0.9 +
    ftMisses * 0.7 +
    fouls * 0.4;

  // Normalized impact score
  const impact = (pts + hustle - penalty) / possAdj;

  // --- color thresholds (tuned to feel sane) ---
  // These are intentionally not tiny, because we’re using possAdj shrink.
  let edgeColor = RED;
  if (impact >= 0.85) edgeColor = GREEN;
  else if (impact >= 0.35) edgeColor = YELLOW;
  else edgeColor = RED;

  // --- gold rules (elite) ---
  // You asked: perfect/elite shooting + no TO + some impact context.
  const fgPct = fga > 0 ? fgm / fga : 0;
  const ftPct = fta > 0 ? ftm / fta : 1;

  const hasImpactPlay = (stl + ast + blk + rebOff) >= 1;

  // Volume gate so “1 shot made” isn’t gold
  const enoughVolume = (fga >= 3) || (pts >= 7) || (poss >= 4);

  // “Elite efficiency”: either perfect, or near perfect with volume
  const eliteShooting =
    (fga >= 3 && fgPct >= 0.9) || (fga >= 4 && fgPct >= 0.8) || (fga > 0 && fgm === fga);

  const highlightGold =
    enoughVolume &&
    tos === 0 &&
    eliteShooting &&
    ftPct >= 0.9 &&
    hasImpactPlay;

  return {
    edgeColor,
    badgeText,
    badgeColor: edgeColor,
    highlightGold,
  };
}

type BuilderArgs = { sport: string; sidecar: any | null };

registerSportLibraryBits(
  (sport: string) => String(sport || '').toLowerCase().startsWith('basketball'),
  ({ sidecar }: BuilderArgs) => {
    const events = (sidecar?.events || sidecar?.data?.events || []) as AnyEvent[];
    const g = gradeBasketballClip(Array.isArray(events) ? events : []);

    return {
      edgeColor: g.edgeColor,
      badgeText: g.badgeText,
      badgeColor: g.badgeColor,
      highlightGold: g.highlightGold ? true : false,
    };
  },
);
