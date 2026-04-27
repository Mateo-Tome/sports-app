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

function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 104,
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        backgroundColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.68)',
          fontSize: 11,
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: 'white',
          fontSize: 24,
          fontWeight: '900',
          marginTop: 6,
        }}
      >
        {String(value)}
      </Text>

      {!!sub && (
        <Text
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 11,
            fontWeight: '800',
            marginTop: 4,
          }}
        >
          {sub}
        </Text>
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: 'white',
        fontSize: 15,
        fontWeight: '900',
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

function BarRow({
  label,
  value,
  pct,
}: {
  label: string;
  value: string | number;
  pct: number;
}) {
  const safePct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  return (
    <View style={{ marginBottom: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 5,
          gap: 10,
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '900', flex: 1 }}>
          {label}
        </Text>
        <Text style={{ color: 'white', fontWeight: '900' }}>{value}</Text>
      </View>

      <View
        style={{
          height: 9,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.10)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${safePct}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: 'rgba(34,211,238,0.95)',
          }}
        />
      </View>
    </View>
  );
}

function PeriodRow({
  label,
  td,
  tdPct,
  esc,
  rev,
  nf,
  pts,
}: {
  label: string;
  td: number;
  tdPct: number;
  esc: number;
  rev: number;
  nf: number;
  pts: number;
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.045)',
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>
          {label}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '900' }}>
          {pts} pts
        </Text>
      </View>

      <BarRow label="TD share" value={`${td} TD • ${tdPct}%`} pct={tdPct} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="TD" value={td} />
        <Chip label="ESC" value={esc} />
        <Chip label="REV" value={rev} />
        <Chip label="NF" value={nf} />
      </View>
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

