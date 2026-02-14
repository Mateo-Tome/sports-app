// components/overlays/basketball/BasketballOverlay.tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OverlayEvent, OverlayProps } from '../types';

// ✅ basketball-spec (buttons, colors, lanes, shot tint/points)
import {
    BB_COLORS,
    LEFT_BTNS,
    RIGHT_BTNS,
    laneForAction,
    pointsForShot,
    tintForShot,
    type OverlayBtn,
    type ShotType,
} from './basketballUiSpec';

const THEME = {
  panel: 'rgba(15,23,42,0.78)',
  panelBorder: 'rgba(255,255,255,0.14)',
  btnFill: 'rgba(0,0,0,0.40)',
  btnFillLit: 'rgba(255,255,255,0.06)',
  textDim: 'rgba(226,232,240,0.78)',
};

type Picker =
  | null
  | { kind: 'shot'; type: ShotType; btnId: string }
  | { kind: 'rebound'; btnId: string };

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
          backgroundColor: 'rgba(0,0,0,0.25)',
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
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
  const disableTaps = !isRecording;

  const [picker, setPicker] = useState<Picker>(null);

  // button flash
  const [litId, setLitId] = useState<string | null>(null);
  const litTimerRef = useRef<any>(null);

  // toast (only after final choice)
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastColor, setToastColor] = useState<string>(BB_COLORS.neutral);
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
    value?: number,
  ) => {
    if (btnId) flashButton(btnId);

    if (toast) showToast(toast, tint);

    // ✅ belt lane is decided here (basketball-only, clean)
    const beltLane = laneForAction(key, meta);

    const evt: OverlayEvent = {
      actor: 'neutral',
      key,
      label,
      value,
      meta: {
        beltLane, // ✅ EventBelt uses this; no shared sport logic needed
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

  const openShotPicker = (type: ShotType, btnId: string) => {
    if (disableTaps) return;
    flashButton(btnId);
    setPicker({ kind: 'shot', type, btnId });
  };

  const openReboundPicker = (btnId: string) => {
    if (disableTaps) return;
    flashButton(btnId);
    setPicker({ kind: 'rebound', btnId });
  };

  const logSimple = (b: OverlayBtn) => {
    // local UX stats
    setStats((s) => {
      if (b.action === 'assist') return { ...s, ast: s.ast + 1 };
      if (b.action === 'steal') return { ...s, stl: s.stl + 1 };
      if (b.action === 'block') return { ...s, blk: s.blk + 1 };
      if (b.action === 'turnover') return { ...s, to: s.to + 1 };
      if (b.action === 'foul') return { ...s, pf: s.pf + 1 };
      return s;
    });

    const toast = b.sub ?? b.label;

    emit(
      b.action,
      toast,
      b.ringColor,
      { kind: b.action },
      toast,
      b.id,
    );
  };

  const shoot = (type: ShotType, made: boolean, btnId: string) => {
    const tint = tintForShot(type, made); // ✅ miss -> red, make -> family color
    const pts = pointsForShot(type);

    setStats((s) => {
      const next = { ...s };

      if (type === 'FT') next.ftA += 1;
      else next.fgA += 1;

      if (type === '3PT') next.t3A += 1;

      if (made) {
        if (type === 'FT') next.ftM += 1;
        else next.fgM += 1;

        if (type === '3PT') next.t3M += 1;

        next.pts += pts;
      }
      return next;
    });

    emit(
      'shot',
      'Shot',
      tint,
      { shotType: type, made, attempt: true },
      `${type} ${made ? 'Make' : 'Miss'}`,
      btnId,
      made ? pts : 0,
    );

    setPicker(null);
  };

  const rebound = (type: 'off' | 'def', btnId: string) => {
    setStats((s) => ({ ...s, reb: s.reb + 1 }));

    emit(
      'rebound',
      'Rebound',
      BB_COLORS.rebound,
      { rebound: type },
      type === 'off' ? 'Offensive Rebound' : 'Defensive Rebound',
      btnId,
    );

    setPicker(null);
  };

  const renderPicker = () => {
    if (!picker) return null;

    if (picker.kind === 'shot') {
      const type = picker.type;
      const accent =
        type === '2PT' ? BB_COLORS.shot2 : type === '3PT' ? BB_COLORS.shot3 : BB_COLORS.ft;

      return (
        <CenterChooser title={`${type} Result`} accent={accent} onCancel={() => setPicker(null)}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ChoiceButton label="MAKE" bg={accent} border={accent} onPress={() => shoot(type, true, picker.btnId)} />
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

    return (
      <CenterChooser title="Rebound" accent={BB_COLORS.rebound} onCancel={() => setPicker(null)}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ChoiceButton label="OFFENSE" bg={BB_COLORS.rebound} border={BB_COLORS.rebound} onPress={() => rebound('off', picker.btnId)} />
          <ChoiceButton label="DEFENSE" bg="rgba(255,255,255,0.10)" border={BB_COLORS.rebound} onPress={() => rebound('def', picker.btnId)} />
        </View>
      </CenterChooser>
    );
  };

  // layout
  const BTN = 58;
  const GAP = 10;
  const COLS = 2;
  const leftWidth = COLS * BTN + (COLS - 1) * GAP;
  const rightWidth = COLS * BTN + (COLS - 1) * GAP;

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
            transform: [{ translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
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
          {LEFT_BTNS.map((b) => (
            <CircleButton
              key={b.id}
              label={b.label}
              subLabel={b.sub}
              ringColor={b.ringColor}
              disabled={disableTaps}
              lit={litId === b.id}
              onPress={() => {
                if (b.action === 'rebound') return openReboundPicker(b.id);
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
          {RIGHT_BTNS.map((b) => (
            <CircleButton
              key={b.id}
              label={b.label}
              subLabel={b.sub}
              ringColor={b.ringColor}
              disabled={disableTaps}
              lit={litId === b.id}
              onPress={() => {
                if (b.action === 'shot2') return openShotPicker('2PT', b.id);
                if (b.action === 'shot3') return openShotPicker('3PT', b.id);
                if (b.action === 'ft') return openShotPicker('FT', b.id);
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
