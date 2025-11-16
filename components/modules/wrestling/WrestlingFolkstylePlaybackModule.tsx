// components/modules/wrestling/WrestlingFolkstylePlaybackModule.tsx
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
}: PlaybackModuleProps) {
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

  // Color mapping from recording:
  const colorIsGreen = homeColorIsGreen !== false; // default true
  const athleteColor = colorIsGreen ? GREEN : RED;
  const opponentColor = colorIsGreen ? RED : GREEN;

  // Buttons score for your athlete
  const scoringActor = athleteIsHome ? 'home' : 'opponent';

  const fire = (key: string, value: number, label: string) => {
    onOverlayEvent?.({
      actor: scoringActor,
      key,
      value,
      label,
    });
  };

  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

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

        {/* just a spacer so the container has some height */}
        <View style={{ height: 32 }} />
      </View>

      {/* Palette only visible in edit mode */}
      {showPalette && (
        <View
          style={{
            marginTop: 16,
            alignSelf: 'center',
            padding: 10,
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
          {/* T2 */}
          <Pressable
            onPress={() => fire('takedown', 2, 'T2')}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: '#16a34a',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>T2</Text>
          </Pressable>

          {/* E1 */}
          <Pressable
            onPress={() => fire('escape', 1, 'E1')}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: '#22c55e',
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
              backgroundColor: '#3b82f6',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>R2</Text>
          </Pressable>

          {/* NF2 */}
          <Pressable
            onPress={() => fire('nearfall', 2, 'NF2')}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: '#eab308',
            }}
          >
            <Text style={{ color: '#111', fontWeight: '900' }}>NF2</Text>
          </Pressable>

          {/* NF3 */}
          <Pressable
            onPress={() => fire('nearfall', 3, 'NF3')}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: '#f97316',
            }}
          >
            <Text style={{ color: '#111', fontWeight: '900' }}>NF3</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
