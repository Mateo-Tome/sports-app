import React from 'react';
import { Text, View } from 'react-native';
import { sportTitle } from '../../sportMeta';

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function pct(made: number, attempts: number) {
  if (!attempts) return '0%';
  return `${Math.round((made / attempts) * 100)}%`;
}

function pctNum(made: number, attempts: number) {
  if (!attempts) return 0;
  return Math.round((made / attempts) * 100);
}

function avg(total: number, clips: number) {
  if (!clips) return 0;
  return Math.round((total / clips) * 10) / 10;
}

function ratio(a: number, b: number) {
  if (!b) return a > 0 ? '∞' : '0.0';
  return (a / b).toFixed(1);
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

function BarRow({ label, made, attempts }: { label: string; made: number; attempts: number }) {
  const percentage = pctNum(made, attempts);

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '900' }}>{label}</Text>
        <Text style={{ color: 'white', fontWeight: '900' }}>{made}/{attempts} • {percentage}%</Text>
      </View>

      <View style={{ height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, percentage))}%`, height: '100%', backgroundColor: 'rgba(34,211,238,0.95)' }} />
      </View>
    </View>
  );
}

export default function BasketballStatsCard({
  stats,
  athleteName,
}: {
  stats: any;
  athleteName: string;
}) {
  const clips = clamp0(stats?.totals?.clips);
  const events = clamp0(stats?.totals?.events);
  const points = clamp0(stats?.points?.total);

  const fgM = clamp0(stats?.shooting?.fgM);
  const fgA = clamp0(stats?.shooting?.fgA);
  const t3M = clamp0(stats?.shooting?.t3M);
  const t3A = clamp0(stats?.shooting?.t3A);
  const ftM = clamp0(stats?.shooting?.ftM);
  const ftA = clamp0(stats?.shooting?.ftA);

  const twoM = Math.max(0, fgM - t3M);
  const twoA = Math.max(0, fgA - t3A);

  const ast = clamp0(stats?.counts?.assist);
  const stl = clamp0(stats?.counts?.steal);
  const blk = clamp0(stats?.counts?.block);
  const rebO = clamp0(stats?.counts?.reboundOff);
  const rebD = clamp0(stats?.counts?.reboundDef);
  const rebounds = rebO + rebD;
  const tov = clamp0(stats?.counts?.turnover);
  const foul = clamp0(stats?.counts?.foul);

  const efgPct = fgA ? Math.round(((fgM + 0.5 * t3M) / fgA) * 100) : 0;
  const tsDen = 2 * (fgA + 0.44 * ftA);
  const tsPct = tsDen ? Math.round((points / tsDen) * 100) : 0;

  const bestClipEstimate = Math.max(avg(points, clips) * 1.6, avg(points, clips) + 6).toFixed(1);

  return (
    <CardShell title={sportTitle('basketball:default')}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginBottom: 12 }}>
        Athlete: {athleteName}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <HeroStat label="Pts / Clip" value={`${avg(points, clips)} avg`} sub={`${points} total`} />
        <HeroStat label="FG%" value={pct(fgM, fgA)} sub={`${fgM}/${fgA}`} />
        <HeroStat label="3PT%" value={pct(t3M, t3A)} sub={`${t3M}/${t3A}`} />
      </View>

      <SectionTitle>Shooting Profile</SectionTitle>

      <BarRow label="Field Goals" made={fgM} attempts={fgA} />
      <BarRow label="2PT Shots" made={twoM} attempts={twoA} />
      <BarRow label="3PT Shots" made={t3M} attempts={t3A} />
      <BarRow label="Free Throws" made={ftM} attempts={ftA} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="eFG%" value={`${efgPct}%`} />
        <Chip label="TS%" value={`${tsPct}%`} />
        <Chip label="Shot Events" value={fgA + ftA} />
        <Chip label="Best Clip*" value={`${bestClipEstimate} pts`} />
      </View>

      <SectionTitle>Impact Stats</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="AST" value={ast} />
        <Chip label="REB" value={rebounds} />
        <Chip label="OREB" value={rebO} />
        <Chip label="DREB" value={rebD} />
        <Chip label="STL" value={stl} />
        <Chip label="BLK" value={blk} />
        <Chip label="TO" value={tov} />
        <Chip label="AST/TO" value={ratio(ast, tov)} />
        <Chip label="Fouls" value={foul} />
      </View>

      <SectionTitle>Per Clip</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="PTS / Clip" value={`${avg(points, clips)} avg`} />
        <Chip label="AST / Clip" value={`${avg(ast, clips)} avg`} />
        <Chip label="REB / Clip" value={`${avg(rebounds, clips)} avg`} />
        <Chip label="STL / Clip" value={`${avg(stl, clips)} avg`} />
        <Chip label="BLK / Clip" value={`${avg(blk, clips)} avg`} />
        <Chip label="TO / Clip" value={`${avg(tov, clips)} avg`} />
      </View>

      <SectionTitle>Totals</SectionTitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chip label="Clips" value={clips} />
        <Chip label="Events" value={events} />
        <Chip label="Points" value={points} />
        <Chip label="FG" value={`${fgM}/${fgA} (${pct(fgM, fgA)})`} />
        <Chip label="3PT" value={`${t3M}/${t3A} (${pct(t3M, t3A)})`} />
        <Chip label="FT" value={`${ftM}/${ftA} (${pct(ftM, ftA)})`} />
      </View>

      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 12 }}>
        * Best Clip uses current totals estimate until per-clip history is added.
      </Text>
    </CardShell>
  );
}