// components/overlays/basketball/BasketballOverlay.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OverlayEvent, OverlayProps } from '../types';

const THEME = {
  panel: 'rgba(15,23,42,0.78)',
  panelBorder: 'rgba(255,255,255,0.14)',
  btnFill: 'rgba(0,0,0,0.40)',
  btnFillLit: 'rgba(255,255,255,0.06)',
  textDim: 'rgba(226,232,240,0.78)',
};

const COLORS = {
  assist: '#22c55e',
  pass: '#14b8a6',
  steal: '#38bdf8',
  block: '#a855f7',
  rebound: '#f59e0b',
  shot2: '#60a5fa',
  shot3: '#3b82f6',
  ft: '#93c5fd',
  turnover: '#ef4444',
  foul: '#fb7185',
  neutral: 'rgba(148,163,184,0.92)',
};

type ShotType = '2PT' | '3PT' | 'FT';
type Picker =
  | null
  | { kind: 'shot'; type: ShotType; btnId: string }
  | { kind: 'rebound'; btnId: string };

type Btn = {
  id: string;
  label: string;
  sub?: string;
  toast: string;
  key: string;
  color: string;
  kind?: 'good' | 'bad' | 'neutral';
};

const DEFAULT_PREROLL_SEC = 3;

function CircleButton({
  label,
  subLabel,
  ringColor,
  onPress,
  disabled,
  lit,
}: {
  label: string;
  subLabel?: string;
  ringColor: string;
  onPress: () => void;
  disabled?: boolean;
  lit?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: lit ? THEME.btnFillLit : THEME.btnFill,
        borderWidth: 2,
        borderColor: ringColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: lit ? 1.03 : 1 }],
        shadowColor: '#000',
        shadowOpacity: lit ? 0.35 : 0.22,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: lit ? 7 : 5,
        elevation: lit ? 4 : 2,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{label}</Text>
      {subLabel ? (
        <Text style={{ color: THEME.textDim, fontWeight: '900', fontSize: 10, marginTop: 1 }}>
          {subLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

function StatPill({ v, label }: { v: number | string; label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 }}>
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{v}</Text>
      <Text style={{ color: THEME.textDim, fontWeight: '900', fontSize: 9, marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: THEME.panelBorder }} />;
}

function ChoiceButton({
  label,
  bg,
  border,
  onPress,
}: {
  label: string;
  bg: string;
  border: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: border,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Center-screen chooser (not a Modal -> no rotation snap)
 * - tap outside closes
 * - slightly bigger than the tiny wrestling chooser
 */
function CenterChooser({
  title,
  accent,
  onCancel,
  children,
}: {
  title: string;
  accent: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <Pressable
        onPress={onCancel}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.25)', // not heavy
          zIndex: 60,
        }}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 18,
          zIndex: 61,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: 'rgba(0,0,0,0.78)',
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
            padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{title}</Text>
            <Pressable
              onPress={onCancel}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
            </Pressable>
          </View>

          <View style={{ height: 10 }} />
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
          <View style={{ height: 12 }} />

          {children}

          <View style={{ height: 8 }} />
          <View style={{ height: 2, backgroundColor: accent, borderRadius: 999, opacity: 0.75 }} />
        </View>
      </View>
    </>
  );
}

export default function BasketballOverlay({ isRecording, onEvent, getCurrentTSec }: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();

  const disableTaps = !isRecording;

  const [picker, setPicker] = useState<Picker>(null);

  // button flash
  const [litId, setLitId] = useState<string | null>(null);
  const litTimerRef = useRef<any>(null);

  // toast (only after final choice)
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastColor, setToastColor] = useState<string>(COLORS.neutral);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<any>(null);

  // quick in-overlay totals (UX only)
  const [stats, setStats] = useState({
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
    pf: 0,
    fgM: 0,
    fgA: 0,
    t3M: 0,
    t3A: 0,
    ftM: 0,
    ftA: 0,
  });

  useEffect(() => {
    if (!isRecording) setPicker(null);
  }, [isRecording]);

  const flashButton = (id: string) => {
    if (litTimerRef.current) clearTimeout(litTimerRef.current);
    setLitId(id);
    litTimerRef.current = setTimeout(() => setLitId(null), 180);
  };

  const showToast = (text: string, color: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastText(text);
    setToastColor(color);

    toastOpacity.stopAnimation();
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setToastText(null);
      });
    }, 900);
  };

  const emit = (
    key: string,
    label: string,
    tint: string,
    meta?: Record<string, any>,
    toast?: string,
    btnId?: string,
    value?: number
  ) => {
    if (btnId) flashButton(btnId);

    // ✅ toast happens ONLY when caller passes it (final decision)
    if (toast) showToast(toast, tint);

    const evt: OverlayEvent = {
      actor: 'neutral',
      key,
      label,
      value,
      meta: {
        pillColor: tint,
        tint,
        color: tint,
        chipColor: tint,
        buttonColor: tint,
        tSec: getCurrentTSec?.(),
        ...(meta || {}),
      },
    } as any;

    onEvent?.(evt);
  };

  const leftButtons: Btn[] = useMemo(
    () => [
      { id: 'L_AST', label: 'AST', sub: 'Assist', toast: 'Assist', key: 'assist', color: COLORS.assist, kind: 'good' },
      { id: 'L_PASS', label: 'PASS', sub: 'Pass', toast: 'Pass', key: 'pass', color: COLORS.pass, kind: 'good' },
      { id: 'L_REB', label: 'REB', sub: 'Rebound', toast: 'Rebound', key: 'rebound', color: COLORS.rebound, kind: 'good' },

      { id: 'L_STL', label: 'STL', sub: 'Steal', toast: 'Steal', key: 'steal', color: COLORS.steal, kind: 'good' },
      { id: 'L_BLK', label: 'BLK', sub: 'Block', toast: 'Block', key: 'block', color: COLORS.block, kind: 'good' },
      { id: 'L_TO', label: 'TO', sub: 'Turnover', toast: 'Turnover', key: 'turnover', color: COLORS.turnover, kind: 'bad' },
    ],
    []
  );

  const rightButtons: Btn[] = useMemo(
    () => [
      { id: 'R_2', label: '2PT', sub: 'Shot', toast: '2PT', key: 'shot2', color: COLORS.shot2, kind: 'neutral' },
      { id: 'R_3', label: '3PT', sub: 'Shot', toast: '3PT', key: 'shot3', color: COLORS.shot3, kind: 'neutral' },
      { id: 'R_FT', label: 'FT', sub: 'Free', toast: 'FT', key: 'ft', color: COLORS.ft, kind: 'neutral' },
      { id: 'R_PF', label: 'PF', sub: 'Foul', toast: 'Personal Foul', key: 'foul', color: COLORS.foul, kind: 'bad' },
    ],
    []
  );

  // layout
  const BTN = 58;
  const GAP = 10;
  const COLS = 2;

  const leftWidth = COLS * BTN + (COLS - 1) * GAP;
  const rightWidth = COLS * BTN + (COLS - 1) * GAP;

  const openShotPicker = (type: ShotType, btnId: string) => {
    if (disableTaps) return;
    flashButton(btnId);
    setPicker({ kind: 'shot', type, btnId }); // ✅ NO toast here
  };

  const openReboundPicker = (btnId: string) => {
    if (disableTaps) return;
    flashButton(btnId);
    setPicker({ kind: 'rebound', btnId }); // ✅ NO toast here
  };

  const logSimple = (b: Btn) => {
    // local UX stats
    setStats((s) => {
      if (b.key === 'assist') return { ...s, ast: s.ast + 1 };
      if (b.key === 'steal') return { ...s, stl: s.stl + 1 };
      if (b.key === 'block') return { ...s, blk: s.blk + 1 };
      if (b.key === 'turnover') return { ...s, to: s.to + 1 };
      if (b.key === 'foul') return { ...s, pf: s.pf + 1 };
      return s;
    });

    emit(b.key, b.toast, b.color, { kind: b.kind }, b.toast, b.id);
  };

  const shoot = (type: ShotType, made: boolean, btnId: string) => {
    const color = type === '2PT' ? COLORS.shot2 : type === '3PT' ? COLORS.shot3 : COLORS.ft;
    const points = type === '2PT' ? 2 : type === '3PT' ? 3 : 1;

    setStats((s) => {
      const next = { ...s };
      if (type === 'FT') next.ftA += 1;
      else next.fgA += 1;

      if (type === '3PT') next.t3A += 1;

      if (made) {
        if (type === 'FT') next.ftM += 1;
        else next.fgM += 1;

        if (type === '3PT') next.t3M += 1;

        next.pts += points;
      }
      return next;
    });

    emit(
      'shot',
      'Shot',
      color,
      { kind: made ? 'good' : 'neutral', shotType: type, made, attempt: true, points: made ? points : 0 },
      `${type} ${made ? 'Make' : 'Miss'}`, // ✅ toast only now
      btnId,
      made ? points : 0
    );

    setPicker(null);
  };

  const rebound = (type: 'off' | 'def', btnId: string) => {
    setStats((s) => ({ ...s, reb: s.reb + 1 }));

    emit(
      'rebound',
      'Rebound',
      COLORS.rebound,
      { rebound: type, kind: 'good' },
      type === 'off' ? 'Offensive Rebound' : 'Defensive Rebound', // ✅ toast only now
      btnId
    );

    setPicker(null);
  };

  // ---------- chooser render ----------
  const renderPicker = () => {
    if (!picker) return null;

    if (picker.kind === 'shot') {
      const type = picker.type;
      const accent = type === '2PT' ? COLORS.shot2 : type === '3PT' ? COLORS.shot3 : COLORS.ft;

      return (
        <CenterChooser title={`${type} Result`} accent={accent} onCancel={() => setPicker(null)}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ChoiceButton
              label="MAKE"
              bg={accent}
              border={accent}
              onPress={() => shoot(type, true, picker.btnId)}
            />
            <ChoiceButton
              label="MISS"
              bg="rgba(255,255,255,0.10)"
              border={accent}
              onPress={() => shoot(type, false, picker.btnId)}
            />
          </View>
        </CenterChooser>
      );
    }

    // rebound chooser
    return (
      <CenterChooser title="Rebound" accent={COLORS.rebound} onCancel={() => setPicker(null)}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ChoiceButton
            label="OFFENSE"
            bg={COLORS.rebound}
            border={COLORS.rebound}
            onPress={() => rebound('off', picker.btnId)}
          />
          <ChoiceButton
            label="DEFENSE"
            bg="rgba(255,255,255,0.10)"
            border={COLORS.rebound}
            onPress={() => rebound('def', picker.btnId)}
          />
        </View>
      </CenterChooser>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {/* Top mini box-score bar */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 10,
          left: insets.left + 10,
          right: insets.right + 10,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: THEME.panel,
            borderWidth: 1,
            borderColor: THEME.panelBorder,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <StatPill v={stats.pts} label="PTS" />
          <Divider />
          <StatPill v={stats.reb} label="REB" />
          <Divider />
          <StatPill v={stats.ast} label="AST" />
          <Divider />
          <StatPill v={stats.stl} label="STL" />
          <Divider />
          <StatPill v={stats.blk} label="BLK" />
          <Divider />
          <StatPill v={stats.to} label="TO" />
          <Divider />
          <StatPill v={stats.pf} label="PF" />
          <Divider />
          <StatPill v={`${stats.fgM}/${stats.fgA}`} label="FG" />
          <Divider />
          <StatPill v={`${stats.t3M}/${stats.t3A}`} label="3PT" />
          <Divider />
          <StatPill v={`${stats.ftM}/${stats.ftA}`} label="FT" />
        </View>
      </View>

      {/* Last action toast pill */}
      {toastText ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 70,
            left: insets.left + 12,
            right: insets.right + 12,
            alignItems: 'center',
            opacity: toastOpacity,
            transform: [
              { translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            ],
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.72)',
              borderWidth: 1.5,
              borderColor: toastColor,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 13 }}>{toastText}</Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Left grid */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: insets.left + 12,
          top: insets.top + 110,
          bottom: insets.bottom + 110,
          width: leftWidth,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {leftButtons.map((b) => (
            <CircleButton
              key={b.id}
              label={b.label}
              subLabel={b.sub}
              ringColor={b.color}
              disabled={disableTaps}
              lit={litId === b.id}
              onPress={() => {
                if (b.key === 'rebound') return openReboundPicker(b.id);
                logSimple(b);
              }}
            />
          ))}
        </View>
      </View>

      {/* Right grid */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: insets.right + 12,
          top: insets.top + 110,
          bottom: insets.bottom + 110,
          width: rightWidth,
          alignItems: 'flex-end',
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'flex-end' }}>
          {rightButtons.map((b) => (
            <CircleButton
              key={b.id}
              label={b.label}
              subLabel={b.sub}
              ringColor={b.color}
              disabled={disableTaps}
              lit={litId === b.id}
              onPress={() => {
                if (b.key === 'shot2') return openShotPicker('2PT', b.id);
                if (b.key === 'shot3') return openShotPicker('3PT', b.id);
                if (b.key === 'ft') return openShotPicker('FT', b.id);
                logSimple(b);
              }}
            />
          ))}
        </View>
      </View>

      {/* Center chooser */}
      {renderPicker()}
    </View>
  );
}
