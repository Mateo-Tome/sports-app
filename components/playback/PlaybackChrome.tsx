import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import type { EventRow } from './playbackCore';

export { OverlayModeMenu } from './OverlayModeMenu';

export const BELT_H = 76;
export const EDGE_PAD = 24;
export const SAFE_MARGIN = 12;

export type OverlayMode = 'all' | 'noBelt' | 'noScore' | 'off';

export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const GLOBAL_PREROLL_FALLBACK_SEC = 3;

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function abbrKind(kind?: string): string {
  if (!kind) return '';
  const k = kind.toLowerCase();

  if (k.startsWith('takedown')) return 'TD';
  if (k.startsWith('reversal')) return 'R';
  if (k.startsWith('escape')) return 'E';
  if (k.startsWith('nearfall') || k.startsWith('nf')) return 'NF';

  return kind.slice(0, 3).toUpperCase();
}

function normalizeBeltToken(raw: any): string {
  let k = String(raw ?? '').toLowerCase().trim();
  k = k.replace(/\s+/g, ' ');
  k = k.replace('home run', 'homerun');
  k = k.replace('strike out', 'strikeout');
  return k;
}

function readBeltLaneMeta(e: EventRow): 'top' | 'bottom' | null {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};
  const raw = meta?.beltLane ?? inner?.beltLane ?? meta?.beltlane ?? inner?.beltlane;
  const v = normalizeBeltToken(raw);
  if (v === 'top') return 'top';
  if (v === 'bottom') return 'bottom';
  return null;
}

function getMetaFlat(e: EventRow): Record<string, any> {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};
  return { ...inner, ...meta };
}

function toSide(v: any): 'home' | 'opponent' | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;

  if (s === 'home') return 'home';
  if (s === 'opponent') return 'opponent';

  if (s === 'opp' || s === 'away' || s === 'visitor' || s === 'right') return 'opponent';
  if (s === 'h' || s === 'left') return 'home';

  return null;
}

function resolveNeutralSide(e: EventRow): 'home' | 'opponent' | null {
  const m = getMetaFlat(e);

  const direct =
    toSide(m.beltSide) ??
    toSide(m.side) ??
    toSide(m.for) ??
    toSide(m.offender) ??
    toSide(m.awardedTo) ??
    toSide(m.benefit) ??
    toSide(m.scorer) ??
    toSide(m.to);

  if (direct) return direct;

  if (m?.target && typeof m.target === 'object') {
    const t = m.target;
    return toSide(t.beltSide) ?? toSide(t.side) ?? toSide(t.for) ?? toSide(t.offender) ?? null;
  }

  return null;
}

function readEventType(e: EventRow): string {
  const kind = String((e as any)?.kind ?? '').trim().toLowerCase();
  const key = String((e as any)?.key ?? '').trim().toLowerCase();
  return kind || key;
}

function displayKindForPill(e: EventRow): string {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};

  const explicit =
    meta?.pillLabel ??
    inner?.pillLabel ??
    meta?.label ??
    inner?.label ??
    (e as any)?.label;

  if (explicit && String(explicit).trim()) {
    return String(explicit).trim();
  }

  const kind = String((e as any)?.kind ?? '');
  if (kind && kind.toLowerCase() !== 'unknown') return kind;

  const raw = (e as any)?.key ?? meta?.key ?? inner?.key ?? kind;
  return String(raw ?? kind);
}

function readPreRollSec(e: EventRow): number {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};

  const raw = meta?.preRollSec ?? inner?.preRollSec;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));

  if (!Number.isFinite(n)) return GLOBAL_PREROLL_FALLBACK_SEC;
  return Math.max(0, Math.min(15, n));
}

