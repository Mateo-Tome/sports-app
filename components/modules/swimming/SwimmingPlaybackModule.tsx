import { useMemo } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { PlaybackModuleProps } from '../types';

const BLUE = 'rgba(14,165,233,0.96)';
const DARK = 'rgba(0,0,0,0.68)';
const BORDER = 'rgba(125,211,252,0.55)';

function getMeta(e: any) {
  const m = e?.meta ?? {};
  const inner = m?.meta ?? {};
  return { ...inner, ...m };
}

function formatRaceTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.000';

  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export default function SwimmingPlaybackModule({
  overlayOn,
  insets,
  events,
  editMode,
  editSubmode,
  onOverlayEvent,
}: PlaybackModuleProps) {
  const dims = useWindowDimensions();

  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  const summary = useMemo(() => {
    const list = Array.isArray(events) ? events : [];

    let raceLabel = 'Swimming Race';
    let finalTimeSec: number | null = null;
    let turnCount = 0;
    let strokeCount = 0;

    for (const e of list) {
      const kind = String(e?.kind ?? e?.key ?? '').toLowerCase();
      const meta = getMeta(e);

      if (meta.raceLabel) raceLabel = String(meta.raceLabel);

      if (kind === 'turn_split') {
        const n = Number(meta.turnNumber);
        if (Number.isFinite(n)) turnCount = Math.max(turnCount, n);
      }

      if (kind === 'stroke_count') {
        const n = Number(meta.strokeCount);
        if (Number.isFinite(n)) strokeCount = Math.max(strokeCount, n);
      }

      if (kind === 'finish_race') {
        const n = Number(meta.finalTimeSec);
        if (Number.isFinite(n)) finalTimeSec = n;

        const turns = Number(meta.turnCount);
        const strokes = Number(meta.strokeCount);

        if (Number.isFinite(turns)) turnCount = Math.max(turnCount, turns);
        if (Number.isFinite(strokes)) strokeCount = Math.max(strokeCount, strokes);
      }
    }

    return {
      raceLabel,
      finalTimeText: finalTimeSec === null ? 'No finish yet' : formatRaceTime(finalTimeSec),
      turnCount,
      strokeCount,
    };
  }, [events]);

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    onOverlayEvent?.({
      actor: 'neutral',
      key,
      label,
      meta: {
        sport: 'swimming',
        style: 'race',
        raceLabel: summary.raceLabel,
        pillLabel: label,
        pillColor: BLUE,
        color: BLUE,
        tint: BLUE,
        buttonColor: BLUE,
        chipColor: BLUE,
        beltLane: 'bottom',
        ...(extraMeta || {}),
      },
    });
  };

  if (!overlayOn) return null;

  if (!showPalette) {
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: insets.left + 86,
          right: insets.right + 86,
          top: insets.top + 10,
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <View
          style={{
            maxWidth: Math.min(dims.width - insets.left - insets.right - 180, 720),
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
            backgroundColor: DARK,
            borderWidth: 1,
            borderColor: BORDER,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {summary.raceLabel} • Final {summary.finalTimeText} • T{summary.turnCount} • S{summary.strokeCount}
          </Text>
        </View>
      </View>
    );
  }

  const screenW = dims.width;
  const screenH = dims.height;

  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, screenH - TOP - BOTTOM);
  const GAP = 10;
  const BTN_H = Math.max(50, Math.min(70, Math.floor((availableHeight - GAP) / 2)));
  const BTN_W = Math.min(140, Math.max(112, screenW * 0.22));

  const SwimEditButton = ({
    label,
    sub,
    onPress,
    bg,
  }: {
    label: string;
    sub?: string;
    onPress: () => void;
    bg: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        width: BTN_W,
        height: BTN_H,
        borderRadius: 22,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.45)',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 13 }}>{label}</Text>
      {!!sub && (
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800', fontSize: 11, marginTop: 3 }}>
          {sub}
        </Text>
      )}
    </Pressable>
  );

  const nextTurn =
    Math.max(
      0,
      ...events
        .filter((e) => String(e?.kind ?? '').toLowerCase() === 'turn_split')
        .map((e) => Number(getMeta(e).turnNumber) || 0),
    ) + 1;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, justifyContent: 'center', gap: GAP }}>
        <SwimEditButton
          label="START"
          sub="race"
          bg={BLUE}
          onPress={() =>
            fire('start_race', 'Start', {
              raceElapsedSec: 0,
              beltLane: 'bottom',
            })
          }
        />

        <SwimEditButton
          label="FINISH"
          sub="race"
          bg="rgba(239,68,68,0.96)"
          onPress={() =>
            fire('finish_race', 'Finish', {
              beltLane: 'bottom',
            })
          }
        />
      </View>

      <View pointerEvents="box-none" style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, justifyContent: 'center', gap: GAP }}>
        <SwimEditButton
          label="TURN"
          sub={`#${nextTurn}`}
          bg="rgba(0,0,0,0.84)"
          onPress={() =>
            fire('turn_split', `Turn ${nextTurn}`, {
              turnNumber: nextTurn,
              beltLane: 'bottom',
            })
          }
        />

        <SwimEditButton
          label="STROKE"
          sub="data only"
          bg="rgba(0,0,0,0.84)"
          onPress={() =>
            fire('stroke_count', 'Stroke', {
              hideFromBelt: true,
            })
          }
        />
      </View>
    </View>
  );
}