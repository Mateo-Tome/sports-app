import React from 'react';
import { Text, View } from 'react-native';
import { sportTitle } from '../../sportMeta';

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function pct(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function avg(total: number, clips: number) {
  if (!clips) return 0;
  return Math.round((total / clips) * 10) / 10;
}

function stat3(n: number) {
  if (!Number.isFinite(n)) return '.000';
  const s = n.toFixed(3);
  return s.startsWith('0') ? s.slice(1) : s;
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

export default function BaseballHittingStatsCard({
  stats,
  athleteName,
}: {
  stats: any;
  athleteName: string;
}) {
  const clips = clamp0(stats?.totals?.clips);
  const events = clamp0(stats?.totals?.events);

  const hits = clamp0(stats?.derived?.hits);
  const atBats = clamp0(stats?.derived?.atBats);
  const plateAppearances = clamp0(stats?.derived?.plateAppearances);
  const ba = String(stats?.derived?.battingAverageText ?? '.000');
  const obpText = String(stats?.derived?.onBasePctText ?? '.000');

  const walks = clamp0(stats?.counts?.walk);
  const hbp = clamp0(stats?.counts?.hitByPitch);
  const strikeouts = clamp0(stats?.counts?.strikeout);
  const outs = clamp0(stats?.counts?.out);

  const singles = clamp0(stats?.counts?.hitTypes?.single);
  const doubles = clamp0(stats?.counts?.hitTypes?.double);
  const triples = clamp0(stats?.counts?.hitTypes?.triple);
  const homeruns = clamp0(stats?.counts?.homerun);
  const bunt = clamp0(stats?.counts?.hitTypes?.bunt);

  const balls = clamp0(stats?.counts?.ball);
  const strikes = clamp0(stats?.counts?.strike);
  const fouls = clamp0(stats?.counts?.foul);

  const strikeSwinging = clamp0(stats?.counts?.strikeTypes?.swinging);
  const strikeLooking = clamp0(stats?.counts?.strikeTypes?.looking);
  const kSwinging = clamp0(stats?.counts?.strikeoutTypes?.swinging);
  const kLooking = clamp0(stats?.counts?.strikeoutTypes?.looking);

  const totalBases = singles + doubles * 2 + triples * 3 + homeruns * 4;
  const slg = atBats ? totalBases / atBats : 0;
  const ops = (Number(`0${obpText}`) || 0) + slg;

  return (
    <CardShell title={sportTitle('baseball:hitting')}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroStat label="BA" value={ba} sub={`${hits}/${atBats}`} />
        <HeroStat label="OBP" value={obpText} sub={`${walks + hbp} free bases`} />
        <HeroStat label="OPS" value={stat3(ops)} sub={`${totalBases} TB`} />
      </View>

      <SectionTitle>Outcome Profile</SectionTitle>

      <BarRow label="Hits" value={`${hits} • ${pct(hits, plateAppearances)}`} percent={plateAppearances ? Math.round((hits / plateAppearances) * 100) : 0} />
      <BarRow label="Walks" value={`${walks} • ${pct(walks, plateAppearances)}`} percent={plateAppearances ? Math.round((walks / plateAppearances) * 100) : 0} />
      <BarRow label="HBP" value={`${hbp} • ${pct(hbp, plateAppearances)}`} percent={plateAppearances ? Math.round((hbp / plateAppearances) * 100) : 0} />
      <BarRow label="Strikeouts" value={`${strikeouts} • ${pct(strikeouts, plateAppearances)}`} percent={plateAppearances ? Math.round((strikeouts / plateAppearances) * 100) : 0} />
      <BarRow label="Outs in play" value={`${outs} • ${pct(outs, plateAppearances)}`} percent={plateAppearances ? Math.round((outs / plateAppearances) * 100) : 0} />

      <SectionTitle>Hit Breakdown</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="1B" value={singles} />
        <Chip label="2B" value={doubles} />
        <Chip label="3B" value={triples} />
        <Chip label="HR" value={homeruns} />
        <Chip label="Bunt" value={bunt} />
        <Chip label="Total Bases" value={totalBases} />
      </View>

      <SectionTitle>Plate Discipline</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Balls" value={balls} />
        <Chip label="Strikes" value={strikes} />
        <Chip label="Looking Strikes" value={strikeLooking} />
        <Chip label="Swinging Strikes" value={strikeSwinging} />
        <Chip label="Fouls" value={fouls} />
        <Chip label="K Looking" value={kLooking} />
        <Chip label="K Swinging" value={kSwinging} />
        <Chip label="BB / Clip" value={`${avg(walks, clips)} avg`} />
        <Chip label="K / Clip" value={`${avg(strikeouts, clips)} avg`} />
      </View>

      <SectionTitle>Totals</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Clips" value={clips} />
        <Chip label="Events" value={events} />
        <Chip label="PA" value={plateAppearances} />
        <Chip label="AB" value={atBats} />
        <Chip label="Hits" value={hits} />
        <Chip label="Walks" value={walks} />
        <Chip label="HBP" value={hbp} />
      </View>
    </CardShell>
  );
}