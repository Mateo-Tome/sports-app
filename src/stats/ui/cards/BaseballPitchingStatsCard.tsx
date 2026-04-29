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

function PercentBar({ label, valueText }: { label: string; valueText: string }) {
  const n = Number(String(valueText).replace('%', ''));
  const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '900', flex: 1 }}>{label}</Text>
        <Text style={{ color: 'white', fontWeight: '900' }}>{valueText}</Text>
      </View>

      <View style={{ height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: 'rgba(34,211,238,0.95)' }} />
      </View>
    </View>
  );
}

export default function BaseballPitchingStatsCard({
  stats,
  athleteName,
}: {
  stats: any;
  athleteName: string;
}) {
  const clips = clamp0(stats?.totals?.clips);
  const events = clamp0(stats?.totals?.events);

  const d = stats?.derived ?? {};

  const ip = safeStr(d?.inningsPitchedText, '0.0');
  const pitches = clamp0(d?.totalPitches);
  const bf = clamp0(d?.battersFaced);
  const whip = safeStr(d?.whipText, '0.00');

  const strikePct = safeStr(d?.strikePctText, '0%');
  const ballPct = safeStr(d?.ballPctText, '0%');
  const calledStrikePct = safeStr(d?.calledStrikePctText, '0%');
  const swingingStrikePct = safeStr(d?.swingingStrikePctText, '0%');
  const kPct = safeStr(d?.kPctText, '0%');
  const bbPct = safeStr(d?.bbPctText, '0%');
  const hbpPct = safeStr(d?.hbpPctText, '0%');
  const kbb = safeStr(d?.kbbText, '0.00');

  const balls = clamp0(stats?.counts?.ball);
  const strikes = clamp0(stats?.counts?.strike);
  const fouls = clamp0(stats?.counts?.foul);

  const lookingStrikes = clamp0(stats?.counts?.strikeTypes?.looking);
  const swingingStrikes = clamp0(stats?.counts?.strikeTypes?.swinging);

  const walks = clamp0(stats?.counts?.walk);
  const hbp = clamp0(stats?.counts?.hitByPitch);
  const strikeouts = clamp0(stats?.counts?.strikeout);
  const kLooking = clamp0(stats?.counts?.strikeoutTypes?.looking);
  const kSwinging = clamp0(stats?.counts?.strikeoutTypes?.swinging);

  const hitsAllowed = clamp0(d?.hitsTotalAllowed);
  const hrAllowed = clamp0(stats?.counts?.homerunAllowed);
  const outs = clamp0(d?.outsRecordedTotal);
  const baserunners = clamp0(d?.baserunners);

  return (
    <CardShell title={sportTitle('baseball:pitching')}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroStat label="IP" value={ip} sub={`${outs} outs`} />
        <HeroStat label="WHIP" value={whip} sub={`${baserunners} baserunners`} />
        <HeroStat label="Strike %" value={strikePct} sub={`${pitches} pitches`} />
      </View>

      <SectionTitle>Pitch Command</SectionTitle>

      <PercentBar label="Strike rate" valueText={strikePct} />
      <PercentBar label="Ball rate" valueText={ballPct} />
      <PercentBar label="Called strike rate" valueText={calledStrikePct} />
      <PercentBar label="Swinging strike rate" valueText={swingingStrikePct} />
      <PercentBar label="K rate" valueText={kPct} />
      <PercentBar label="BB rate" valueText={bbPct} />
      <PercentBar label="HBP rate" valueText={hbpPct} />

      <SectionTitle>Efficiency</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Pitches" value={pitches} />
        <Chip label="Batters Faced" value={bf} />
        <Chip label="Pitches / BF" value={safeStr(d?.pitchesPerBFText, '0.0')} />
        <Chip label="Pitches / Inning" value={safeStr(d?.pitchesPerInningText, '0.0')} />
        <Chip label="K/BB" value={kbb} />
      </View>

      <SectionTitle>Results Allowed</SectionTitle>
      

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="K" value={strikeouts} />
        <Chip label="K Looking" value={kLooking} />
        <Chip label="K Swinging" value={kSwinging} />
        <Chip label="BB" value={walks} />
        <Chip label="HBP" value={hbp} />
        <Chip label="Hits Allowed" value={hitsAllowed} />
        <Chip label="HR Allowed" value={hrAllowed} />
        <Chip label="Outs" value={outs} />
      </View>

      <SectionTitle>Pitch Events</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Balls" value={balls} />
        <Chip label="Strikes" value={strikes} />
        <Chip label="Looking Strikes" value={lookingStrikes} />
        <Chip label="Swinging Strikes" value={swingingStrikes} />
        <Chip label="Fouls" value={fouls} />
        <Chip label="Clips" value={clips} />
        <Chip label="Events" value={events} />
      </View>
    </CardShell>
  );
}