function normalizeFolkstyle(w: any) {
  const scoring = w?.scoring ?? {};

  const nf2 = clamp0(scoring?.nearfall2?.myKid);
  const nf3 = clamp0(scoring?.nearfall3?.myKid);
  const nf4 = clamp0(scoring?.nearfall4?.myKid);
  const nfTotal = nf2 + nf3 + nf4;

  const derived = w?.derived ?? {};
  const periods = w?.periods ?? {};

  const breakdown = derived?.pointBreakdown ?? {};
  const breakdownPct = derived?.pointBreakdownPct ?? {};
  const tdShare = derived?.takedownPeriodSharePct ?? {};

  return {
    clips: clamp0(w?.totals?.clips),
    events: clamp0(w?.totals?.events),

    myPoints: clamp0(scoring?.myKidPoints),
    oppPoints: clamp0(scoring?.opponentPoints),

    td: clamp0(scoring?.takedown?.myKid),
    esc: clamp0(scoring?.escape?.myKid),
    rev: clamp0(scoring?.reversal?.myKid),
    nf2,
    nf3,
    nf4,
    nfTotal,
    pins: clamp0(scoring?.pins?.myKid),

    tdPerMatch: derived?.takedownsPerMatch ?? 0,
    escPerMatch: derived?.escapesPerMatch ?? 0,
    revPerMatch: derived?.reversalsPerMatch ?? 0,
    nfPerMatch: derived?.nearfallEventsPerMatch ?? 0,
    myPointsPerMatch: derived?.myPointsPerMatch ?? 0,
    oppPointsPerMatch: derived?.opponentPointsPerMatch ?? 0,
    pinRateText: String(derived?.pinRateText ?? '0%'),

    pointBreakdown: {
      takedown: clamp0(breakdown?.takedown),
      escape: clamp0(breakdown?.escape),
      reversal: clamp0(breakdown?.reversal),
      nearfall: clamp0(breakdown?.nearfall),
      penalty: clamp0(breakdown?.penalty),
      other: clamp0(breakdown?.other),
    },

    pointBreakdownPct: {
      takedown: clamp0(breakdownPct?.takedown),
      escape: clamp0(breakdownPct?.escape),
      reversal: clamp0(breakdownPct?.reversal),
      nearfall: clamp0(breakdownPct?.nearfall),
      penalty: clamp0(breakdownPct?.penalty),
      other: clamp0(breakdownPct?.other),
    },

    tdShare: {
      p1: clamp0(tdShare?.p1),
      p2: clamp0(tdShare?.p2),
      p3: clamp0(tdShare?.p3),
      ot: clamp0(tdShare?.ot),
    },

    periods: {
      p1: periods?.p1 ?? {},
      p2: periods?.p2 ?? {},
      p3: periods?.p3 ?? {},
      ot: periods?.ot ?? {},
    },
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

  const ipText = safeStr(p?.derived?.inningsPitchedText, '');
  const bf =
    p?.derived?.battersFaced != null ? clamp0(p?.derived?.battersFaced) : 0;
  const pitches =
    p?.derived?.totalPitches != null
      ? clamp0(p?.derived?.totalPitches)
      : balls + strikes + fouls;

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
    p?.derived?.hitsTotalAllowed != null
      ? clamp0(p?.derived?.hitsTotalAllowed)
      : hitsAllowed + hrAllowed;

  const walksIssued = clamp0(p?.counts?.walk);
  const strikeouts = clamp0(p?.counts?.strikeout);

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

function normalizeVolleyballDefault(v: any) {
  return {
    clips: clamp0(v?.totals?.clips),
    events: clamp0(v?.totals?.events),

    attack: clamp0(v?.counts?.attack),
    kill: clamp0(v?.counts?.kill),
    killPct: safeStr(v?.derived?.killPctText, '0%'),

    serveIn: clamp0(v?.counts?.serveIn),
    ace: clamp0(v?.counts?.ace),
    serveError: clamp0(v?.counts?.serveError),
    acePct: safeStr(v?.derived?.acePctText, '0%'),
    serveInPct: safeStr(v?.derived?.serveInPctText, '0%'),
    serveErrorPct: safeStr(v?.derived?.serveErrorPctText, '0%'),

    block: clamp0(v?.counts?.block),
    dig: clamp0(v?.counts?.dig),

    pass3: clamp0(v?.counts?.pass3),
    pass2: clamp0(v?.counts?.pass2),
    pass1: clamp0(v?.counts?.pass1),
    pass0: clamp0(v?.counts?.pass0),
    passAvg: safeStr(v?.derived?.passAvgText, '0.00'),
    pass3Pct: safeStr(v?.derived?.pass3PctText, '0%'),
    pass2Pct: safeStr(v?.derived?.pass2PctText, '0%'),
    pass1Pct: safeStr(v?.derived?.pass1PctText, '0%'),
    pass0Pct: safeStr(v?.derived?.pass0PctText, '0%'),

    error: clamp0(v?.counts?.error),
    net: clamp0(v?.counts?.net),

    touch: clamp0(v?.counts?.touch),
    firstBall: clamp0(v?.counts?.firstBall),
    bump: clamp0(v?.counts?.bump),
  };
}

function normalizeBjjDefault(b: any) {
  return {
    clips: clamp0(b?.totals?.clips),
    events: clamp0(b?.totals?.events),

    takedown: clamp0(b?.counts?.takedown),
    sweep: clamp0(b?.counts?.sweep),
    kob: clamp0(b?.counts?.knee_on_belly),
    pass: clamp0(b?.counts?.guard_pass),
    mount: clamp0(b?.counts?.mount),
    back: clamp0(b?.counts?.back_control),

    advantage: clamp0(b?.counts?.advantage),
    penalty: clamp0(b?.counts?.penalty),

    finish: clamp0(b?.counts?.finish),

    athletePts: safeStr(b?.derived?.scoreForAthleteText, '0 pts'),
    oppPts: safeStr(b?.derived?.scoreForOpponentText, '0 pts'),
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
  if (sportKey.startsWith('bjj:')) {
    const b = normalizeBjjDefault(sportStats);

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={b.clips} />
          <Chip label="Events" value={b.events} />
          <Chip label="Home pts" value={b.athletePts} />
          <Chip label="Opp pts" value={b.oppPts} />
          <Chip label="TD" value={b.takedown} />
          <Chip label="Sweep" value={b.sweep} />
          <Chip label="KOB" value={b.kob} />
          <Chip label="Pass" value={b.pass} />
          <Chip label="Mount" value={b.mount} />
          <Chip label="Back" value={b.back} />
          <Chip label="Adv" value={b.advantage} />
          <Chip label="Pen" value={b.penalty} />
          <Chip label="Finishes" value={b.finish} />
        </View>
      </CardShell>
    );
  }

  if (sportKey === 'baseball:hitting') {
    const b = normalizeBaseballHitting(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
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

  if (sportKey === 'baseball:pitching') {
    const p = normalizeBaseballPitching(sportStats);
    const hasDerived =
      !!p.ipText || p.bf > 0 || p.pitches > 0 || !!p.whip || !!p.kPct || !!p.bbPct;

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
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

  if (sportKey === 'volleyball:default') {
    const v = normalizeVolleyballDefault(sportStats);
    const serveTotal = v.serveIn + v.ace + v.serveError;
    const passTotal = v.pass3 + v.pass2 + v.pass1 + v.pass0;

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={v.clips} />
          <Chip label="Events" value={v.events} />
          <Chip label="Kills" value={v.kill} />
          <Chip label="Attacks" value={v.attack + v.kill} />
          <Chip label="Kill %" value={v.killPct} />
          <Chip label="Serve Total" value={serveTotal} />
          <Chip label="Aces" value={v.ace} />
          <Chip label="Ace %" value={v.acePct} />
          <Chip label="Serve In %" value={v.serveInPct} />
          <Chip label="Serve Err %" value={v.serveErrorPct} />
          <Chip label="Blocks" value={v.block} />
          <Chip label="Digs" value={v.dig} />
          <Chip label="Pass Total" value={passTotal} />
          <Chip label="Pass Avg" value={v.passAvg} />
          <Chip label="3s" value={`${v.pass3} (${v.pass3Pct})`} />
          <Chip label="2s" value={`${v.pass2} (${v.pass2Pct})`} />
          <Chip label="1s" value={`${v.pass1} (${v.pass1Pct})`} />
          <Chip label="0s" value={`${v.pass0} (${v.pass0Pct})`} />
          <Chip label="Errors" value={v.error} />
          <Chip label="Net" value={v.net} />
          <Chip label="Touch" value={v.touch} />
          <Chip label="1st Ball" value={v.firstBall} />
          <Chip label="Bump" value={v.bump} />
        </View>
      </CardShell>
    );
  }

  if (sportKey === 'wrestling:folkstyle') {
    const w = normalizeFolkstyle(sportStats);

    const p = (key: 'p1' | 'p2' | 'p3' | 'ot') => {
      const row = w.periods?.[key] ?? {};
      return {
        td: clamp0(row?.takedown?.myKid),
        tdPct: clamp0(w.tdShare?.[key]),
        esc: clamp0(row?.escape?.myKid),
        rev: clamp0(row?.reversal?.myKid),
        nf: clamp0(row?.nearfall?.myKid),
        pts: clamp0(row?.myKidPoints),
      };
    };

    const p1 = p('p1');
    const p2 = p('p2');
    const p3 = p('p3');
    const ot = p('ot');

    const hasOt = ot.td + ot.esc + ot.rev + ot.nf + ot.pts > 0;

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <HeroStat label="Pts / Match" value={`${w.myPointsPerMatch} avg`} sub={`${w.myPoints} total`} />
          <HeroStat label="TD / Match" value={`${w.tdPerMatch} avg`} sub={`${w.td} takedowns`} />
          <HeroStat label="Pin Rate" value={w.pinRateText} sub={`${w.pins} pins`} />
        </View>

        <SectionTitle>Scoring breakdown</SectionTitle>

        <BarRow
          label="Takedown points"
          value={`${w.pointBreakdown.takedown} pts • ${w.pointBreakdownPct.takedown}%`}
          pct={w.pointBreakdownPct.takedown}
        />
        <BarRow
          label="Escape points"
          value={`${w.pointBreakdown.escape} pts • ${w.pointBreakdownPct.escape}%`}
          pct={w.pointBreakdownPct.escape}
        />
        <BarRow
          label="Reversal points"
          value={`${w.pointBreakdown.reversal} pts • ${w.pointBreakdownPct.reversal}%`}
          pct={w.pointBreakdownPct.reversal}
        />
        <BarRow
          label="Nearfall points"
          value={`${w.pointBreakdown.nearfall} pts • ${w.pointBreakdownPct.nearfall}%`}
          pct={w.pointBreakdownPct.nearfall}
        />
        <BarRow
          label="Other / penalty points"
          value={`${w.pointBreakdown.penalty + w.pointBreakdown.other} pts`}
          pct={w.pointBreakdownPct.penalty + w.pointBreakdownPct.other}
        />

       

        <SectionTitle>Period breakdown</SectionTitle>

        <PeriodRow label="Period 1" td={p1.td} tdPct={p1.tdPct} esc={p1.esc} rev={p1.rev} nf={p1.nf} pts={p1.pts} />
        <PeriodRow label="Period 2" td={p2.td} tdPct={p2.tdPct} esc={p2.esc} rev={p2.rev} nf={p2.nf} pts={p2.pts} />
        <PeriodRow label="Period 3" td={p3.td} tdPct={p3.tdPct} esc={p3.esc} rev={p3.rev} nf={p3.nf} pts={p3.pts} />

        {hasOt ? (
          <PeriodRow label="Overtime" td={ot.td} tdPct={ot.tdPct} esc={ot.esc} rev={ot.rev} nf={ot.nf} pts={ot.pts} />
        ) : null}

        <SectionTitle>Totals</SectionTitle>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={w.clips} />
          <Chip label="Events" value={w.events} />
          <Chip label="Total Points" value={w.myPoints} />
          <Chip label="Opp Points" value={w.oppPoints} />
          <Chip label="Takedowns" value={w.td} />
          <Chip label="Escapes" value={w.esc} />
          <Chip label="Reversals" value={w.rev} />
          <Chip label="Nearfall Total" value={w.nfTotal} />
          <Chip label="NF2" value={w.nf2} />
          <Chip label="NF3" value={w.nf3} />
          <Chip label="NF4" value={w.nf4} />
          <Chip label="Pins" value={w.pins} />
          <Chip label="ESC / Match" value={`${w.escPerMatch} avg`} />
          <Chip label="REV / Match" value={`${w.revPerMatch} avg`} />
          <Chip label="NF / Match" value={`${w.nfPerMatch} avg`} />
        </View>
      </CardShell>
    );
  }

  if (sportKey === 'wrestling:freestyle') {
    const fs = normalizeFreestyle(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
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

  if (sportKey === 'wrestling:greco') {
    const gs = normalizeGreco(sportStats);
    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
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

  if (sportKey === 'basketball:default') {
    const b = normalizeBasketballDefault(sportStats);

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
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

  const g = normalizeGeneric(sportStats);

  return (
    <CardShell title={sportTitle(sportKey)}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
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
        (Generic view) Add a custom card for this sportKey later if you want richer stats.
      </Text>
    </CardShell>
  );
}