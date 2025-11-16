// components/modules/wrestling/WrestlingFolkstylePlaybackModule.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
  // NEW: we use these to infer the color that was active while recording
  now,
  events,
}: PlaybackModuleProps) {
  // If overlay is off, nothing draws (same as before)
  if (!overlayOn) return null;

  const homeScore = liveScore?.home ?? 0;
  const oppScore = liveScore?.opponent ?? 0;

  // Who is “my kid” in the score?
  const athleteIsHome = homeIsAthlete;
  const athleteLiveScore = athleteIsHome ? homeScore : oppScore;
  const opponentLiveScore = athleteIsHome ? oppScore : homeScore;

  // Name to show for athlete (same idea as displayAthlete)
  const athleteLabel = (athleteName ?? '').trim() || 'Athlete';
  const opponentLabel = 'Opponent';

  // ========= COLOR MAPPING FROM RECORDING (per-event myKidColor/opponentColor) =========
  // We look for the most recent event at or before `now` that has myKidColor/opponentColor.
  // If none, we fall back to the last colored event, then to `homeColorIsGreen`.
  let athleteColor = homeColorIsGreen !== false ? GREEN : RED;
  let opponentColor = homeColorIsGreen !== false ? RED : GREEN;

  if (Array.isArray(events) && events.length > 0) {
    const tNow = typeof now === 'number' ? now : 0;

    const pickColorValue = (val: any): 'green' | 'red' | undefined => {
      const v = String(val ?? '').toLowerCase();
      if (v === 'green') return 'green';
      if (v === 'red') return 'red';
      return undefined;
    };

    // Find latest event at/ before `now` that has myKidColor
    let chosen: any = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.t <= tNow && e.meta && (e.meta.myKidColor || e.meta?.meta?.myKidColor)) {
        chosen = e;
        break;
      }
    }

    // If none at/ before now, fall back to last event that has colors
    if (!chosen) {
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.meta && (e.meta.myKidColor || e.meta?.meta?.myKidColor)) {
          chosen = e;
          break;
        }
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
        // if only myKidColor known, derive opponentColor as the opposite
        athleteColor = mkHex;
        opponentColor = mkHex === GREEN ? RED : GREEN;
      } else if (oppHex) {
        opponentColor = oppHex;
        athleteColor = oppHex === GREEN ? RED : GREEN;
      }
    }
  }

  // All scoring we do in playback edit mode is for your athlete
  const scoringActor: 'home' | 'opponent' = athleteIsHome ? 'home' : 'opponent';

  // Let palette know if we're in add/replace mode
  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  // Small local state for NF / S-C / PIN choosers (like the recording overlay)
  const [nfOpen, setNfOpen] = useState(false);
  const [scOpen, setScOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  // fire() sends an event back to PlaybackScreen, which then
  // inserts or replaces the event at the current time.
  const fire = (
    key: string,
    value: number | undefined,
    label: string,
    meta?: Record<string, any>
  ) => {
    onOverlayEvent?.({
      actor: scoringActor, // always “my kid” in playback editing
      key,
      value,
      label,
      ...(meta ? { meta } : {}),
    });
  };

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
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{resultLabel}</Text>
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

      {/* ====== EDIT / REPLACE PALETTE (like original overlay) ====== */}
      {showPalette && (
        <>
          {/* Main button row: T3 / E1 / R2 / NF / S-C / PIN */}
          <View
            style={{
              marginTop: 18,
              alignSelf: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.22)',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            {/* T3 */}
            <Pressable
              onPress={() => fire('takedown', 3, 'T3')}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: athleteColor,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>T3</Text>
            </Pressable>

            {/* E1 */}
            <Pressable
              onPress={() => fire('escape', 1, 'E1')}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: athleteColor,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>E1</Text>
            </Pressable>

            {/* R2 */}
            <Pressable
              onPress={() => fire('reversal', 2, 'R2')}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: athleteColor,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>R2</Text>
            </Pressable>

            {/* NF chooser open */}
            <Pressable
              onPress={() => setNfOpen(true)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: '#eab308',
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>NF</Text>
            </Pressable>

            {/* S/C chooser open */}
            <Pressable
              onPress={() => setScOpen(true)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: '#f97316',
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>S/C</Text>
            </Pressable>

            {/* PIN confirm open */}
            <Pressable
              onPress={() => setPinOpen(true)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: '#d4a017',
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>PIN</Text>
            </Pressable>
          </View>

          {/* ====== NF chooser (NF2 / NF3 / NF4) ====== */}
          {nfOpen && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: insets.top + 120,
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  maxWidth: 320,
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
                <Text style={{ color: '#fff', fontWeight: '900', marginRight: 6 }}>Nearfall points</Text>

                {[2, 3, 4].map(v => (
                  <Pressable
                    key={v}
                    onPress={() => {
                      fire('nearfall', v, `NF${v}`);
                      setNfOpen(false);
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
                  onPress={() => setNfOpen(false)}
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
          )}

          {/* ====== S/C chooser (simplified version of overlay) ====== */}
          {scOpen && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: insets.top + 120,
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  maxWidth: 340,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '900',
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  Caution / Stalling
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {/* Caution WARN (0pt) */}
                  <Pressable
                    onPress={() => {
                      fire('caution', 0, 'CAUTION WARN', { kind: 'caution' });
                      setScOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: '#64748b',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Caution Warn</Text>
                  </Pressable>

                  {/* Caution +1 */}
                  <Pressable
                    onPress={() => {
                      fire('caution', 1, 'CAUTION +1', { kind: 'caution' });
                      setScOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: '#22c55e',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Caution +1</Text>
                  </Pressable>

                  {/* Stall WARN (0pt) */}
                  <Pressable
                    onPress={() => {
                      fire('stalling', 0, 'ST WARN', { kind: 'stall' });
                      setScOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: '#f97316',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Stall Warn</Text>
                  </Pressable>

                  {/* Stall +1 */}
                  <Pressable
                    onPress={() => {
                      fire('stalling', 1, 'ST +1', { kind: 'stall' });
                      setScOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: '#ea580c',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Stall +1</Text>
                  </Pressable>

                  {/* Stall +2 */}
                  <Pressable
                    onPress={() => {
                      fire('stalling', 2, 'ST +2', { kind: 'stall' });
                      setScOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: '#b91c1c',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Stall +2</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setScOpen(false)}
                  style={{
                    alignSelf: 'center',
                    marginTop: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ====== PIN confirm (like overlay) ====== */}
          {pinOpen && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: insets.top + 120,
                left: 0,
                right: 0,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  maxWidth: 320,
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
                  Confirm PIN for {athleteLabel}?
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <Pressable
                    onPress={() => setPinOpen(false)}
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
                      fire('pin', 0, 'PIN', { winBy: 'pin' });
                      setPinOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: '#d4a017',
                    }}
                  >
                    <Text style={{ color: '#111', fontWeight: '900' }}>Confirm</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}
