import React from 'react';
import { Text, View } from 'react-native';
import { sportTitle } from '../sportMeta';

import BaseballHittingStatsCard from './cards/BaseballHittingStatsCard';
import BaseballPitchingStatsCard from './cards/BaseballPitchingStatsCard';
import BasketballStatsCard from './cards/BasketballStatsCard';
import BjjStatsCard from './cards/BjjStatsCard';
import FolkstyleStatsCard from './cards/FolkstyleStatsCard';
import FreestyleStatsCard from './cards/FreestyleStatsCard';
import GrecoStatsCard from './cards/GrecoStatsCard';
import SoftballHittingStatsCard from './cards/SoftballHittingStatsCard';
import SoftballPitchingStatsCard from './cards/SoftballPitchingStatsCard';

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
        <Text
          style={{
            color: 'rgba(255,255,255,0.78)',
            fontWeight: '900',
            flex: 1,
          }}
        >
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

function normalizeVolleyballDefault(v: any) {
  return {
    clips: clamp0(v?.totals?.clips),
    events: clamp0(v?.totals?.events),

    attack: clamp0(v?.counts?.attack),
    kill: clamp0(v?.counts?.kill),
    killPct: safeStr(v?.derived?.killPctText, '0%'),

    attackAttempts: clamp0(v?.derived?.attackAttempts),
    hittingPct: safeStr(v?.derived?.hittingPctText, '.000'),

    serveIn: clamp0(v?.counts?.serveIn),
    ace: clamp0(v?.counts?.ace),
    serveError: clamp0(v?.counts?.serveError),
    serveTotal: clamp0(v?.derived?.serveTotal),
    acePct: safeStr(v?.derived?.acePctText, '0%'),
    aceErrorRatio: safeStr(v?.derived?.aceErrorRatioText, '0:0'),
    serveInPct: safeStr(v?.derived?.serveInPctText, '0%'),
    serveErrorPct: safeStr(v?.derived?.serveErrorPctText, '0%'),
    serveEfficiency: safeStr(v?.derived?.serveEfficiencyText, '.000'),

    block: clamp0(v?.counts?.block),
    dig: clamp0(v?.counts?.dig),

    pass3: clamp0(v?.counts?.pass3),
    pass2: clamp0(v?.counts?.pass2),
    pass1: clamp0(v?.counts?.pass1),
    pass0: clamp0(v?.counts?.pass0),
    passTotal: clamp0(v?.derived?.passTotal),
    passAvg: safeStr(v?.derived?.passAvgText, '0.00'),
    pass3Pct: safeStr(v?.derived?.pass3PctText, '0%'),
    pass2Pct: safeStr(v?.derived?.pass2PctText, '0%'),
    pass1Pct: safeStr(v?.derived?.pass1PctText, '0%'),
    pass0Pct: safeStr(v?.derived?.pass0PctText, '0%'),

    attackError: clamp0(v?.counts?.attackError),
    ballHandlingError: clamp0(v?.counts?.ballHandlingError),
    error: clamp0(v?.counts?.error),
    net: clamp0(v?.counts?.net),

    touch: clamp0(v?.counts?.touch),
    firstBall: clamp0(v?.counts?.firstBall),
    bump: clamp0(v?.counts?.bump),

    totalErrors: clamp0(v?.derived?.totalErrors),
    defenseImpact: clamp0(v?.derived?.defenseImpact),
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

export function renderSportStatsCard(
  sportKey: string,
  sportStats: any,
  athleteName: string,
) {
  if (sportKey === 'basketball:default') {
    return <BasketballStatsCard stats={sportStats} athleteName={athleteName} />;
  }

  if (sportKey === 'baseball:hitting') {
    return <BaseballHittingStatsCard stats={sportStats} athleteName={athleteName} />;
  }

  if (sportKey === 'baseball:pitching') {
    return <BaseballPitchingStatsCard stats={sportStats} athleteName={athleteName} />;
  }

  if (sportKey === 'softball:hitting') {
    return <SoftballHittingStatsCard stats={sportStats} athleteName={athleteName} />;
  }
  
  if (sportKey === 'softball:pitching') {
    return <SoftballPitchingStatsCard stats={sportStats} athleteName={athleteName} />;
  }

  if (sportKey.startsWith('bjj:')) {
    return (
      <BjjStatsCard
        stats={sportStats}
        athleteName={athleteName}
        sportKey={sportKey}
      />
    );
  }

  if (sportKey === 'wrestling:folkstyle') {
    return (
      <FolkstyleStatsCard
        stats={sportStats}
        athleteName={athleteName}
      />
    );
  }

  if (sportKey === 'wrestling:freestyle') {
    return (
      <FreestyleStatsCard
        stats={sportStats}
        athleteName={athleteName}
      />
    );
  }

  if (sportKey === 'wrestling:greco') {
    return (
      <GrecoStatsCard
        stats={sportStats}
        athleteName={athleteName}
      />
    );
  }

  if (sportKey === 'volleyball:default' || sportKey === 'volleyball:match') {
    const v = normalizeVolleyballDefault(sportStats);

    const attackAttempts = v.attackAttempts || v.attack + v.kill + v.attackError;
    const serveTotal = v.serveTotal || v.serveIn + v.ace + v.serveError;
    const passTotal = v.passTotal || v.pass3 + v.pass2 + v.pass1 + v.pass0;
    const totalErrors =
      v.totalErrors || v.error + v.net + v.serveError + v.attackError + v.ballHandlingError;
    const defenseImpact =
      v.defenseImpact || v.dig + v.block + v.touch + v.firstBall;

    const passAvgNum = Number(v.passAvg);
    const passGrade =
      passTotal === 0
        ? 'No pass data yet'
        : passAvgNum >= 2.4
          ? 'Strong passing'
          : passAvgNum >= 1.7
            ? 'Playable passing'
            : 'Needs cleaner first contact';

    const hittingGrade =
      attackAttempts === 0
        ? 'No attack data yet'
        : String(v.hittingPct).startsWith('-')
          ? 'Too many errors'
          : Number(String(v.hittingPct).replace('+', '')) >= 0.25
            ? 'Strong attacking'
            : 'Needs cleaner swings';

    const serveGrade =
      serveTotal === 0
        ? 'No serve data yet'
        : String(v.serveEfficiency).startsWith('-')
          ? 'Errors outweigh aces'
          : 'Positive serve pressure';

    return (
      <CardShell title={sportTitle(sportKey)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontWeight: '800',
            marginBottom: 12,
          }}
        >
          Athlete: {athleteName}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <HeroStat
            label="Hitting %"
            value={v.hittingPct}
            sub={hittingGrade}
          />
          <HeroStat label="Pass Avg" value={v.passAvg} sub={passGrade} />
          <HeroStat
            label="Serve Eff"
            value={v.serveEfficiency}
            sub={serveGrade}
          />
        </View>

        <SectionTitle>Offense</SectionTitle>

        <BarRow
          label="Hitting percentage"
          value={`${v.kill} K - ${v.attackError} E / ${attackAttempts} attempts`}
          pct={attackAttempts ? Math.max(0, Math.round(Number(String(v.hittingPct).replace('+', '')) * 100)) : 0}
        />

        <BarRow
          label="Kill percentage"
          value={`${v.kill} kills • ${v.killPct}`}
          pct={attackAttempts ? Math.round((v.kill / attackAttempts) * 100) : 0}
        />

        <BarRow
          label="Attack errors"
          value={`${v.attackError} errors`}
          pct={attackAttempts ? Math.round((v.attackError / attackAttempts) * 100) : 0}
        />

        <SectionTitle>Serving</SectionTitle>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Serve Total" value={serveTotal} />
          <Chip label="Aces" value={v.ace} />
          <Chip label="Ace/Error" value={v.aceErrorRatio} />
          <Chip label="Ace %" value={v.acePct} />
          <Chip label="Serve In %" value={v.serveInPct} />
          <Chip label="Serve Err %" value={v.serveErrorPct} />
        </View>

        <SectionTitle>Passing</SectionTitle>

        <BarRow
          label="3-pass rate"
          value={`${v.pass3} perfect • ${v.pass3Pct}`}
          pct={passTotal ? Math.round((v.pass3 / passTotal) * 100) : 0}
        />
        <BarRow
          label="2-pass rate"
          value={`${v.pass2} good • ${v.pass2Pct}`}
          pct={passTotal ? Math.round((v.pass2 / passTotal) * 100) : 0}
        />
        <BarRow
          label="1-pass rate"
          value={`${v.pass1} okay • ${v.pass1Pct}`}
          pct={passTotal ? Math.round((v.pass1 / passTotal) * 100) : 0}
        />
        <BarRow
          label="0-pass / error rate"
          value={`${v.pass0} errors • ${v.pass0Pct}`}
          pct={passTotal ? Math.round((v.pass0 / passTotal) * 100) : 0}
        />

        <SectionTitle>Defense & Ball Control</SectionTitle>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Defense Impact" value={defenseImpact} />
          <Chip label="Blocks" value={v.block} />
          <Chip label="Digs" value={v.dig} />
          <Chip label="Touches" value={v.touch} />
          <Chip label="1st Ball" value={v.firstBall} />
          <Chip label="Bump" value={v.bump} />
        </View>

        <SectionTitle>Errors</SectionTitle>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Total Errors" value={totalErrors} />
          <Chip label="Serve Errors" value={v.serveError} />
          <Chip label="Attack Errors" value={v.attackError} />
          <Chip label="Net" value={v.net} />
          <Chip label="Ball Handling" value={v.ballHandlingError} />
          <Chip label="Other" value={v.error} />
        </View>

        <SectionTitle>Clip Volume</SectionTitle>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chip label="Clips" value={v.clips} />
          <Chip label="Events" value={v.events} />
          <Chip label="Pass Total" value={passTotal} />
          <Chip label="Attack Attempts" value={attackAttempts} />
        </View>
      </CardShell>
    );
  }

  const clips =
    sportStats?.totals?.clips ??
    sportStats?.totals?.videos ??
    sportStats?.totals?.matches ??
    sportStats?.totals?.games ??
    sportStats?.totals?.sessions ??
    null;

  const events = sportStats?.totals?.events ?? sportStats?.totals?.eventCount ?? null;

  return (
    <CardShell title={sportTitle(sportKey)}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 10 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="sportKey" value={sportKey} />
        {clips != null ? <Chip label="Clips" value={clamp0(clips)} /> : null}
        {events != null ? <Chip label="Events" value={clamp0(events)} /> : null}
      </View>

      <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10 }}>
        (Generic view) Add a custom card for this sportKey later if you want richer stats.
      </Text>
    </CardShell>
  );
}