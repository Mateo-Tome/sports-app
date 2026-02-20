import React from 'react';
import { Text, View } from 'react-native';
import { sportTitle } from '../sportMeta';

function CardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        marginTop: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 14,
      }}
    >
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }}>
        {title}
      </Text>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        minWidth: 120,
        flexGrow: 1,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.70)',
          fontSize: 12,
          fontWeight: '900',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: 'white',
          fontSize: 18,
          fontWeight: '900',
          marginTop: 4,
        }}
      >
        {String(value)}
      </Text>
    </View>
  );
}

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function safeStr(v: any, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

// -----------------------------
// Normalize helpers (safe)
// -----------------------------

function normalizeFolkstyle(w: any) {
  const scoring = w?.scoring;
  if (scoring) {
    return {
      myPoints: clamp0(scoring?.myKidPoints),
      td: clamp0(scoring?.takedown?.myKid),
      esc: clamp0(scoring?.escape?.myKid),
      rev: clamp0(scoring?.reversal?.myKid),
      nf2: clamp0(scoring?.nearfall2?.myKid),
      nf3: clamp0(scoring?.nearfall3?.myKid),
      nf4: clamp0(scoring?.nearfall4?.myKid),
      pins: clamp0(scoring?.pins?.myKid),
    };
  }

  return {
    myPoints: clamp0(w?.points?.athlete),
    td: clamp0(w?.counts?.athlete?.takedown),
    esc: clamp0(w?.counts?.athlete?.escape),
    rev: clamp0(w?.counts?.athlete?.reversal),
    nf2: clamp0(w?.counts?.athlete?.nf2),
    nf3: clamp0(w?.counts?.athlete?.nf3),
    nf4: clamp0(w?.counts?.athlete?.nf4),
    pins: clamp0(w?.counts?.athlete?.pin),
  };
}

function normalizeFreestyle(fs: any) {
  return {
    clips: clamp0(fs?.totals?.clips),
    events: clamp0(fs?.totals?.events),
    myPoints: clamp0(fs?.points?.myKid),
    oppPoints: clamp0(fs?.points?.opp),

    td: clamp0(fs?.counts?.takedown?.myKid),
    ex: clamp0(fs?.counts?.exposure?.myKid),
    ob: clamp0(fs?.counts?.out?.myKid),

    ftd4: clamp0(fs?.counts?.feetToDanger?.myKid),
    ga4: clamp0(fs?.counts?.ga4?.myKid),
    ga5: clamp0(fs?.counts?.ga5?.myKid),

    passWarn: clamp0(fs?.counts?.passWarn?.myKid),
    passP1Given: clamp0(fs?.counts?.passPlus1Given?.myKid),
    penP1Given: clamp0(fs?.counts?.penaltyPlus1Given?.myKid),
    fleeP1Given: clamp0(fs?.counts?.fleePlus1Given?.myKid),
    fleeP2Given: clamp0(fs?.counts?.fleePlus2Given?.myKid),
  };
}

function normalizeGreco(gs: any) {
  const f = normalizeFreestyle(gs);
  return {
    ...f,
    legP2Given: clamp0(gs?.counts?.defLegFoulPlus2Given?.myKid),
  };
}

// ✅ Baseball: Hitting (includes BA)
function normalizeBaseballHitting(b: any) {
  const derivedHits =
    b?.derived?.hits != null
      ? clamp0(b.derived.hits)
      : clamp0(b?.counts?.hit) + clamp0(b?.counts?.homerun);

  const derivedAtBats =
    b?.derived?.atBats != null ? clamp0(b.derived.atBats) : 0;

  const baText = String(b?.derived?.battingAverageText ?? '.000');

  return {
    clips: clamp0(b?.totals?.clips),
    events: clamp0(b?.totals?.events),

    hitsTotal: derivedHits,
    atBats: derivedAtBats,
    baText,

    balls: clamp0(b?.counts?.ball),
    strikes: clamp0(b?.counts?.strike),
    fouls: clamp0(b?.counts?.foul),

    walks: clamp0(b?.counts?.walk),
    strikeouts: clamp0(b?.counts?.strikeout),

    hits: clamp0(b?.counts?.hit),
    single: clamp0(b?.counts?.hitTypes?.single),
    double: clamp0(b?.counts?.hitTypes?.double),
    triple: clamp0(b?.counts?.hitTypes?.triple),
    homerun: clamp0(b?.counts?.homerun),
    bunt: clamp0(b?.counts?.hitTypes?.bunt),

    outs: clamp0(b?.counts?.out),
  };
}

function normalizeBaseballPitching(p: any) {
  const balls = clamp0(p?.counts?.ball);
  const strikes = clamp0(p?.counts?.strike);
  const fouls = clamp0(p?.counts?.foul);

  // Prefer reducer-derived metrics if present
  const ipText = safeStr(p?.derived?.inningsPitchedText, '');
  const bf = p?.derived?.battersFaced != null ? clamp0(p?.derived?.battersFaced) : 0;
  const pitches = p?.derived?.totalPitches != null ? clamp0(p?.derived?.totalPitches) : (balls + strikes + fouls);

  const strikePct = safeStr(p?.derived?.strikePctText, '');
  const ballPct = safeStr(p?.derived?.ballPctText, '');
  const kPct = safeStr(p?.derived?.kPctText, '');
  const bbPct = safeStr(p?.derived?.bbPctText, '');
  const kbb = safeStr(p?.derived?.kbbText, '');
  const whip = safeStr(p?.derived?.whipText, '');
  const pPerBF = safeStr(p?.derived?.pitchesPerBFText, '');
  const pPerInning = safeStr(p?.derived?.pitchesPerInningText, '');

  const hitsAllowed = clamp0(p?.counts?.hitAllowed);
  const hrAllowed = clamp0(p?.counts?.homerunAllowed);
  const hitsTotalAllowed =
    p?.derived?.hitsTotalAllowed != null ? clamp0(p?.derived?.hitsTotalAllowed) : (hitsAllowed + hrAllowed);

  const walksIssued = clamp0(p?.counts?.walk);
  const strikeouts = clamp0(p?.counts?.strikeout);

  // Outs recorded: prefer derived "outsRecordedTotal" (includes K)
  const outsRecordedTotal =
    p?.derived?.outsRecordedTotal != null
      ? clamp0(p?.derived?.outsRecordedTotal)
      : clamp0(p?.counts?.outRecorded) + strikeouts;

  return {
    clips: clamp0(p?.totals?.clips),
    events: clamp0(p?.totals?.events),

    balls,
    strikes,
    fouls,

    walksIssued,
    strikeouts,

    hitsAllowed,
    hitsTotalAllowed,

    singleAllowed: clamp0(p?.counts?.hitTypes?.single),
    doubleAllowed: clamp0(p?.counts?.hitTypes?.double),
    tripleAllowed: clamp0(p?.counts?.hitTypes?.triple),
    buntAllowed: clamp0(p?.counts?.hitTypes?.bunt),

    hrAllowed,

    outsRecordedTotal,
    ipText,
    bf,
    pitches,

    strikePct,
    ballPct,
    kPct,
    bbPct,
    kbb,
    whip,
    pPerBF,
    pPerInning,
  };
}

function normalizeGeneric(s: any) {
  const clips =
    s?.totals?.clips ??
    s?.totals?.videos ??
    s?.totals?.matches ??
    s?.totals?.games ??
    s?.totals?.sessions ??
    null;

  const events = s?.totals?.events ?? s?.totals?.eventCount ?? null;

  const myPoints =
    s?.points?.myKid ?? s?.points?.athlete ?? s?.points?.home ?? null;

  const oppPoints = s?.points?.opp ?? s?.points?.opponent ?? null;

  return {
    clips: clips != null ? clamp0(clips) : null,
    events: events != null ? clamp0(events) : null,
    myPoints: myPoints != null ? clamp0(myPoints) : null,
    oppPoints: oppPoints != null ? clamp0(oppPoints) : null,
  };
}

// ✅ Basketball normalization (from your reducer shape)
function normalizeBasketballDefault(b: any) {
  return {
    clips: clamp0(b?.totals?.clips),
    events: clamp0(b?.totals?.events),

    points: clamp0(b?.points?.total),

    fgM: clamp0(b?.shooting?.fgM),
    fgA: clamp0(b?.shooting?.fgA),
    t3M: clamp0(b?.shooting?.t3M),
    t3A: clamp0(b?.shooting?.t3A),
    ftM: clamp0(b?.shooting?.ftM),
    ftA: clamp0(b?.shooting?.ftA),

    ast: clamp0(b?.counts?.assist),
    stl: clamp0(b?.counts?.steal),
    blk: clamp0(b?.counts?.block),
    rebO: clamp0(b?.counts?.reboundOff),
    rebD: clamp0(b?.counts?.reboundDef),
    tov: clamp0(b?.counts?.turnover),
    foul: clamp0(b?.counts?.foul),
  };
}

function pct(m: number, a: number) {
  if (!a) return '0%';
  return `${Math.round((m / a) * 100)}%`;
}

export function renderSportStatsCard(
  sportKey: string,
  sportStats: any,
  athleteName: string,
) {
  // -----------------------------
  // Baseball: Hitting
  // -----------------------------
  if (sportKey === 'baseball:hitting') {
    const b = normalizeBaseballHitting(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '800',
            marginBottom: 10,
          }}
        >
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={b.clips} />
          <Chip label="Events" value={b.events} />

          <Chip label="BA" value={b.baText} />
          <Chip label="AB" value={b.atBats} />
          <Chip label="H" value={b.hitsTotal} />

          <Chip label="Balls" value={b.balls} />
          <Chip label="Strikes" value={b.strikes} />
          <Chip label="Fouls" value={b.fouls} />

          <Chip label="Walks" value={b.walks} />
          <Chip label="Strikeouts" value={b.strikeouts} />

          <Chip label="Hits (non-HR)" value={b.hits} />
          <Chip label="1B" value={b.single} />
          <Chip label="2B" value={b.double} />
          <Chip label="3B" value={b.triple} />
          <Chip label="HR" value={b.homerun} />
          <Chip label="Bunt" value={b.bunt} />

          <Chip label="Outs" value={b.outs} />
        </View>
      </CardShell>
    );
  }

  // -----------------------------
  // Baseball: Pitching (enhanced)
  // -----------------------------
  if (sportKey === 'baseball:pitching') {
    const p = normalizeBaseballPitching(sportStats);

    const hasDerived =
      !!p.ipText ||
      p.bf > 0 ||
      p.pitches > 0 ||
      !!p.whip ||
      !!p.kPct ||
      !!p.bbPct;

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '800',
            marginBottom: 10,
          }}
        >
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={p.clips} />
          <Chip label="Events" value={p.events} />

          {hasDerived ? <Chip label="IP" value={p.ipText || '0.0'} /> : null}
          {hasDerived ? <Chip label="BF" value={p.bf || 0} /> : null}
          {hasDerived ? <Chip label="Pitches" value={p.pitches || 0} /> : null}

          <Chip label="Balls" value={p.balls} />
          <Chip label="Strikes" value={p.strikes} />
          <Chip label="Fouls" value={p.fouls} />

          {hasDerived && p.strikePct ? <Chip label="Strike %" value={p.strikePct} /> : null}
          {hasDerived && p.ballPct ? <Chip label="Ball %" value={p.ballPct} /> : null}

          <Chip label="Walks Issued" value={p.walksIssued} />
          <Chip label="Strikeouts" value={p.strikeouts} />

          {hasDerived && p.kPct ? <Chip label="K%" value={p.kPct} /> : null}
          {hasDerived && p.bbPct ? <Chip label="BB%" value={p.bbPct} /> : null}
          {hasDerived && p.kbb ? <Chip label="K/BB" value={p.kbb} /> : null}

          <Chip label="Hits Allowed (non-HR)" value={p.hitsAllowed} />
          <Chip label="Hits Allowed (total)" value={p.hitsTotalAllowed} />

          <Chip label="1B Allowed" value={p.singleAllowed} />
          <Chip label="2B Allowed" value={p.doubleAllowed} />
          <Chip label="3B Allowed" value={p.tripleAllowed} />
          <Chip label="HR Allowed" value={p.hrAllowed} />
          <Chip label="Bunt Allowed" value={p.buntAllowed} />

          {hasDerived && p.whip ? <Chip label="WHIP" value={p.whip} /> : null}
          {hasDerived && p.pPerBF ? <Chip label="Pitches/BF" value={p.pPerBF} /> : null}
          {hasDerived && p.pPerInning ? <Chip label="Pitches/Inning" value={p.pPerInning} /> : null}

          <Chip label="Outs Recorded" value={p.outsRecordedTotal} />
        </View>
      </CardShell>
    );
  }

  // -----------------------------
  // Wrestling: Folkstyle
  // -----------------------------
  if (sportKey === 'wrestling:folkstyle') {
    const w = normalizeFolkstyle(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Total Points" value={w.myPoints} />
          <Chip label="Takedowns" value={w.td} />
          <Chip label="Escapes" value={w.esc} />
          <Chip label="Reversals" value={w.rev} />
          <Chip label="NF2" value={w.nf2} />
          <Chip label="NF3" value={w.nf3} />
          <Chip label="NF4" value={w.nf4} />
          <Chip label="Pins" value={w.pins} />
        </View>
      </CardShell>
    );
  }

  // -----------------------------
  // Wrestling: Freestyle
  // -----------------------------
  if (sportKey === 'wrestling:freestyle') {
    const fs = normalizeFreestyle(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '800',
            marginBottom: 10,
          }}
        >
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={fs.clips} />
          <Chip label="Events" value={fs.events} />
          <Chip label="My Points" value={fs.myPoints} />
          <Chip label="Opp Points" value={fs.oppPoints} />

          <Chip label="TD2" value={fs.td} />
          <Chip label="EX2" value={fs.ex} />
          <Chip label="OB1" value={fs.ob} />

          <Chip label="FTD4" value={fs.ftd4} />
          <Chip label="GA4" value={fs.ga4} />
          <Chip label="GA5" value={fs.ga5} />

          <Chip label="PASS WARN" value={fs.passWarn} />
          <Chip label="PASS +1 (given)" value={fs.passP1Given} />
          <Chip label="PEN +1 (given)" value={fs.penP1Given} />
          <Chip label="FLEE +1 (given)" value={fs.fleeP1Given} />
          <Chip label="FLEE +2 (given)" value={fs.fleeP2Given} />
        </View>
      </CardShell>
    );
  }

  // -----------------------------
  // Wrestling: Greco
  // -----------------------------
  if (sportKey === 'wrestling:greco') {
    const gs = normalizeGreco(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '800',
            marginBottom: 10,
          }}
        >
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={gs.clips} />
          <Chip label="Events" value={gs.events} />
          <Chip label="My Points" value={gs.myPoints} />
          <Chip label="Opp Points" value={gs.oppPoints} />

          <Chip label="TD2" value={gs.td} />
          <Chip label="EX2" value={gs.ex} />
          <Chip label="OB1" value={gs.ob} />

          <Chip label="FTD4" value={gs.ftd4} />
          <Chip label="GA4" value={gs.ga4} />
          <Chip label="GA5" value={gs.ga5} />

          <Chip label="DEF LEG +2 (given)" value={gs.legP2Given} />
        </View>
      </CardShell>
    );
  }

  // -----------------------------
  // ✅ Basketball: Default
  // -----------------------------
  if (sportKey === 'basketball:default') {
    const b = normalizeBasketballDefault(sportStats);

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '800',
            marginBottom: 10,
          }}
        >
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={b.clips} />
          <Chip label="Events" value={b.events} />

          <Chip label="Points" value={b.points} />

          <Chip label="FG" value={`${b.fgM}/${b.fgA} (${pct(b.fgM, b.fgA)})`} />
          <Chip label="3PT" value={`${b.t3M}/${b.t3A} (${pct(b.t3M, b.t3A)})`} />
          <Chip label="FT" value={`${b.ftM}/${b.ftA} (${pct(b.ftM, b.ftA)})`} />

          <Chip label="AST" value={b.ast} />
          <Chip label="STL" value={b.stl} />
          <Chip label="BLK" value={b.blk} />

          <Chip label="REB (O)" value={b.rebO} />
          <Chip label="REB (D)" value={b.rebD} />

          <Chip label="TO" value={b.tov} />
          <Chip label="Fouls" value={b.foul} />
        </View>
      </CardShell>
    );
  }

  // -----------------------------
  // Generic fallback
  // -----------------------------
  const g = normalizeGeneric(sportStats);

  return (
    <CardShell title={sportTitle(sportKey)}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.75)',
          fontWeight: '800',
          marginBottom: 10,
        }}
      >
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="sportKey" value={sportKey} />
        {g.clips != null ? <Chip label="Clips" value={g.clips} /> : null}
        {g.events != null ? <Chip label="Events" value={g.events} /> : null}
        {g.myPoints != null ? <Chip label="My Points" value={g.myPoints} /> : null}
        {g.oppPoints != null ? <Chip label="Opp Points" value={g.oppPoints} /> : null}
      </View>

      <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10 }}>
        (Generic view) Add a custom card for this sportKey later if you want
        richer stats.
      </Text>
    </CardShell>
  );
}