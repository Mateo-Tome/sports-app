// components/modules/basketball/BasketballPlaybackModule.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { PlaybackModuleProps } from '../types';

// ✅ single source of truth for colors/buttons/lanes/shot logic
import {
    BB_COLORS,
    LEFT_BTNS,
    RIGHT_BTNS,
    laneForAction,
    pointsForShot,
    tintForShot,
    type OverlayBtn,
    type ShotType,
} from '../../overlays/basketball/basketballUiSpec';

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

function StatPill({ v, label }: { v: number | string; label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 }}>
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{v}</Text>
      <Text style={{ color: THEME.textDim, fontWeight: '900', fontSize: 9, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: THEME.panelBorder }} />;
}

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

export default function BasketballPlaybackModule(props: PlaybackModuleProps) {
  const {
    overlayOn,
    insets,
    liveScore,
    finalScore,
    homeIsAthlete,
    athleteName,
    events,
    now,
    editMode,
    editSubmode,
    onOverlayEvent,
  } = props;

  if (!overlayOn) return null;

  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  const athleteIsHome = homeIsAthlete !== false;

  const athleteLabel = (athleteName ?? '').trim() || 'Athlete';
  const opponentLabel = 'Opponent';

  // Live score (from PlaybackScreen accumulation)
  const homeScore = liveScore?.home ?? 0;
  const oppScore = liveScore?.opponent ?? 0;

  const athleteLive = athleteIsHome ? homeScore : oppScore;
  const opponentLive = athleteIsHome ? oppScore : homeScore;

  // If score system isn't wired for basketball yet, hide these so UI doesn't look "wrestling-ish"
  const hasAnyScore =
    homeScore !== 0 ||
    oppScore !== 0 ||
    (finalScore?.home ?? 0) !== 0 ||
    (finalScore?.opponent ?? 0) !== 0;

  // Boxscore totals from events (simple: all events)
  const box = useMemo(() => {
    let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0, to = 0, pf = 0;
    let fgM = 0, fgA = 0, t3M = 0, t3A = 0, ftM = 0, ftA = 0;

    if (Array.isArray(events)) {
      for (const e of events) {
        const kind = String(e?.kind ?? e?.key ?? '').toLowerCase();
        const meta = (e?.meta ?? {}) as any;
        const inner = (meta?.meta ?? {}) as any;
        const m = { ...inner, ...meta };

        if (kind === 'assist') ast += 1;
        else if (kind === 'steal') stl += 1;
        else if (kind === 'block') blk += 1;
        else if (kind === 'turnover') to += 1;
        else if (kind === 'foul') pf += 1;
        else if (kind === 'rebound') reb += 1;
        else if (kind === 'shot') {
          const shotType = String(m.shotType ?? m.type ?? '').toUpperCase();
          const made = m.made === true;

          if (shotType === 'FT') {
            ftA += 1;
            if (made) ftM += 1;
          } else {
            fgA += 1;
            if (made) fgM += 1;
          }

          if (shotType === '3PT') {
            t3A += 1;
            if (made) t3M += 1;
          }

          const ptsAdd =
            typeof e?.points === 'number'
              ? e.points
              : made
              ? shotType === '3PT'
                ? 3
                : shotType === '2PT'
                ? 2
                : shotType === 'FT'
                ? 1
                : 0
              : 0;

          pts += ptsAdd;
        }
      }
    }

    return { pts, reb, ast, stl, blk, to, pf, fgM, fgA, t3M, t3A, ftM, ftA };
  }, [events]);

  const result = useMemo(() => {
    if (!finalScore) return null;
    const a = athleteIsHome ? finalScore.home : finalScore.opponent;
    const b = athleteIsHome ? finalScore.opponent : finalScore.home;

    let out: 'W' | 'L' | 'T' = 'T';
    if (a > b) out = 'W';
    else if (a < b) out = 'L';

    return `${out} ${a}–${b}`;
  }, [finalScore, athleteIsHome]);

  // -------- edit palette state --------
  const [picker, setPicker] = useState<Picker>(null);

  useEffect(() => {
    if (!showPalette) setPicker(null);
  }, [showPalette]);

  const [litId, setLitId] = useState<string | null>(null);
  const litTimerRef = useRef<any>(null);

  const [toastText, setToastText] = useState<string | null>(null);
  const [toastColor, setToastColor] = useState<string>(BB_COLORS.neutral);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<any>(null);

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
    action: string,
    label: string,
    tint: string,
    meta?: Record<string, any>,
    toast?: string,
    btnId?: string,
    points?: number,
  ) => {
    if (btnId) flashButton(btnId);
    if (toast) showToast(toast, tint);

    const flatMeta = { ...(meta || {}) };
    const beltLane = laneForAction(action, flatMeta);

    onOverlayEvent?.({
      actor: 'neutral',
      key: action, // PlaybackScreen uses evt.key -> EventRow.kind
      label,
      value: typeof points === 'number' ? points : undefined,
      meta: {
        beltLane,
        pillColor: tint,
        tint,
        color: tint,
        chipColor: tint,
        buttonColor: tint,

        ...(flatMeta || {}),
        tSec: now,
      },
    } as any);
  };

  const openShotPicker = (type: ShotType, btnId: string) => {
    if (!showPalette) return;
    flashButton(btnId);
    setPicker({ kind: 'shot', type, btnId });
  };

  const openReboundPicker = (btnId: string) => {
    if (!showPalette) return;
    flashButton(btnId);
    setPicker({ kind: 'rebound', btnId });
  };

  const logSimple = (b: OverlayBtn) => {
    const toast = b.sub ?? b.label;
    emit(b.action, toast, b.ringColor, { kind: b.action }, toast, b.id);
  };

  const shoot = (type: ShotType, made: boolean, btnId: string) => {
    const tint = tintForShot(type, made); // ✅ miss red, make uses family color
    const pts = pointsForShot(type);

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
      const accent = type === '2PT' ? BB_COLORS.shot2 : type === '3PT' ? BB_COLORS.shot3 : BB_COLORS.ft;

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

  // layout for palette
  const BTN = 58;
  const GAP = 10;
  const COLS = 2;
  const leftWidth = COLS * BTN + (COLS - 1) * GAP;
  const rightWidth = COLS * BTN + (COLS - 1) * GAP;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {/* result pill (hide if scoring not wired yet) */}
      {hasAnyScore && result ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 36,
            left: insets.left + 12,
            right: insets.right + 12,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.75)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{result}</Text>
          </View>
        </View>
      ) : null}

      {/* Top box-score bar */}
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
          <StatPill v={box.pts} label="PTS" />
          <Divider />
          <StatPill v={box.reb} label="REB" />
          <Divider />
          <StatPill v={box.ast} label="AST" />
          <Divider />
          <StatPill v={box.stl} label="STL" />
          <Divider />
          <StatPill v={box.blk} label="BLK" />
          <Divider />
          <StatPill v={box.to} label="TO" />
          <Divider />
          <StatPill v={box.pf} label="PF" />
          <Divider />
          <StatPill v={`${box.fgM}/${box.fgA}`} label="FG" />
          <Divider />
          <StatPill v={`${box.t3M}/${box.t3A}`} label="3PT" />
          <Divider />
          <StatPill v={`${box.ftM}/${box.ftA}`} label="FT" />
        </View>
      </View>

      {/* live score tags (hide if scoring not wired yet so no ugly 0–0 pills) */}
      {hasAnyScore ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 86,
            left: insets.left + 16,
            right: insets.right + 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.22)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              {athleteLabel} • {athleteLive}
            </Text>
          </View>

          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.22)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              {opponentLabel} • {opponentLive}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ---------- EDIT PALETTE ---------- */}
      {showPalette ? (
        <>
          {/* toast */}
          {toastText ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: insets.top + 120,
                left: insets.left + 12,
                right: insets.right + 12,
                alignItems: 'center',
                opacity: toastOpacity,
                transform: [{ translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
                zIndex: 80,
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

          {/* left grid (spec) */}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: insets.left + 12,
              top: insets.top + 160,
              bottom: insets.bottom + 110,
              width: leftWidth,
              zIndex: 75,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {LEFT_BTNS.map((b) => (
                <CircleButton
                  key={b.id}
                  label={b.label}
                  subLabel={b.sub}
                  ringColor={b.ringColor}
                  disabled={!showPalette}
                  lit={litId === b.id}
                  onPress={() => {
                    if (b.action === 'rebound') return openReboundPicker(b.id);
                    logSimple(b);
                  }}
                />
              ))}
            </View>
          </View>

          {/* right grid (spec) */}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              right: insets.right + 12,
              top: insets.top + 160,
              bottom: insets.bottom + 110,
              width: rightWidth,
              alignItems: 'flex-end',
              zIndex: 75,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'flex-end' }}>
              {RIGHT_BTNS.map((b) => (
                <CircleButton
                  key={b.id}
                  label={b.label}
                  subLabel={b.sub}
                  ringColor={b.ringColor}
                  disabled={!showPalette}
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

          {/* chooser */}
          {renderPicker()}
        </>
      ) : null}
    </View>
  );
}
