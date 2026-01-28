import React from 'react';
import { Text, View } from 'react-native';
import { sportTitle } from '../sportMeta';

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
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
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }}>{title}</Text>
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
      <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '900' }}>{label}</Text>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 4 }}>{String(value)}</Text>
    </View>
  );
}

function clamp0(n: any) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

// -----------------------------
// Normalize helpers (safe)
// -----------------------------

// folkstyle: supports both of your shapes
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

  // legacy-ish fallback
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
  // expects your reducer output shape:
  // totals { clips, events }
  // points { myKid, opp }
  // counts { takedown/exposure/out/feetToDanger/ga4/ga5/... } each has {myKid, opp}
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

// Generic fallback: always show *something* helpful
function normalizeGeneric(s: any) {
  const clips =
    s?.totals?.clips ??
    s?.totals?.videos ??
    s?.totals?.matches ??
    s?.totals?.games ??
    s?.totals?.sessions ??
    null;

  const events = s?.totals?.events ?? s?.totals?.eventCount ?? null;

  // some reducers might expose points in different places
  const myPoints = s?.points?.myKid ?? s?.points?.athlete ?? s?.points?.home ?? null;
  const oppPoints = s?.points?.opp ?? s?.points?.opponent ?? null;

  return {
    clips: clips != null ? clamp0(clips) : null,
    events: events != null ? clamp0(events) : null,
    myPoints: myPoints != null ? clamp0(myPoints) : null,
    oppPoints: oppPoints != null ? clamp0(oppPoints) : null,
  };
}

export function renderSportStatsCard(sportKey: string, sportStats: any, athleteName: string) {
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

  // -----------------------------
  // Wrestling: Greco
  // -----------------------------
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

  // -----------------------------
  // Generic fallback (ALL sports)
  // -----------------------------
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
