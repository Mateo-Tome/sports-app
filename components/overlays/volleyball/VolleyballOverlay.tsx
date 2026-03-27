// components/overlays/volleyball/VolleyballOverlay.tsx

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OverlayCompactText } from '../OverlayCompactText';
import { OverlayTitleText } from '../OverlayTitleText';
import type { OverlayEvent, OverlayProps } from '../types';

const BORDER = 'rgba(255,255,255,0.18)';
const TEXT_DIM = 'rgba(255,255,255,0.82)';
const PANEL_BG = 'rgba(15,23,42,0.78)';

const COLORS = {
  kill: '#22c55e',
  ace: '#f59e0b',
  block: '#a855f7',
  dig: '#38bdf8',
  pass: '#14b8a6',
  serveIn: '#60a5fa',
  attack: '#16a34a',

  serveError: '#f87171',
  net: '#ef4444',
  ballHandlingError: '#dc2626',
  otherError: '#b91c1c',
  attackError: '#991b1b',

  neutral: 'rgba(148,163,184,0.92)',
};

type Btn = {
  id: string;
  label: string;
  sub?: string;
  action: string;
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
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      pressRetentionOffset={{ top: 18, bottom: 18, left: 18, right: 18 }}
      style={{
        width: 58,
        height: 58,
        borderRadius: 29,
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
        paddingHorizontal: 4,
      }}
    >
      <OverlayCompactText style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>
        {label}
      </OverlayCompactText>

      {subLabel ? (
        <OverlayCompactText
          style={{
            color: lit ? 'rgba(255,255,255,0.92)' : TEXT_DIM,
            fontWeight: '800',
            fontSize: 10,
            marginTop: 1,
          }}
        >
          {subLabel}
        </OverlayCompactText>
      ) : null}
    </Pressable>
  );
}

function StatPill({ v, label }: { v: number; label: string }) {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        minWidth: 52,
      }}
    >
      <OverlayCompactText
        style={{
          color: 'white',
          fontWeight: '900',
          fontSize: 14,
        }}
      >
        {v}
      </OverlayCompactText>

      <OverlayCompactText
        numberOfLines={1}
        style={{
          color: TEXT_DIM,
          fontWeight: '900',
          fontSize: 10,
          marginTop: 1,
        }}
      >
        {label}
      </OverlayCompactText>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: BORDER }} />;
}

export default function VolleyballOverlay({
  isRecording,
  onEvent,
  getCurrentTSec,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const isLandscape = dims.width > dims.height;

  const [passChooserOpen, setPassChooserOpen] = useState(false);

  const [litId, setLitId] = useState<string | null>(null);
  const litTimerRef = useRef<any>(null);

  const [toastText, setToastText] = useState<string | null>(null);
  const [toastColor, setToastColor] = useState<string>(COLORS.neutral);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<any>(null);

  const [stats, setStats] = useState({
    k: 0,
    a: 0,
    b: 0,
    d: 0,
    e: 0,
  });

  const disableTaps = !isRecording;

  useEffect(() => {
    if (!isRecording && passChooserOpen) setPassChooserOpen(false);
  }, [isRecording, passChooserOpen]);

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

  const rightButtons: Btn[] = [
    { id: 'R_PR', label: 'PR', sub: 'Pass', action: 'Pass…', key: 'passRating', color: COLORS.pass, value: 0, kind: 'good' },
    { id: 'R_ATK', label: 'ATK', sub: 'Atk', action: 'Attack', key: 'attack', color: COLORS.attack, value: 0, kind: 'good' },

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

    setStats((s) => {
      const next = { ...s };

      if (key === 'kill') next.k += 1;
      else if (key === 'ace') next.a += 1;
      else if (key === 'block') next.b += 1;
      else if (key === 'dig') next.d += 1;
      else if (
        key === 'attackError' ||
        key === 'serveError' ||
        key === 'net' ||
        key === 'ballHandlingError' ||
        key === 'error'
      ) {
        next.e += 1;
      }

      return next;
    });

    const kind = (extraMeta as any)?.kind as 'good' | 'bad' | 'neutral' | undefined;
    const beltLane = kind === 'bad' ? 'top' : 'bottom';

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
        beltLane,
        tSec: getCurrentTSec?.(),
        ...(extraMeta || {}),
      },
    } as any;

    onEvent?.(evt);
  };

  const BTN = 58;
  const GAP = 10;
  const COLS = 2;

  const leftWidth = COLS * BTN + (COLS - 1) * GAP;
  const rightWidth = COLS * BTN + (COLS - 1) * GAP;

  const LEFT_ROWS = Math.ceil(leftButtons.length / COLS);
  const RIGHT_ROWS = Math.ceil(rightButtons.length / COLS);

  const leftHeight = LEFT_ROWS * BTN + (LEFT_ROWS - 1) * GAP;
  const rightHeight = RIGHT_ROWS * BTN + (RIGHT_ROWS - 1) * GAP;

  const GRID_TOP = isLandscape ? insets.top + 28 : insets.top + 72;
  const SIDE_PAD = isLandscape ? 18 : 12;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
      }}
    >
      {/* Live stats pill */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 10,
          left: insets.left + 10,
          right: insets.right + 10,
          alignItems: 'center',
          zIndex: 10000,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: PANEL_BG,
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <StatPill v={stats.k} label="Kills" />
          <Divider />
          <StatPill v={stats.a} label="Aces" />
          <Divider />
          <StatPill v={stats.b} label="Blocks" />
          <Divider />
          <StatPill v={stats.d} label="Digs" />
          <Divider />
          <StatPill v={stats.e} label="Errors" />
        </View>
      </View>

      {toastText ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 44,
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
            zIndex: 10000,
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
              maxWidth: '88%',
            }}
          >
            <OverlayCompactText style={{ color: 'white', fontWeight: '900', fontSize: 13 }}>
              {toastText}
            </OverlayCompactText>
          </View>
        </Animated.View>
      ) : null}

      {/* Left grid */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: insets.left + SIDE_PAD,
          top: GRID_TOP,
          width: leftWidth,
          height: leftHeight,
          zIndex: 10001,
        }}
      >
        <View
          pointerEvents="auto"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: GAP,
          }}
        >
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
          right: insets.right + SIDE_PAD,
          top: GRID_TOP,
          width: rightWidth,
          height: rightHeight,
          alignItems: 'flex-end',
          zIndex: 10001,
        }}
      >
        <View
          pointerEvents="auto"
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

      {/* Pass rating chooser */}
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
            zIndex: 20000,
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
            <OverlayTitleText style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>
              Pass Rating
            </OverlayTitleText>

            <OverlayCompactText style={{ color: TEXT_DIM, fontWeight: '800', marginTop: 6 }}>
              Tap 3 / 2 / 1 / 0
            </OverlayCompactText>

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
                  <OverlayTitleText style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
                    {p.label}
                  </OverlayTitleText>

                  <OverlayCompactText style={{ color: TEXT_DIM, fontWeight: '800', marginTop: 2 }}>
                    {p.desc}
                  </OverlayCompactText>
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
              <OverlayCompactText style={{ color: 'white', fontWeight: '900' }}>
                Cancel
              </OverlayCompactText>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}