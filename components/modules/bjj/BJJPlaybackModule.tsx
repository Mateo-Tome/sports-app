// components/modules/bjj/BJJPlaybackModule.tsx
import { useMemo } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { PlaybackModuleProps } from '../types';

const GREEN = '#16a34a';
const RED = '#dc2626';
const GOLD = '#d4a017';

function cleanName(v?: string) {
  const s = String(v ?? '').trim();
  return s.length ? s : 'Unassigned';
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type KidSide = 'left' | 'right';
type KidColor = 'green' | 'red';

function pickLatestBjjMeta(events: any[]): { myKidSide?: KidSide; myKidColor?: KidColor; style?: string } {
  for (let i = (events?.length ?? 0) - 1; i >= 0; i--) {
    const e = events[i];
    const meta = e?.meta ?? {};
    const inner = meta?.meta ?? {};
    const side = (meta.myKidSide ?? inner.myKidSide) as any;
    const color = (meta.myKidColor ?? inner.myKidColor) as any;
    const style = (meta.style ?? inner.style) as any;

    const okSide = side === 'left' || side === 'right' ? side : undefined;
    const okColor = color === 'green' || color === 'red' ? color : undefined;

    if (okSide || okColor || style) return { myKidSide: okSide, myKidColor: okColor, style: style ? String(style) : undefined };
  }
  return {};
}

export default function BJJPlaybackModule({
  overlayOn,
  insets,
  liveScore,
  finalScore,
  homeIsAthlete,
  homeColorIsGreen,
  editMode,
  editSubmode,
  onOverlayEvent,
  athleteName,
  events,
}: PlaybackModuleProps) {
  if (!overlayOn) return null;

  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;

  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  const athleteLabel = cleanName(athleteName);
  const opponentLabel = 'Opponent';

  // --- Determine colors (prefer BJJOverlay meta: myKidColor/myKidSide) ---
  const meta = useMemo(() => pickLatestBjjMeta(events as any[]), [events]);

  // fallback to global homeColorIsGreen if no BJJ meta
  const baseAthleteColor = homeColorIsGreen !== false ? GREEN : RED;
  const baseOpponentColor = homeColorIsGreen !== false ? RED : GREEN;

  // If BJJ overlay saved myKidColor, use it to theme athlete vs opponent
  const athleteColor =
    meta.myKidColor === 'green' ? GREEN : meta.myKidColor === 'red' ? RED : baseAthleteColor;

  const opponentColor =
    meta.myKidColor === 'green' ? RED : meta.myKidColor === 'red' ? GREEN : baseOpponentColor;

  // --- Score mapping ---
  const homeScore = liveScore?.home ?? 0;
  const oppScore = liveScore?.opponent ?? 0;

  const athleteIsHome = homeIsAthlete;
  const athleteLiveScore = athleteIsHome ? homeScore : oppScore;
  const opponentLiveScore = athleteIsHome ? oppScore : homeScore;

  // --- Result label (optional like wrestling) ---
  const result = useMemo(() => {
    if (!finalScore) return { label: '', color: 'rgba(148,163,184,0.95)' };
    const a = athleteIsHome ? finalScore.home : finalScore.opponent;
    const b = athleteIsHome ? finalScore.opponent : finalScore.home;
    let out: 'W' | 'L' | 'T';
    if (a > b) out = 'W';
    else if (a < b) out = 'L';
    else out = 'T';
    const label = `${out} ${a}–${b}`;
    const color = out === 'W' ? athleteColor : out === 'L' ? opponentColor : 'rgba(148,163,184,0.95)';
    return { label, color };
  }, [finalScore, athleteIsHome, athleteColor, opponentColor]);

  // ===== NOT EDITING: show result + score pills =====
  if (!showPalette) {
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: insets.top + 36,
        }}
      >
        {result.label ? (
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderWidth: 1,
                borderColor: result.color,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{result.label}</Text>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 6, paddingHorizontal: 24 }}>
          <View
            style={{
              position: 'absolute',
              left: 24,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: hexToRgba(athleteColor, 0.22),
              borderWidth: 1,
              borderColor: hexToRgba(athleteColor, 0.4),
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              {athleteLabel} • {athleteLiveScore}
            </Text>
          </View>

          <View
            style={{
              position: 'absolute',
              right: 24,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: hexToRgba(opponentColor, 0.22),
              borderWidth: 1,
              borderColor: hexToRgba(opponentColor, 0.4),
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              {opponentLabel} • {opponentLiveScore}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </View>
    );
  }

  // ===== EDIT MODE: simple add/replace palette =====
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, height - TOP - BOTTOM);
  const TITLE_H = 28;
  const ROWS = 4;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - TITLE_H - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(34, Math.min(58, maxSize));
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  // default to athlete on left in edit UI (same vibe as overlay)
  const athleteActor: 'home' | 'opponent' = athleteIsHome ? 'home' : 'opponent';
  const opponentActor: 'home' | 'opponent' = athleteActor === 'home' ? 'opponent' : 'home';

  const fire = (
    actor: 'home' | 'opponent' | 'neutral',
    key: string,
    label: string,
    value?: number,
    metaExtra?: Record<string, any>,
  ) => {
    onOverlayEvent?.({
      actor: actor as any,
      key,
      label,
      value,
      meta: {
        ...(metaExtra || {}),
        style: meta.style ?? 'gi',
        myKidColor: meta.myKidColor ?? (athleteColor === GREEN ? 'green' : 'red'),
        myKidSide: meta.myKidSide ?? 'left',
        athleteName: athleteLabel,
      },
    } as any);
  };

  const Circle = ({ short, label, actor, keyName, pts, color }: any) => (
    <Pressable
      onPress={() => fire(actor, keyName, label, pts, pts ? { points: pts } : undefined)}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>{short}</Text>
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}>
      {/* Simple header */}
      <View style={{ position: 'absolute', top: -36, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Text style={{ color: 'white', fontWeight: '800' }}>BJJ Edit Mode</Text>
        </View>
      </View>

      {/* Athlete column */}
      <View style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, width: COL_W }}>
        <Text
          style={{
            color: 'white',
            fontWeight: '800',
            marginBottom: 8,
            backgroundColor: athleteColor,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          {athleteLabel}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP }}>
          <Circle short="TD2" label="Takedown" actor={athleteActor} keyName="takedown" pts={2} color={athleteColor} />
          <Circle short="SW2" label="Sweep" actor={athleteActor} keyName="sweep" pts={2} color={athleteColor} />
          <Circle short="KOB2" label="Knee on Belly" actor={athleteActor} keyName="knee_on_belly" pts={2} color={athleteColor} />
          <Circle short="P3" label="Guard Pass" actor={athleteActor} keyName="guard_pass" pts={3} color={athleteColor} />
          <Circle short="M4" label="Mount" actor={athleteActor} keyName="mount" pts={4} color={athleteColor} />
          <Circle short="B4" label="Back Control" actor={athleteActor} keyName="back_control" pts={4} color={athleteColor} />
          <Circle short="ADV" label="Advantage" actor={athleteActor} keyName="advantage" pts={1} color={athleteColor} />
          <Circle short="PEN" label="Penalty" actor={'neutral'} keyName="penalty" pts={1} color={athleteColor} />
        </View>
      </View>

      {/* Opponent column */}
      <View style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, width: COL_W, alignItems: 'flex-end' }}>
        <Text
          style={{
            color: 'white',
            fontWeight: '800',
            marginBottom: 8,
            backgroundColor: opponentColor,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          {opponentLabel}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP, justifyContent: 'flex-end' }}>
          <Circle short="TD2" label="Takedown" actor={opponentActor} keyName="takedown" pts={2} color={opponentColor} />
          <Circle short="SW2" label="Sweep" actor={opponentActor} keyName="sweep" pts={2} color={opponentColor} />
          <Circle short="KOB2" label="Knee on Belly" actor={opponentActor} keyName="knee_on_belly" pts={2} color={opponentColor} />
          <Circle short="P3" label="Guard Pass" actor={opponentActor} keyName="guard_pass" pts={3} color={opponentColor} />
          <Circle short="M4" label="Mount" actor={opponentActor} keyName="mount" pts={4} color={opponentColor} />
          <Circle short="B4" label="Back Control" actor={opponentActor} keyName="back_control" pts={4} color={opponentColor} />
          <Circle short="ADV" label="Advantage" actor={opponentActor} keyName="advantage" pts={1} color={opponentColor} />
          <Circle short="PEN" label="Penalty" actor={'neutral'} keyName="penalty" pts={1} color={opponentColor} />
        </View>
      </View>

      {/* Finish button */}
      <View style={{ position: 'absolute', top: -36, right: EDGE_R }} pointerEvents="box-none">
        <Pressable
          onPress={() => fire('neutral', 'finish', 'Submission', 0, { winBy: 'submission' })}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: GOLD,
          }}
        >
          <Text style={{ color: '#111', fontWeight: '900', fontSize: 12 }}>SUB</Text>
        </Pressable>
      </View>
    </View>
  );
}