function readPeriodNumber(e: EventRow): number | null {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};

  const raw =
    meta?.period ??
    inner?.period ??
    meta?.periodNumber ??
    inner?.periodNumber ??
    meta?.meta?.period ??
    meta?.meta?.periodNumber;

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);

  const label = String(meta?.label ?? inner?.label ?? (e as any)?.label ?? '').trim();
  const m = label.match(/^p\s*(\d+)/i) || label.match(/^period\s*(\d+)/i);
  if (m?.[1]) {
    const pn = parseInt(m[1], 10);
    if (!Number.isNaN(pn) && pn > 0) return pn;
  }

  const k = String((e as any)?.kind ?? '').toLowerCase();
  const km = k.match(/^period\s*(\d+)/) || k.match(/^p\s*(\d+)/);
  if (km?.[1]) {
    const pn = parseInt(km[1], 10);
    if (!Number.isNaN(pn) && pn > 0) return pn;
  }

  return null;
}

function readChoiceToken(e: EventRow): 'top' | 'bottom' | 'neutral' | 'defer' | null {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};

  const raw =
    meta?.choice ??
    inner?.choice ??
    (e as any)?.choice ??
    meta?.label ??
    inner?.label ??
    (e as any)?.label ??
    '';

  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;

  if (s === 'top') return 'top';
  if (s === 'bottom') return 'bottom';
  if (s === 'neutral') return 'neutral';
  if (s === 'defer' || s === 'deferred') return 'defer';

  if (s.includes('top')) return 'top';
  if (s.includes('bottom')) return 'bottom';
  if (s.includes('neutral')) return 'neutral';
  if (s.includes('defer')) return 'defer';

  return null;
}

function findLastRealChoiceForPeriod(events: EventRow[], periodNum: number): EventRow | null {
  if (!events?.length) return null;

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];

    const type = readEventType(e);
    if (type !== 'choice') continue;

    const p = readPeriodNumber(e);
    if (p !== periodNum) continue;

    const token = readChoiceToken(e);
    if (!token) continue;
    if (token === 'defer') continue;

    return e;
  }

  return null;
}

