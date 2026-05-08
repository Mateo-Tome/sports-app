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

export default function BjjStatsCard({
  stats,
  athleteName,
  sportKey,
}: {
  stats: any;
  athleteName: string;
  sportKey: string;
}) {
  const d = stats?.derived ?? {};
  const record = d?.record ?? {};
  const counts = stats?.counts ?? {};
  const breakdown = d?.pointBreakdown ?? {};
  const pct = d?.pointBreakdownPct ?? {};

  const td = clamp0(counts?.takedown?.myKid);
  const sw = clamp0(counts?.sweep?.myKid);
  const kob = clamp0(counts?.kneeOnBelly?.myKid);
  const pass = clamp0(counts?.guardPass?.myKid);
  const mount = clamp0(counts?.mount?.myKid);
  const back = clamp0(counts?.backControl?.myKid);
  const adv = clamp0(counts?.advantage?.myKid);
  const pen = clamp0(counts?.penaltyGiven?.myKid);
  const finishes = clamp0(counts?.finish?.myKid);

  return (
    <CardShell title={sportTitle(sportKey)}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroStat label="Pts / Match" value={`${clamp0(d?.pointsPerMatch)} avg`} sub={`${clamp0(stats?.points?.myKid)} total pts`} />
        <HeroStat label="Finish Rate" value={safeStr(d?.finishRateText, '0%')} sub={`${finishes} submissions`} />
        <HeroStat label="Pass / Match" value={`${clamp0(d?.passesPerMatch)} avg`} sub={`${pass} guard passes`} />
      </View>

      <SectionTitle>Record</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Wins" value={clamp0(record?.wins)} />
        <Chip label="Losses" value={clamp0(record?.losses)} />
        <Chip label="Ties" value={clamp0(record?.ties)} />
        <Chip label="Win %" value={safeStr(record?.winPctText, '0%')} />
      </View>

      <SectionTitle>BJJ Profile</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Best Scoring" value={safeStr(d?.bestScoringAction, 'No scoring yet')} />
        <Chip label="TD / Match" value={`${clamp0(d?.takedownsPerMatch)} avg`} />
        <Chip label="Sweep / Match" value={`${clamp0(d?.sweepsPerMatch)} avg`} />
        <Chip label="Dom Pos / Match" value={`${clamp0(d?.dominantPositionsPerMatch)} avg`} />
        <Chip label="Opp Pts / Match" value={`${clamp0(d?.opponentPointsPerMatch)} avg`} />
      </View>

      <SectionTitle>Scoring Breakdown</SectionTitle>

      <BarRow label="Takedown points" value={`${clamp0(breakdown?.takedown)} pts • ${clamp0(pct?.takedown)}%`} percent={clamp0(pct?.takedown)} />
      <BarRow label="Sweep points" value={`${clamp0(breakdown?.sweep)} pts • ${clamp0(pct?.sweep)}%`} percent={clamp0(pct?.sweep)} />
      <BarRow label="Guard pass points" value={`${clamp0(breakdown?.guardPass)} pts • ${clamp0(pct?.guardPass)}%`} percent={clamp0(pct?.guardPass)} />
      <BarRow label="Mount points" value={`${clamp0(breakdown?.mount)} pts • ${clamp0(pct?.mount)}%`} percent={clamp0(pct?.mount)} />
      <BarRow label="Back control points" value={`${clamp0(breakdown?.backControl)} pts • ${clamp0(pct?.backControl)}%`} percent={clamp0(pct?.backControl)} />

      <SectionTitle>BJJ Actions</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="TD2" value={td} />
        <Chip label="SW2" value={sw} />
        <Chip label="KOB2" value={kob} />
        <Chip label="P3" value={pass} />
        <Chip label="M4" value={mount} />
        <Chip label="B4" value={back} />
        <Chip label="ADV" value={adv} />
        <Chip label="PEN Given" value={pen} />
        <Chip label="SUB" value={finishes} />
      </View>

      <SectionTitle>Totals</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Clips" value={clamp0(stats?.totals?.clips)} />
        <Chip label="Events" value={clamp0(stats?.totals?.events)} />
        <Chip label="My Points" value={clamp0(stats?.points?.myKid)} />
        <Chip label="Opp Points" value={clamp0(stats?.points?.opp)} />
      </View>
    </CardShell>
  );
}