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
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.045)', padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>{label}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '900' }}>{pts} pts</Text>
      </View>

      <BarRow label="TD share" value={`${td} TD • ${tdPct}%`} percent={tdPct} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="TD" value={td} />
        <Chip label="ESC" value={esc} />
        <Chip label="REV" value={rev} />
        <Chip label="NF" value={nf} />
      </View>
    </View>
  );
}

export default function FolkstyleStatsCard({
  stats,
  athleteName,
}: {
  stats: any;
  athleteName: string;
}) {
  const scoring = stats?.scoring ?? {};
  const derived = stats?.derived ?? {};
  const periods = stats?.periods ?? {};

  const breakdown = derived?.pointBreakdown ?? {};
  const breakdownPct = derived?.pointBreakdownPct ?? {};
  const tdShare = derived?.takedownPeriodSharePct ?? {};
  const record = derived?.record ?? {};

  const nf2 = clamp0(scoring?.nearfall2?.myKid);
  const nf3 = clamp0(scoring?.nearfall3?.myKid);
  const nf4 = clamp0(scoring?.nearfall4?.myKid);
  const nfTotal = nf2 + nf3 + nf4;

  const td = clamp0(scoring?.takedown?.myKid);
  const esc = clamp0(scoring?.escape?.myKid);
  const rev = clamp0(scoring?.reversal?.myKid);
  const pins = clamp0(scoring?.pins?.myKid);

  const p = (key: 'p1' | 'p2' | 'p3' | 'ot') => {
    const row = periods?.[key] ?? {};
    return {
      td: clamp0(row?.takedown?.myKid),
      tdPct: clamp0(tdShare?.[key]),
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
    <CardShell title={sportTitle('wrestling:folkstyle')}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroStat label="Pts / Match" value={`${clamp0(derived?.myPointsPerMatch)} avg`} sub={`${clamp0(scoring?.myKidPoints)} total`} />
        <HeroStat label="TD / Match" value={`${clamp0(derived?.takedownsPerMatch)} avg`} sub={`${td} takedowns`} />
        <HeroStat label="Pin Rate" value={safeStr(derived?.pinRateText, '0%')} sub={`${pins} pins`} />
      </View>

      <SectionTitle>Record</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Wins" value={clamp0(record?.wins)} />
        <Chip label="Losses" value={clamp0(record?.losses)} />
        <Chip label="Ties" value={clamp0(record?.ties)} />
        <Chip label="Win %" value={safeStr(record?.winPctText, '0%')} />
      </View>

      <SectionTitle>Scoring breakdown</SectionTitle>

      <BarRow label="Takedown points" value={`${clamp0(breakdown?.takedown)} pts • ${clamp0(breakdownPct?.takedown)}%`} percent={clamp0(breakdownPct?.takedown)} />
      <BarRow label="Escape points" value={`${clamp0(breakdown?.escape)} pts • ${clamp0(breakdownPct?.escape)}%`} percent={clamp0(breakdownPct?.escape)} />
      <BarRow label="Reversal points" value={`${clamp0(breakdown?.reversal)} pts • ${clamp0(breakdownPct?.reversal)}%`} percent={clamp0(breakdownPct?.reversal)} />
      <BarRow label="Nearfall points" value={`${clamp0(breakdown?.nearfall)} pts • ${clamp0(breakdownPct?.nearfall)}%`} percent={clamp0(breakdownPct?.nearfall)} />
      <BarRow label="Other / penalty points" value={`${clamp0(breakdown?.penalty) + clamp0(breakdown?.other)} pts`} percent={clamp0(breakdownPct?.penalty) + clamp0(breakdownPct?.other)} />

      <SectionTitle>Period breakdown</SectionTitle>

      <PeriodRow label="Period 1" td={p1.td} tdPct={p1.tdPct} esc={p1.esc} rev={p1.rev} nf={p1.nf} pts={p1.pts} />
      <PeriodRow label="Period 2" td={p2.td} tdPct={p2.tdPct} esc={p2.esc} rev={p2.rev} nf={p2.nf} pts={p2.pts} />
      <PeriodRow label="Period 3" td={p3.td} tdPct={p3.tdPct} esc={p3.esc} rev={p3.rev} nf={p3.nf} pts={p3.pts} />

      {hasOt ? (
        <PeriodRow label="Overtime" td={ot.td} tdPct={ot.tdPct} esc={ot.esc} rev={ot.rev} nf={ot.nf} pts={ot.pts} />
      ) : null}

      <SectionTitle>Totals</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Clips" value={clamp0(stats?.totals?.clips)} />
        <Chip label="Events" value={clamp0(stats?.totals?.events)} />
        <Chip label="Total Points" value={clamp0(scoring?.myKidPoints)} />
        <Chip label="Opp Points" value={clamp0(scoring?.opponentPoints)} />
        <Chip label="Takedowns" value={td} />
        <Chip label="Escapes" value={esc} />
        <Chip label="Reversals" value={rev} />
        <Chip label="Nearfall Total" value={nfTotal} />
        <Chip label="NF2" value={nf2} />
        <Chip label="NF3" value={nf3} />
        <Chip label="NF4" value={nf4} />
        <Chip label="Pins" value={pins} />
        <Chip label="ESC / Match" value={`${clamp0(derived?.escapesPerMatch)} avg`} />
        <Chip label="REV / Match" value={`${clamp0(derived?.reversalsPerMatch)} avg`} />
        <Chip label="NF / Match" value={`${clamp0(derived?.nearfallEventsPerMatch)} avg`} />
      </View>
    </CardShell>
  );
}