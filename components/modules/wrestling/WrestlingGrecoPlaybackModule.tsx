// components/modules/wrestling/WrestlingGrecoPlaybackModule.tsx
import { useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { PlaybackModuleProps } from '../types';

// Greco uses red/blue in your recording overlay
const BASE_RED = '#ef4444';
const BASE_BLUE = '#3b82f6';

function isHexColor(v: any): v is string {
  return typeof v === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(v).trim());
}

function pickColorName(v: any): 'red' | 'blue' | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'red') return 'red';
  if (s === 'blue') return 'blue';
  return undefined;
}

function getMeta(e: any) {
  const m = e?.meta ?? {};
  const inner = m?.meta ?? {}; // support meta-in-meta
  return { ...inner, ...m };
}

/**
 * Greco Playback:
 * - NOT editing: shows Result pill + Name/Score pills (like Folkstyle/Freestyle)
 * - EDIT mode: minimal 2x3 circles (TD2/EX2/OB1 + BIG/PASS/PEN)
 * - Colors derived from recorded events (myKidColor/opponentColor), with safe fallbacks
 */
export default function WrestlingGrecoPlaybackModule({
  overlayOn,
  insets,
  liveScore,
  finalScore,
  homeIsAthlete,
  editMode,
  editSubmode,
  onOverlayEvent,
  athleteName,
  events,
}: PlaybackModuleProps) {
  // ✅ hooks first — never early-return before hooks
  const dims = useWindowDimensions();

  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  const athleteLabel = (athleteName ?? '').trim() || 'Athlete';
  const opponentLabel = 'Opponent';

  // ---- derive athlete/opponent colors from prior events (myKidColor/opponentColor) ----
  const derived = useMemo(() => {
    let athleteColor = BASE_RED;
    let opponentColor = BASE_BLUE;
    let athleteActorFromMeta: 'home' | 'opponent' | undefined = undefined;

    const list: any[] = Array.isArray(events) ? events : [];
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      const meta = getMeta(e);

      if (meta.athleteActor === 'home' || meta.athleteActor === 'opponent') {
        athleteActorFromMeta = meta.athleteActor;
      }

      // optional: if any module ever writes explicit hex
      if (isHexColor(meta.athleteColor)) athleteColor = meta.athleteColor;
      if (isHexColor(meta.opponentColor)) opponentColor = meta.opponentColor;

      // primary: your recording overlay writes these
      const mk = pickColorName(meta.myKidColor);
      const ok = pickColorName(meta.opponentColor);

      if (mk) athleteColor = mk === 'red' ? BASE_RED : BASE_BLUE;
      if (ok) opponentColor = ok === 'red' ? BASE_RED : BASE_BLUE;

      if (
        athleteActorFromMeta ||
        mk ||
        ok ||
        isHexColor(meta.athleteColor) ||
        isHexColor(meta.opponentColor)
      ) {
        break;
      }
    }

    return { athleteColor, opponentColor, athleteActorFromMeta };
  }, [events]);

  const athleteColor = derived.athleteColor;
  const opponentColor = derived.opponentColor;

  // If you ever store athleteActor in meta, honor it; otherwise use homeIsAthlete
  const athleteActor: 'home' | 'opponent' =
    derived.athleteActorFromMeta ?? (homeIsAthlete ? 'home' : 'opponent');
  const opponentActor: 'home' | 'opponent' = athleteActor === 'home' ? 'opponent' : 'home';

  // ---- scoreboard values ----
  const homeScore = liveScore?.home ?? 0;
  const oppScore = liveScore?.opponent ?? 0;

  const athleteLiveScore = athleteActor === 'home' ? homeScore : oppScore;
  const opponentLiveScore = athleteActor === 'home' ? oppScore : homeScore;

  // ---- result pill (W/L/T like others) ----
  const result = useMemo(() => {
    if (!finalScore) return null;
    const a = athleteActor === 'home' ? finalScore.home : finalScore.opponent;
    const b = athleteActor === 'home' ? finalScore.opponent : finalScore.home;

    const out: 'W' | 'L' | 'T' = a > b ? 'W' : a < b ? 'L' : 'T';
    const c = out === 'W' ? athleteColor : out === 'L' ? opponentColor : 'rgba(148,163,184,0.95)';

    return { text: `${out} ${a}–${b}`, color: c };
  }, [finalScore, athleteActor, athleteColor, opponentColor]);

  // ---- emit helper for edit-mode events ----
  const fire = (
    actor: 'home' | 'opponent' | 'neutral',
    key: string,
    label: string,
    value?: number,
    pillColor?: string,
    extraMeta?: Record<string, any>,
  ) => {
    const color = pillColor ?? 'rgba(148,163,184,0.9)';
    onOverlayEvent?.({
      actor: actor as any,
      key,
      value,
      label,
      meta: {
        pillColor: color,
        tint: color,
        color,
        buttonColor: color,
        chipColor: color,

        // persist mapping so PlaybackScreen can color belts safely too
        athleteColor,
        opponentColor,
        athleteActor,

        ...(extraMeta || {}),
      },
    } as any);
  };

  // ✅ safe to return now
  if (!overlayOn) return null;

  // =========================
  // BRANCH 1: NOT EDITING — show score/name pills
  // =========================
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
        {result ? (
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
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{result.text}</Text>
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
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: athleteColor,
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
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: opponentColor,
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

  // =========================
  // BRANCH 2: EDIT MODE — minimal Greco buttons
  // =========================
  const { width: screenW, height: screenH } = dims;
  const isPortrait = screenH >= screenW;

  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, screenH - TOP - BOTTOM);
  const ROWS = 3;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(36, Math.min(60, maxSize));
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  const Circle = ({ label, bg, onPress }: { label: string; bg: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ color: 'white', fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );

  const athleteButtons = [
    () => fire(athleteActor, 'takedown', 'TD2', 2, athleteColor),
    () => fire(athleteActor, 'exposure', 'EX2', 2, athleteColor),
    () => fire(athleteActor, 'out', 'OB1', 1, athleteColor),

    // placeholder emitters (you can swap to chooser UI later)
    () => fire('neutral', 'big', 'BIG', 0, athleteColor, { for: athleteActor }),
    () => fire('neutral', 'passivity', 'PASS', 0, athleteColor, { for: athleteActor }),
    () => fire('neutral', 'penalty', 'PEN', 0, athleteColor, { for: athleteActor }),
  ];

  const opponentButtons = [
    () => fire(opponentActor, 'takedown', 'TD2', 2, opponentColor),
    () => fire(opponentActor, 'exposure', 'EX2', 2, opponentColor),
    () => fire(opponentActor, 'out', 'OB1', 1, opponentColor),

    () => fire('neutral', 'big', 'BIG', 0, opponentColor, { for: opponentActor }),
    () => fire('neutral', 'passivity', 'PASS', 0, opponentColor, { for: opponentActor }),
    () => fire('neutral', 'penalty', 'PEN', 0, opponentColor, { for: opponentActor }),
  ];

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: TOP,
        bottom: BOTTOM,
      }}
    >
      {/* Left (athlete) */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: EDGE_L,
          top: 0,
          bottom: 0,
          alignItems: 'flex-start',
          width: COL_W,
        }}
      >
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
          <Circle label="TD2" bg={athleteColor} onPress={athleteButtons[0]} />
          <Circle label="EX2" bg={athleteColor} onPress={athleteButtons[1]} />
          <Circle label="OB1" bg={athleteColor} onPress={athleteButtons[2]} />
          <Circle label="BIG" bg={athleteColor} onPress={athleteButtons[3]} />
          <Circle label="PASS" bg={athleteColor} onPress={athleteButtons[4]} />
          <Circle label="PEN" bg={athleteColor} onPress={athleteButtons[5]} />
        </View>

        <View style={{ flex: 1 }} />
      </View>

      {/* Right (opponent) */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: EDGE_R,
          top: 0,
          bottom: 0,
          alignItems: 'flex-start',
          width: COL_W,
        }}
      >
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

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            width: COL_W,
            gap: GAP,
            justifyContent: 'flex-end',
          }}
        >
          <Circle label="TD2" bg={opponentColor} onPress={opponentButtons[0]} />
          <Circle label="EX2" bg={opponentColor} onPress={opponentButtons[1]} />
          <Circle label="OB1" bg={opponentColor} onPress={opponentButtons[2]} />
          <Circle label="BIG" bg={opponentColor} onPress={opponentButtons[3]} />
          <Circle label="PASS" bg={opponentColor} onPress={opponentButtons[4]} />
          <Circle label="PEN" bg={opponentColor} onPress={opponentButtons[5]} />
        </View>

        <View style={{ flex: 1 }} />
      </View>

      {/* tiny invisible spacer */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: isPortrait ? 6 : 0,
          left: EDGE_L,
          right: EDGE_R,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.0)', fontWeight: '800' }}>{' '}</Text>
      </View>
    </View>
  );
}
