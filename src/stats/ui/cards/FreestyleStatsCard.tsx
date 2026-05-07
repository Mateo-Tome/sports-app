import React from 'react';
import { Text, View } from 'react-native';
import { sportTitle } from '../../sportMeta';

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function safeStr(v: any, fallback = '0') {
  return typeof v === 'string' ? v : fallback;
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)', padding: 14 }}>
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }}>{title}</Text>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 104, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
      <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 6 }}>{String(value)}</Text>
      {!!sub && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', marginTop: 4 }}>{sub}</Text>}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginTop: 16, marginBottom: 8 }}>{children}</Text>;
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ minWidth: 108, flexGrow: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '900' }}>{label}</Text>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{String(value)}</Text>
    </View>
  );
}

function BarRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  const safePct = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '900', flex: 1 }}>{label}</Text>
        <Text style={{ color: 'white', fontWeight: '900' }}>{value}</Text>
      </View>

      <View style={{ height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
        <View style={{ width: `${safePct}%`, height: '100%', backgroundColor: 'rgba(34,211,238,0.95)' }} />
      </View>
    </View>
  );
}

export default function FreestyleStatsCard({
  stats,
  athleteName,
}: {
  stats: any;
  athleteName: string;
}) {
  const clips = clamp0(stats?.totals?.clips);
  const events = clamp0(stats?.totals?.events);

  const myPoints = clamp0(stats?.points?.myKid);
  const oppPoints = clamp0(stats?.points?.opp);

  const d = stats?.derived ?? {};
  const breakdown = d?.pointBreakdown ?? {};
  const breakdownPct = d?.pointBreakdownPct ?? {};

  const td = clamp0(stats?.counts?.takedown?.myKid);
  const ex = clamp0(stats?.counts?.exposure?.myKid);
  const ob = clamp0(stats?.counts?.out?.myKid);
  const ftd4 = clamp0(stats?.counts?.feetToDanger?.myKid);
  const ga4 = clamp0(stats?.counts?.ga4?.myKid);
  const ga5 = clamp0(stats?.counts?.ga5?.myKid);

  const passWarn = clamp0(stats?.counts?.passWarn?.myKid);
  const passP1Given = clamp0(stats?.counts?.passPlus1Given?.myKid);
  const penP1Given = clamp0(stats?.counts?.penaltyPlus1Given?.myKid);
  const fleeP1Given = clamp0(stats?.counts?.fleePlus1Given?.myKid);
  const fleeP2Given = clamp0(stats?.counts?.fleePlus2Given?.myKid);

  const disciplineTotal = clamp0(d?.disciplineFlagsAgainstMyKid);
  const bestScoringAction = safeStr(d?.bestScoringAction, 'No scoring yet');

  return (
    <CardShell title={sportTitle('wrestling:freestyle')}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroStat label="Pts / Match" value={`${clamp0(d?.myPointsPerMatch)} avg`} sub={`${myPoints} total pts`} />
        <HeroStat label="TD / Match" value={`${clamp0(d?.takedownsPerMatch)} avg`} sub={`${td} takedowns`} />
        <HeroStat label="Turns / Match" value={`${clamp0(d?.exposurePerMatch)} avg`} sub={`${ex} exposures`} />
      </View>

      <SectionTitle>Freestyle Profile</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Best Scoring" value={bestScoringAction} />
        <Chip label="Step-outs / Match" value={`${clamp0(d?.stepOutsPerMatch)} avg`} />
        <Chip label="Big Moves / Match" value={`${clamp0(d?.bigMovesPerMatch)} avg`} />
        <Chip label="Opp Pts / Match" value={`${clamp0(d?.opponentPointsPerMatch)} avg`} />
      </View>

      <SectionTitle>Scoring Breakdown</SectionTitle>

      <BarRow
        label="Takedown points"
        value={`${clamp0(breakdown?.takedown)} pts • ${clamp0(breakdownPct?.takedown)}%`}
        percent={clamp0(breakdownPct?.takedown)}
      />

      <BarRow
        label="Turn / exposure points"
        value={`${clamp0(breakdown?.exposure)} pts • ${clamp0(breakdownPct?.exposure)}%`}
        percent={clamp0(breakdownPct?.exposure)}
      />

      <BarRow
        label="Step-out points"
        value={`${clamp0(breakdown?.stepOut)} pts • ${clamp0(breakdownPct?.stepOut)}%`}
        percent={clamp0(breakdownPct?.stepOut)}
      />

      <BarRow
        label="Feet-to-danger points"
        value={`${clamp0(breakdown?.feetToDanger)} pts • ${clamp0(breakdownPct?.feetToDanger)}%`}
        percent={clamp0(breakdownPct?.feetToDanger)}
      />

      <BarRow
        label="Grand amplitude points"
        value={`${clamp0(breakdown?.grandAmplitude)} pts • ${clamp0(breakdownPct?.grandAmplitude)}%`}
        percent={clamp0(breakdownPct?.grandAmplitude)}
      />

      <BarRow
        label="Opponent penalty points"
        value={`${clamp0(breakdown?.opponentPenalty)} pts • ${clamp0(breakdownPct?.opponentPenalty)}%`}
        percent={clamp0(breakdownPct?.opponentPenalty)}
      />

      <SectionTitle>Discipline / Risk</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Flags Against Athlete" value={disciplineTotal} />
        <Chip label="PASS WARN" value={passWarn} />
        <Chip label="PASS +1 Given" value={passP1Given} />
        <Chip label="PEN +1 Given" value={penP1Given} />
        <Chip label="FLEE +1 Given" value={fleeP1Given} />
        <Chip label="FLEE +2 Given" value={fleeP2Given} />
      </View>

      <SectionTitle>Freestyle Actions</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="TD2" value={td} />
        <Chip label="EX2" value={ex} />
        <Chip label="OB1" value={ob} />
        <Chip label="FTD4" value={ftd4} />
        <Chip label="GA4" value={ga4} />
        <Chip label="GA5" value={ga5} />
      </View>

      <SectionTitle>Totals</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Clips" value={clips} />
        <Chip label="Events" value={events} />
        <Chip label="My Points" value={myPoints} />
        <Chip label="Opp Points" value={oppPoints} />
        <Chip label="Tech Pts Created" value={clamp0(d?.technicalPointsCreated)} />
        <Chip label="Tech Pts Allowed" value={clamp0(d?.technicalPointsAllowed)} />
      </View>
    </CardShell>
  );
}