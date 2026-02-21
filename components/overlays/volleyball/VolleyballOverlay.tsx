// VolleyballOverlay.tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OverlayEvent, OverlayProps } from '../types';

const BORDER = 'rgba(255,255,255,0.18)';
const TEXT_DIM = 'rgba(255,255,255,0.82)';

// Unique colors per button (not blocky)
const COLORS = {
  kill: '#22c55e',
  ace: '#f59e0b',
  block: '#a855f7', // ✅ keep block purple (do NOT collide with net)
  dig: '#38bdf8',
  pass: '#14b8a6',
  serveIn: '#60a5fa', // Serve In
  attack: '#16a34a', // slightly different green than Kill

  // ✅ Errors: all red variants (worst = deepest red)
  serveError: '#f87171',        // light red
  net: '#ef4444',               // medium red
  ballHandlingError: '#dc2626', // strong red
  otherError: '#b91c1c',        // deeper red (other)
  attackError: '#991b1b',       // ✅ deepest red (worst)

  neutral: 'rgba(148,163,184,0.92)',
};

type Btn = {
  id: string;
  label: string; // short button label
  sub?: string; // tiny text under label
  action: string; // FULL word used for toast
  key: string;
  color: string;
  value?: number;
  kind?: 'good' | 'bad' | 'neutral';
};

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
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: lit ? ringColor : 'rgba(0,0,0,0.28)',
        borderWidth: 2,
        borderColor: ringColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: lit ? 1.03 : 1 }],
        shadowColor: '#000',
        shadowOpacity: lit ? 0.35 : 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: lit ? 6 : 4,
        elevation: lit ? 3 : 2,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>
        {label}
      </Text>
      {subLabel ? (
        <Text
          style={{
            color: lit ? 'rgba(255,255,255,0.92)' : TEXT_DIM,
            fontWeight: '800',
            fontSize: 10,
            marginTop: 1,
          }}
        >
          {subLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function VolleyballOverlay({
  isRecording,
  onEvent,
  getCurrentTSec,
}: OverlayProps) {
  const insets = useSafeAreaInsets();

  const [passChooserOpen, setPassChooserOpen] = useState(false);

  // visual feedback states
  const [litId, setLitId] = useState<string | null>(null);
  const litTimerRef = useRef<any>(null);

  const [toastText, setToastText] = useState<string | null>(null);
  const [toastColor, setToastColor] = useState<string>(COLORS.neutral);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<any>(null);

  const disableTaps = !isRecording;

  useEffect(() => {
    if (!isRecording && passChooserOpen) setPassChooserOpen(false);
  }, [isRecording, passChooserOpen]);

  // ✅ Move Serve In + Ace to LEFT side (top) so right side never overflows
  const leftButtons: Btn[] = [
    { id: 'L_SI', label: 'SI', sub: 'Serve', action: 'Serve In', key: 'serveIn', color: COLORS.serveIn, value: 0, kind: 'good' },
    { id: 'L_A', label: 'A', sub: 'Ace', action: 'Ace', key: 'ace', color: COLORS.ace, value: 1, kind: 'good' },

    { id: 'L_K', label: 'K', sub: 'Kill', action: 'Kill', key: 'kill', color: COLORS.kill, value: 0, kind: 'good' },
    { id: 'L_D', label: 'D', sub: 'Dig', action: 'Dig', key: 'dig', color: COLORS.dig, value: 0, kind: 'good' },
    { id: 'L_B', label: 'B', sub: 'Block', action: 'Block', key: 'block', color: COLORS.block, value: 0, kind: 'good' },

    { id: 'L_TB', label: 'TB', sub: 'Touch', action: 'Touch', key: 'touch', color: COLORS.neutral, value: 0, kind: 'neutral' },
    { id: 'L_1B', label: '1st', sub: 'Ball', action: 'First Ball', key: 'firstBall', color: COLORS.neutral, value: 0, kind: 'neutral' },
    { id: 'L_BP', label: 'BP', sub: 'Bump', action: 'Bump Pass', key: 'bump', color: COLORS.neutral, value: 0, kind: 'neutral' },
  ];

  // ✅ Right side now fits: Pass/Attack + Errors only
  const rightButtons: Btn[] = [
    { id: 'R_PR', label: 'PR', sub: 'Pass', action: 'Pass…', key: 'passRating', color: COLORS.pass, value: 0, kind: 'good' },
    { id: 'R_ATK', label: 'ATK', sub: 'Atk', action: 'Attack', key: 'attack', color: COLORS.attack, value: 0, kind: 'good' },

    // ✅ Errors: each has its own button (fast taps)
    { id: 'R_AE', label: 'AE', sub: 'Atk', action: 'Attack Error', key: 'attackError', color: COLORS.attackError, value: 0, kind: 'bad' },
    { id: 'R_SE', label: 'SE', sub: 'Svc', action: 'Serve Error', key: 'serveError', color: COLORS.serveError, value: 0, kind: 'bad' },
    { id: 'R_NET', label: 'NET', sub: 'Net', action: 'Net Violation', key: 'net', color: COLORS.net, value: 0, kind: 'bad' },
    { id: 'R_BHE', label: 'BHE', sub: 'Ball', action: 'Ball Handling Error', key: 'ballHandlingError', color: COLORS.ballHandlingError, value: 0, kind: 'bad' },
    { id: 'R_E', label: 'E', sub: 'Other', action: 'Other Error', key: 'error', color: COLORS.otherError, value: 0, kind: 'bad' },
  ];

  const showToast = (text: string, color: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToastText(text);
    setToastColor(color);

    toastOpacity.stopAnimation();
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setToastText(null));
    }, 900);
  };

  const flashButton = (id: string) => {
    if (litTimerRef.current) clearTimeout(litTimerRef.current);
    setLitId(id);
    litTimerRef.current = setTimeout(() => setLitId(null), 180);
  };

  const emit = (
    key: string,
    label: string,
    value?: number,
    tint?: string,
    extraMeta?: Record<string, any>,
    toast?: string,
    btnId?: string,
  ) => {
    const color = tint ?? COLORS.neutral;

    if (btnId) flashButton(btnId);
    showToast(toast ?? label, color);

    const evt: OverlayEvent = {
      actor: 'neutral',
      key,
      value,
      label,
      meta: {
        pillColor: color,
        tint: color,
        color,
        chipColor: color,
        buttonColor: color,
        tSec: getCurrentTSec?.(),
        ...(extraMeta || {}),
      },
    } as any;

    onEvent?.(evt);
  };

  // layout sizes
  const BTN = 54;
  const GAP = 10;

  const LEFT_COLS = 2;
  const RIGHT_COLS = 2;

  const leftWidth = LEFT_COLS * BTN + (LEFT_COLS - 1) * GAP;
  const rightWidth = RIGHT_COLS * BTN + (RIGHT_COLS - 1) * GAP;

  // ✅ Move both grids UP a bit so nothing goes off-screen
  const GRID_TOP = insets.top + 72;          // was +88
  const GRID_BOTTOM = insets.bottom + 90;    // was +110

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      {/* Last-action pill (FULL WORDS) */}
      {toastText ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: insets.left + 12,
            right: insets.right + 12,
            alignItems: 'center',
            opacity: toastOpacity,
            transform: [
              {
                translateY: toastOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-6, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.70)',
              borderWidth: 1,
              borderColor: toastColor,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 13 }}>
              {toastText}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Left grid */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: insets.left + 12,
          top: GRID_TOP,
          bottom: GRID_BOTTOM,
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
                if (disableTaps) return;
                emit(b.key, b.label, b.value, b.color, { kind: b.kind }, b.action, b.id);
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
          top: GRID_TOP,
          bottom: GRID_BOTTOM,
          width: rightWidth,
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: GAP,
            justifyContent: 'flex-end',
          }}
        >
          {rightButtons.map((b) => (
            <CircleButton
              key={b.id}
              label={b.label}
              subLabel={b.sub}
              ringColor={b.color}
              disabled={disableTaps}
              lit={litId === b.id}
              onPress={() => {
                if (disableTaps) return;

                if (b.key === 'passRating') {
                  flashButton(b.id);
                  showToast('Pass…', b.color);
                  setPassChooserOpen(true);
                  return;
                }

                emit(b.key, b.label, b.value, b.color, { kind: b.kind }, b.action, b.id);
              }}
            />
          ))}
        </View>
      </View>

      {/* Pass rating chooser (INLINE overlay, no Modal) */}
      {passChooserOpen ? (
        <Pressable
          onPress={() => setPassChooserOpen(false)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: 'rgba(15,23,42,0.95)',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              padding: 14,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>
              Pass Rating
            </Text>
            <Text style={{ color: TEXT_DIM, fontWeight: '800', marginTop: 6 }}>
              Tap 3 / 2 / 1 / 0
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {[
                { n: 3, label: '3', desc: 'Perfect', toast: 'Pass (3) Perfect', color: COLORS.pass },
                { n: 2, label: '2', desc: 'Good', toast: 'Pass (2) Good', color: COLORS.pass },
                { n: 1, label: '1', desc: 'OK', toast: 'Pass (1) OK', color: COLORS.pass },
                { n: 0, label: '0', desc: 'Err', toast: 'Pass (0) Error', color: COLORS.otherError },
              ].map((p) => (
                <Pressable
                  key={p.n}
                  onPress={() => {
                    emit(
                      'passRating',
                      `PR${p.label}`,
                      p.n,
                      p.color,
                      { passRating: p.n, kind: p.n === 0 ? 'bad' : 'good' },
                      p.toast,
                      'R_PR',
                    );
                    setPassChooserOpen(false);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: p.color,
                    backgroundColor: 'rgba(0,0,0,0.25)',
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
                    {p.label}
                  </Text>
                  <Text style={{ color: TEXT_DIM, fontWeight: '800', marginTop: 2 }}>
                    {p.desc}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setPassChooserOpen(false)}
              style={{
                marginTop: 14,
                alignSelf: 'flex-end',
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}