export function EventBelt(props: {
  duration: number;
  current: number;
  events: EventRow[];
  onSeek: (sec: number) => void;
  bottomInset: number;
  colorFor: (e: EventRow) => string;
  onPillLongPress: (ev: EventRow) => void;
}) {
  const { duration, current, events, onSeek, bottomInset, colorFor, onPillLongPress } = props;

  const screenW = Dimensions.get('window').width;
  const PILL_W = 64;
  const MIN_GAP = 8;
  const PX_PER_SEC = 10;
  const BASE_LEFT = EDGE_PAD;

  const rowY = (lane: 'home' | 'opponent') => (lane === 'home' ? 10 : 40);

  const laneFor = (e: EventRow): 'home' | 'opponent' => {
    const beltLane = readBeltLaneMeta(e);
    if (beltLane === 'top') return 'home';
    if (beltLane === 'bottom') return 'opponent';

    const a = (e as any).actor;
    if (a === 'home') return 'home';
    if (a === 'opponent') return 'opponent';

    const resolved = resolveNeutralSide(e);
    if (resolved) return resolved;

    return 'opponent';
  };

  const getPeriodLabel = (e: EventRow): string | null => {
    const meta = (e as any).meta ?? {};
    const inner = meta?.meta ?? {};
    const label = String(meta?.label ?? inner?.label ?? '').trim();

    const rawPeriod =
      typeof meta.period === 'number'
        ? meta.period
        : typeof inner.period === 'number'
          ? inner.period
          : typeof meta.periodNumber === 'number'
            ? meta.periodNumber
            : typeof inner.periodNumber === 'number'
              ? inner.periodNumber
              : undefined;

    if (typeof rawPeriod === 'number' && rawPeriod > 0) return `P${rawPeriod}`;

    if (label) {
      const fromLabel = label.match(/^p\s*(\d+)/i) || label.match(/^period\s*(\d+)/i);
      if (fromLabel?.[1]) {
        const pn = parseInt(fromLabel[1], 10);
        if (!Number.isNaN(pn) && pn > 0) return `P${pn}`;
      }
    }

    const k = String((e as any).kind ?? '').toLowerCase();
    const m = k.match(/^period\s*(\d+)/) || k.match(/^p\s*(\d+)/);
    if (m?.[1]) return `P${m[1]}`;

    return null;
  };

  const layout = useMemo(() => {
    const indexed = (events ?? []).map((e, i) => ({ e, i }));
    indexed.sort((a, b) => (a.e.t ?? 0) - (b.e.t ?? 0) || a.i - b.i);

    const lastLeft: Record<'home' | 'opponent', number> = {
      home: BASE_LEFT - PILL_W,
      opponent: BASE_LEFT - PILL_W,
    };

    const items: Array<{
      e: EventRow;
      x: number;
      y: number;
      c: string;
      isPeriod: boolean;
      periodLabel?: string;
      periodText?: string;
      periodTextColor?: string;
      displayT: number;
    }> = [];

    for (const { e } of indexed) {
      const type = readEventType(e);
      if (type === 'choice') continue;

      const lane = laneFor(e);

      const periodLabel = getPeriodLabel(e);
      const isPeriod = !!periodLabel;

      const pre = isPeriod ? 0 : readPreRollSec(e);
      const displayT = Math.max(0, (e.t ?? 0) - pre);

      const desiredX = displayT * PX_PER_SEC;
      const desiredLeft = Math.max(desiredX - PILL_W / 2, BASE_LEFT);

      const prevLeft = lastLeft[lane];
      const placedLeft = Math.max(desiredLeft, prevLeft + PILL_W + MIN_GAP, BASE_LEFT);
      lastLeft[lane] = placedLeft;

      let periodText: string | undefined;
      let periodTextColor: string | undefined;

      if (isPeriod) {
        const pNum = readPeriodNumber(e);
        const realChoiceEvt = pNum ? findLastRealChoiceForPeriod(events ?? [], pNum) : null;
        const token = realChoiceEvt ? readChoiceToken(realChoiceEvt) : null;

        if (pNum) {
          periodText = `p${pNum}${token ? ` ${token}` : ''}`.toLowerCase();
          periodTextColor = realChoiceEvt ? colorFor(realChoiceEvt) : '#111';
        } else {
          const numLabel = (periodLabel && periodLabel.replace(/\D/g, '')) || periodLabel;
          periodText = `p${String(numLabel || '').trim()}`.toLowerCase();
          periodTextColor = '#111';
        }
      }

      items.push({
        e,
        x: placedLeft + PILL_W / 2,
        y: rowY(lane),
        c: colorFor(e),
        isPeriod,
        periodLabel: periodLabel || undefined,
        periodText,
        periodTextColor,
        displayT,
      });
    }

    const maxCenter = items.length ? Math.max(...items.map((it) => it.x)) : 0;
    const contentW = Math.max(screenW, maxCenter + PILL_W / 2 + EDGE_PAD);
    return { items, contentW };
  }, [events, screenW, colorFor]);

  const scrollRef = useRef<ScrollView>(null);
  const userInteracting = useRef(false);
  const unlockTimer = useRef<any>(null);

  const lockUser = useCallback((ms = 900) => {
    userInteracting.current = true;
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => {
      userInteracting.current = false;
      unlockTimer.current = null;
    }, ms);
  }, []);

  useEffect(() => {
    return () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    };
  }, []);

  const lastAuto = useRef(0);

  useEffect(() => {
    if (!duration) return;
    if (Platform.OS === 'web') return;
    if (userInteracting.current) return;

    const playheadX = (current || 0) * PX_PER_SEC;
    const targetX = Math.max(0, playheadX - screenW * 0.5);
    const nowMs = Date.now();

    if (nowMs - lastAuto.current > 120) {
      scrollRef.current?.scrollTo({ x: targetX, animated: false });
      lastAuto.current = nowMs;
    }
  }, [current, duration, screenW]);

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomInset + 4,
        zIndex: 999,
        elevation: 999,
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => lockUser(1400)}
        onScrollEndDrag={() => lockUser(900)}
        onMomentumScrollBegin={() => lockUser(1400)}
        onMomentumScrollEnd={() => lockUser(900)}
        scrollEventThrottle={16}
        style={
          Platform.OS === 'web'
            ? ({
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
              } as any)
            : undefined
        }
        contentContainerStyle={{
          height: BELT_H,
          paddingHorizontal: EDGE_PAD,
          minWidth: layout.contentW + EDGE_PAD * 2,
          ...(Platform.OS === 'web'
            ? ({
                userSelect: 'none',
                cursor: 'grab',
              } as any)
            : null),
        }}
      >
        <View style={{ width: layout.contentW, height: BELT_H, flexShrink: 0 }}>
          <View
            style={{
              position: 'absolute',
              top: BELT_H / 2 - 2,
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          />

          {layout.items.map((it, i) => {
            const isPassed = (current || 0) >= (it.e.t ?? 0);

            const handlePress = () => {
              lockUser(1200);
              onSeek(it.e.t ?? 0);
            };

            const handleLong = () => {
              lockUser(1400);
              onPillLongPress(it.e);
            };

            if (it.isPeriod) {
              return (
                <Pressable
                  key={`${(it.e as any)._id ?? 'period'}-${i}`}
                  onPress={handlePress}
                  onLongPress={handleLong}
                  delayLongPress={280}
                  pointerEvents="auto"
                  style={{
                    position: 'absolute',
                    left: it.x - PILL_W / 2,
                    top: BELT_H / 2 - 14,
                    width: PILL_W,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: 'rgba(148,163,184,0.9)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isPassed ? 0.9 : 1,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color: it.periodTextColor ?? '#111',
                      fontWeight: '900',
                      fontSize: 12,
                    }}
                  >
                    {it.periodText ?? (it.periodLabel || '').toLowerCase()}
                  </Text>
                </Pressable>
              );
            }

            const pillKind = displayKindForPill(it.e);

            return (
              <Pressable
                key={`${(it.e as any)._id ?? 'n'}-${i}`}
                onPress={handlePress}
                onLongPress={handleLong}
                delayLongPress={280}
                pointerEvents="auto"
                style={{
                  position: 'absolute',
                  left: it.x - PILL_W / 2,
                  top: it.y,
                  width: PILL_W,
                  height: 28,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: it.c,
                  borderWidth: 1,
                  borderColor: it.c,
                  opacity: isPassed ? 0.45 : 1,
                }}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{ color: 'white', fontSize: 11, fontWeight: '800' }}
                >
                  {`${abbrKind(pillKind)}${
                    typeof (it.e as any).points === 'number' && (it.e as any).points > 0
                      ? `+${(it.e as any).points}`
                      : ''
                  }`}
                </Text>

                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{ color: 'white', opacity: 0.9, fontSize: 9, marginTop: 1 }}
                >
                  {fmt(it.displayT)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function QuickEditSheet(props: {
  visible: boolean;
  event: EventRow | null;
  onReplace: () => void;
  onDelete: () => void;
  onCancel: () => void;
  insets: Insets;
}) {
  const { visible, event, onReplace, onDelete, onCancel, insets } = props;

  if (!visible || !event) return null;

  const screenW = Dimensions.get('window').width;
  const BOX_W = Math.min(screenW * 0.75, 520);

  const kind = String((event as any)?.kind ?? '');
  const pts = (event as any).points ? `+${(event as any).points}` : '';

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        bottom: insets.bottom + 16 + BELT_H + 8,
        alignSelf: 'center',
        width: BOX_W,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        padding: 10,
        zIndex: 60,
      }}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          color: '#fff',
          fontWeight: '900',
          marginBottom: 6,
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        Edit {abbrKind(kind)}
        {pts} @ {fmt((event as any).t)}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Pressable
          onPress={onReplace}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563eb' }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 14 }}
          >
            Replace…
          </Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#dc2626' }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 14 }}
          >
            Delete
          </Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 14 }}
          >
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}