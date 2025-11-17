// components/modules/wrestling/WrestlingFolkstylePlaybackModule.tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { PlaybackModuleProps } from '../types';

const GREEN = '#16a34a';
const RED = '#dc2626';

// tiny helper to match the old PlaybackScreen look
function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function WrestlingFolkstylePlaybackModule({
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
  // we’ll still accept these, but only use events to see final color
  now: _now,
  events,
}: PlaybackModuleProps) {
  // If overlay is off, nothing draws (same as before)
  if (!overlayOn) return null;

  const { width, height } = useWindowDimensions();
  const isPortrait = height >= width;

  const homeScore = liveScore?.home ?? 0;
  const oppScore = liveScore?.opponent ?? 0;

  // Who is “my kid” in the score?
  const athleteIsHome = homeIsAthlete;
  const athleteLiveScore = athleteIsHome ? homeScore : oppScore;
  const opponentLiveScore = athleteIsHome ? oppScore : homeScore;

  // Name to show for athlete (same idea as displayAthlete)
  const athleteLabel = (athleteName ?? '').trim() || 'Athlete';
  const opponentLabel = 'Opponent';

  // ========= COLOR MAPPING BY HOW THE MATCH ENDED =========
  // Default from sidecar/global flag:
  let athleteColor = homeColorIsGreen !== false ? GREEN : RED;
  let opponentColor = homeColorIsGreen !== false ? RED : GREEN;

  if (Array.isArray(events) && events.length > 0) {
    // We only care about the *final* color state when the match ended.
    // So: look at the LAST event that has myKidColor/opponentColor.
    const pickColorValue = (val: any): 'green' | 'red' | undefined => {
      const v = String(val ?? '').toLowerCase();
      if (v === 'green') return 'green';
      if (v === 'red') return 'red';
      return undefined;
    };

    let chosen: any = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (
        e.meta &&
        (e.meta.myKidColor ||
          e.meta?.meta?.myKidColor ||
          e.meta.opponentColor ||
          e.meta?.meta?.opponentColor)
      ) {
        chosen = e;
        break;
      }
    }

    if (chosen) {
      const meta: any = chosen.meta ?? {};
      const inner: any = meta.meta ?? {};

      const myKidColorStr =
        pickColorValue(meta.myKidColor) ?? pickColorValue(inner.myKidColor);
      const opponentColorStr =
        pickColorValue(meta.opponentColor) ?? pickColorValue(inner.opponentColor);

      const mapToHex = (c: 'green' | 'red' | undefined) => {
        if (c === 'green') return GREEN;
        if (c === 'red') return RED;
        return undefined;
      };

      const mkHex = mapToHex(myKidColorStr);
      const oppHex = mapToHex(opponentColorStr);

      if (mkHex && oppHex) {
        athleteColor = mkHex;
        opponentColor = oppHex;
      } else if (mkHex) {
        // only myKidColor known ⇒ opponent = opposite
        athleteColor = mkHex;
        opponentColor = mkHex === GREEN ? RED : GREEN;
      } else if (oppHex) {
        opponentColor = oppHex;
        athleteColor = oppHex === GREEN ? RED : GREEN;
      }
    }
  }

  // All scoring we do in playback was originally for your athlete
  const athleteActor: 'home' | 'opponent' = athleteIsHome ? 'home' : 'opponent';
  const opponentActor: 'home' | 'opponent' =
    athleteActor === 'home' ? 'opponent' : 'home';

  // Let palette know if we're in add/replace mode
  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  // ===== EDIT PALETTE STATE (mimic overlay: my kid color + both sides) =====
  const [editMyKidColor, setEditMyKidColor] = useState<'green' | 'red'>(
    athleteColor === GREEN ? 'green' : 'red'
  );

  // keep edit palette in sync if the final match color changes
  useEffect(() => {
    setEditMyKidColor(athleteColor === GREEN ? 'green' : 'red');
  }, [athleteColor]);

  const editAthleteColor = editMyKidColor === 'green' ? GREEN : RED;
  const editOpponentColor = editMyKidColor === 'green' ? RED : GREEN;

  // Which side are we editing NF / S/C / PIN for?
  const [nfFor, setNfFor] = useState<null | 'athlete' | 'opponent'>(null);
  const [scFor, setScFor] = useState<null | 'athlete' | 'opponent'>(null);
  const [pinFor, setPinFor] = useState<null | 'athlete' | 'opponent'>(null);

  // local counts just to show "Next: ..." in the S/C popup (like overlay)
  const [stallCount, setStallCount] = useState<{ athlete: number; opponent: number }>({
    athlete: 0,
    opponent: 0,
  });
  const [cautionCount, setCautionCount] = useState<{ athlete: number; opponent: number }>({
    athlete: 0,
    opponent: 0,
  });

  // fire helpers – always attach myKidColor/opponentColor meta so the belt + pills stay consistent
  const myKidColorStr = editMyKidColor;
  const opponentColorStr = editMyKidColor === 'green' ? 'red' : 'green';

  const fireFor = (
    actor: 'home' | 'opponent',
    key: string,
    value: number | undefined,
    label: string,
    meta?: Record<string, any>
  ) => {
    onOverlayEvent?.({
      actor,
      key,
      value,
      label,
      meta: {
        ...(meta || {}),
        myKidColor: myKidColorStr,
        opponentColor: opponentColorStr,
      },
    });
  };

  const fireAthlete = (
    key: string,
    value: number | undefined,
    label: string,
    meta?: Record<string, any>
  ) => fireFor(athleteActor, key, value, label, meta);

  const fireOpponent = (
    key: string,
    value: number | undefined,
    label: string,
    meta?: Record<string, any>
  ) => fireFor(opponentActor, key, value, label, meta);

  // ==== Final outcome summary: W/L/T & final score, color-coded ====
  let resultLabel = '';
  let resultColor = 'rgba(148,163,184,0.95)'; // neutral slate
  if (finalScore) {
    const a = athleteIsHome ? finalScore.home : finalScore.opponent;
    const b = athleteIsHome ? finalScore.opponent : finalScore.home;

    let out: 'W' | 'L' | 'T';
    if (a > b) out = 'W';
    else if (a < b) out = 'L';
    else out = 'T';

    resultLabel = `${out} ${a}–${b}`;
    if (out === 'W') resultColor = athleteColor;
    else if (out === 'L') resultColor = opponentColor;
  }

  // =========================
  // BRANCH 1: NOT EDITING
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
        {/* Top-center result pill (W/L/T + final score) */}
        {resultLabel ? (
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderWidth: 1,
                borderColor: resultColor,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                {resultLabel}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Athlete / Opponent score chips – SAME LOOK as old PlaybackScreen */}
        <View
          style={{
            marginTop: 6,
            paddingHorizontal: 24,
          }}
        >
          {/* Left: Athlete */}
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

          {/* Right: Opponent */}
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

          {/* spacer to give this container height */}
          <View style={{ height: 32 }} />
        </View>
      </View>
    );
  }

  // =========================
  // BRANCH 2: EDIT MODE
  // (Make it look like the live overlay)
  // =========================

  const screenW = width;
  const screenH = height;

  // same layout constants as WrestlingFolkstyleOverlay
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, screenH - TOP - BOTTOM);
  const TITLE_H = 28;
  const ROWS = 3;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - TITLE_H - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(36, Math.min(60, maxSize));
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;

  const CHOOSER_TOP = isPortrait ? 140 : 6;

  const EditCircle = ({
    label,
    color,
    onPress,
  }: {
    label: string;
    color: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );

  // ====== S/C + NF + PIN helpers (same logic as before, but positioned like overlay) ======

  // ====== NF chooser (NF2 / NF3 / NF4) – side-aware (athlete vs opponent) ======
  const NFChooser = () =>
    nfFor && (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: CHOOSER_TOP,
          left: EDGE_L,
          right: EDGE_R,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            maxWidth: Math.min(340, screenW - (EDGE_L + EDGE_R)),
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', marginRight: 6 }}>
            Nearfall points • {nfFor === 'athlete' ? athleteLabel : opponentLabel}
          </Text>

          {[2, 3, 4].map(v => (
            <Pressable
              key={v}
              onPress={() => {
                if (nfFor === 'athlete') {
                  fireAthlete('nearfall', v, `NF${v}`);
                } else {
                  fireOpponent('nearfall', v, `NF${v}`);
                }
                setNfFor(null);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#eab308',
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>{v}</Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setNfFor(null)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.1)',
              marginLeft: 4,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );

  // ====== S/C chooser – overlay-style (Next: Warn/+1/+2) ======
  const SCCooser = () =>
    scFor && (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: CHOOSER_TOP,
          left: EDGE_L,
          right: EDGE_R,
          alignItems: 'center',
        }}
      >
        {(() => {
          const offenderKey: 'athlete' | 'opponent' = scFor;
          const offenderActor =
            offenderKey === 'athlete' ? athleteActor : opponentActor;
          const offenderLabel =
            offenderKey === 'athlete' ? athleteLabel : opponentLabel;
          const offenderColor =
            offenderKey === 'athlete' ? editAthleteColor : editOpponentColor;
          const receiverActor: 'home' | 'opponent' =
            offenderActor === 'home' ? 'opponent' : 'home';

          const bumpStall = (kind: 'warn' | '+1' | '+2') => {
            setStallCount(prev => {
              const current = prev[offenderKey];
              let nextBase = current;
              if (kind === 'warn') nextBase = Math.max(current, 0);
              if (kind === '+1') nextBase = Math.max(current, 1);
              if (kind === '+2') nextBase = Math.max(current, 3);
              return { ...prev, [offenderKey]: nextBase + 1 };
            });
          };

          const bumpCaution = (kind: 'warn' | '+1') => {
            setCautionCount(prev => {
              const current = prev[offenderKey];
              let nextBase = current;
              if (kind === 'warn') nextBase = Math.max(current, 0);
              if (kind === '+1') nextBase = Math.max(current, 2);
              return { ...prev, [offenderKey]: nextBase + 1 };
            });
          };

          const stc = stallCount[offenderKey];
          const stNext =
            stc <= 0 ? 'Warn' : stc === 1 || stc === 2 ? '+1' : '+2';

          const cc = cautionCount[offenderKey];
          const cNext = cc <= 1 ? 'Warn' : '+1';

          const Tag = ({ text }: { text: string }) => (
            <View
              style={{
                marginLeft: 6,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: '800',
                }}
              >
                Next: {text}
              </Text>
            </View>
          );

          const ChipBtn = ({
            label,
            onPress,
          }: {
            label: string;
            onPress: () => void;
          }) => (
            <Pressable
              onPress={() => {
                onPress();
                setScFor(null);
              }}
              style={{
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: offenderColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginHorizontal: 6,
                marginVertical: 4,
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>
                {label}
              </Text>
            </Pressable>
          );

          return (
            <View
              style={{
                maxWidth: Math.min(340, screenW - (EDGE_L + EDGE_R)),
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '900',
                    fontSize: 14,
                    marginRight: 8,
                  }}
                >
                  {offenderLabel}: S/C
                </Text>
                <Pressable
                  onPress={() => setScFor(null)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>

              {/* Caution row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '800',
                    marginRight: 6,
                  }}
                >
                  Caution
                </Text>
                <Tag text={cNext} />

                <ChipBtn
                  label="Warn"
                  onPress={() => {
                    bumpCaution('warn');
                    if (offenderKey === 'athlete') {
                      fireAthlete('caution', 0, 'CAUTION WARN', {
                        kind: 'caution',
                        offender: offenderActor,
                      });
                    } else {
                      fireOpponent('caution', 0, 'CAUTION WARN', {
                        kind: 'caution',
                        offender: offenderActor,
                      });
                    }
                  }}
                />

                <ChipBtn
                  label="+1"
                  onPress={() => {
                    bumpCaution('+1');
                    // +1 goes to the *other* actor
                    fireFor(receiverActor, 'caution', 1, 'CAUTION +1', {
                      kind: 'caution',
                      offender: offenderActor,
                    });
                  }}
                />
              </View>

              {/* Divider */}
              <View
                style={{
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  marginVertical: 6,
                }}
              />

              {/* Stalling row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '800',
                    marginRight: 6,
                  }}
                >
                  Stalling
                </Text>
                <Tag text={stNext} />

                <ChipBtn
                  label="Warn"
                  onPress={() => {
                    bumpStall('warn');
                    if (offenderKey === 'athlete') {
                      fireAthlete('stalling', 0, 'ST WARN', {
                        kind: 'stall',
                        offender: offenderActor,
                      });
                    } else {
                      fireOpponent('stalling', 0, 'ST WARN', {
                        kind: 'stall',
                        offender: offenderActor,
                      });
                    }
                  }}
                />

                <ChipBtn
                  label="+1"
                  onPress={() => {
                    bumpStall('+1');
                    fireFor(receiverActor, 'stalling', 1, 'ST +1', {
                      kind: 'stall',
                      offender: offenderActor,
                    });
                  }}
                />

                <ChipBtn
                  label="+2"
                  onPress={() => {
                    bumpStall('+2');
                    fireFor(receiverActor, 'stalling', 2, 'ST +2', {
                      kind: 'stall',
                      offender: offenderActor,
                      note: 'Stoppage/choice',
                    });
                  }}
                />
              </View>
            </View>
          );
        })()}
      </View>
    );

  // ====== PIN confirm – side-aware ======
  const PinConfirm = () =>
    pinFor && (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: CHOOSER_TOP,
          left: EDGE_L,
          right: EDGE_R,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            maxWidth: Math.min(340, screenW - (EDGE_L + EDGE_R)),
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '900',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            Confirm PIN for {pinFor === 'athlete' ? athleteLabel : opponentLabel}?
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => setPinFor(null)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (pinFor === 'athlete') {
                  fireAthlete('pin', 0, 'PIN', { winBy: 'pin' });
                } else {
                  fireOpponent('pin', 0, 'PIN', { winBy: 'pin' });
                }
                setPinFor(null);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: '#d4a017',
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>
                Confirm
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );

  // =========================
  // EDIT MODE LAYOUT (overlay-style)
  // =========================
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
      {/* Flip colors control — same vibe/position as overlay */}
      <View
        style={{
          position: 'absolute',
          top: -36,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() =>
            setEditMyKidColor(c => (c === 'green' ? 'red' : 'green'))
          }
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            Flip Colors (My Kid: {editMyKidColor.toUpperCase()})
          </Text>
        </Pressable>
      </View>

      {/* Left grid (athlete) */}
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
            backgroundColor: editAthleteColor,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          {athleteLabel}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            width: COL_W,
            gap: GAP,
          }}
        >
          <EditCircle
            label="T3"
            color={editAthleteColor}
            onPress={() => fireAthlete('takedown', 3, 'T3')}
          />
          <EditCircle
            label="E1"
            color={editAthleteColor}
            onPress={() => fireAthlete('escape', 1, 'E1')}
          />
          <EditCircle
            label="R2"
            color={editAthleteColor}
            onPress={() => fireAthlete('reversal', 2, 'R2')}
          />
          <EditCircle
            label="NF"
            color={editAthleteColor}
            onPress={() => setNfFor('athlete')}
          />
          <EditCircle
            label="S/C"
            color={editAthleteColor}
            onPress={() => setScFor('athlete')}
          />
          <EditCircle
            label="PIN"
            color={editAthleteColor}
            onPress={() => setPinFor('athlete')}
          />
        </View>
      </View>

      {/* Right grid (opponent) */}
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
            backgroundColor: editOpponentColor,
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
          <EditCircle
            label="T3"
            color={editOpponentColor}
            onPress={() => fireOpponent('takedown', 3, 'T3')}
          />
          <EditCircle
            label="E1"
            color={editOpponentColor}
            onPress={() => fireOpponent('escape', 1, 'E1')}
          />
          <EditCircle
            label="R2"
            color={editOpponentColor}
            onPress={() => fireOpponent('reversal', 2, 'R2')}
          />
          <EditCircle
            label="NF"
            color={editOpponentColor}
            onPress={() => setNfFor('opponent')}
          />
          <EditCircle
            label="S/C"
            color={editOpponentColor}
            onPress={() => setScFor('opponent')}
          />
          <EditCircle
            label="PIN"
            color={editOpponentColor}
            onPress={() => setPinFor('opponent')}
          />
        </View>
      </View>

      {/* Popups aligned like overlay, safely under the camera bump */}
      <NFChooser />
      <SCCooser />
      <PinConfirm />
    </View>
  );
}
