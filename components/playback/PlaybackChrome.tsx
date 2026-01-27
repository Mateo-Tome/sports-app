// components/playback/PlaybackChrome.tsx

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native';

// Import EventRow as a *type only* so this has no runtime dependency.
import type { EventRow } from './playbackCore';

// === shared layout constants ===
export const BELT_H = 76;
export const EDGE_PAD = 24;
export const SAFE_MARGIN = 12;

// === shared types ===
export type OverlayMode = 'all' | 'noBelt' | 'noScore' | 'off';

export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * ✅ One knob for now.
 * Later we can make this sport/event specific, but this gets you perfect “lead-up” today.
 */
const GLOBAL_PREROLL_FALLBACK_SEC = 3;

/**
 * Local helper: format seconds as M:SS
 */
function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Local helper: abbreviate event kind for belt pill
 */
function abbrKind(kind?: string): string {
  if (!kind) return '';
  const k = kind.toLowerCase();

  if (k.startsWith('takedown')) return 'TD';
  if (k.startsWith('reversal')) return 'R';
  if (k.startsWith('escape')) return 'E';
  if (k.startsWith('nearfall') || k.startsWith('nf')) return 'NF';

  // generic fallback
  return kind.slice(0, 3).toUpperCase();
}

/* ==================== Overlay mode menu ==================== */

export function OverlayModeMenu(props: {
  visible: boolean;
  mode: OverlayMode;
  onSelect: (m: OverlayMode) => void;
  onClose: () => void;
  insets: Insets;
}) {
  const { visible, mode, onSelect, onClose, insets } = props;

  if (!visible) return null;

  const options: { key: OverlayMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'noBelt', label: 'Score' },
    { key: 'noScore', label: 'Belt' },
    { key: 'off', label: 'Off' },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 70,
      }}
    >
      <Pressable
        onPress={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        pointerEvents="auto"
        style={{
          position: 'absolute',
          top: insets.top + SAFE_MARGIN + 36,
          right: insets.right + SAFE_MARGIN,
          borderRadius: 12,
          backgroundColor: 'rgba(0,0,0,0.9)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
          paddingVertical: 6,
          paddingHorizontal: 8,
          minWidth: 120,
        }}
      >
        {options.map((opt) => {
          const isActive = opt.key === mode;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: isActive ? 'rgba(59,130,246,0.35)' : 'transparent',
                marginBottom: 2,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ==================== Event Belt ==================== */

function normalizeBeltToken(raw: any): string {
  let k = String(raw ?? '').toLowerCase().trim();
  k = k.replace(/\s+/g, ' ');
  k = k.replace('home run', 'homerun');
  k = k.replace('strike out', 'strikeout');
  return k;
}

function extractBeltKey(e: EventRow): string {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};

  const raw =
    (e as any)?.key ??
    (e as any)?.kind ??
    meta?.key ??
    meta?.kind ??
    meta?.label ??
    inner?.key ??
    inner?.kind ??
    inner?.label ??
    '';

  return normalizeBeltToken(raw);
}

function inferBeltLaneFromEvent(e: EventRow): 'top' | 'bottom' | null {
  const k = extractBeltKey(e);
  if (!k) return null;

  const isBaseballish =
    k.includes('ball') ||
    k.includes('strike') ||
    k.includes('foul') ||
    k.includes('walk') ||
    k.includes('hit') ||
    k.includes('single') ||
    k.includes('double') ||
    k.includes('triple') ||
    k.includes('bunt') ||
    k.includes('homerun') ||
    k.includes('out') ||
    k.includes('strikeout') ||
    k.startsWith('k ') ||
    k === 'k' ||
    k.includes('k swinging') ||
    k.includes('k looking');

  if (!isBaseballish) return null;

  if (
    k === 'ball' ||
    k.startsWith('ball ') ||
    k === 'hit' ||
    k.includes('single') ||
    k.includes('double') ||
    k.includes('triple') ||
    k.includes('bunt') ||
    k === 'walk' ||
    k.includes('walk') ||
    k === 'homerun'
  ) return 'top';

  if (
    k === 'strike' ||
    k.startsWith('strike ') ||
    k.includes('foul') ||
    k === 'strikeout' ||
    k.includes('strikeout') ||
    k === 'out' ||
    k.includes('out') ||
    k === 'k' ||
    k.startsWith('k ') ||
    k.includes('k swinging') ||
    k.includes('k looking')
  ) return 'bottom';

  return null;
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

function displayKindForPill(e: EventRow): string {
  const kind = String((e as any)?.kind ?? '');
  if (kind && kind.toLowerCase() !== 'unknown') return kind;

  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};
  const raw = meta?.label ?? inner?.label ?? (e as any)?.key ?? meta?.key ?? inner?.key ?? kind;
  return String(raw ?? kind);
}

/**
 * ✅ Read preRollSec from event meta (supports both meta and meta.meta).
 * If missing (old clips), fall back to GLOBAL_PREROLL_FALLBACK_SEC.
 */
function readPreRollSec(e: EventRow): number {
  const meta: any = (e as any)?.meta ?? {};
  const inner: any = meta?.meta ?? {};

  const raw = meta?.preRollSec ?? inner?.preRollSec;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));

  if (!Number.isFinite(n)) return GLOBAL_PREROLL_FALLBACK_SEC;
  return Math.max(0, Math.min(15, n));
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

    const inferred = inferBeltLaneFromEvent(e);
    if (inferred === 'top') return 'home';
    if (inferred === 'bottom') return 'opponent';

    if ((e as any).actor === 'home') return 'home';
    if ((e as any).actor === 'opponent') return 'opponent';
    return 'opponent';
  };

  const getPeriodLabel = (e: EventRow): string | null => {
    const meta = (e as any).meta ?? {};
    const label = String(meta?.label ?? '').trim();

    const rawPeriod =
      typeof meta.period === 'number'
        ? meta.period
        : typeof meta.periodNumber === 'number'
          ? meta.periodNumber
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
    indexed.sort((a, b) => a.e.t - b.e.t || a.i - b.i);

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
      displayT: number;
    }> = [];

    for (const { e } of indexed) {
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

      items.push({
        e,
        x: placedLeft + PILL_W / 2,
        y: rowY(lane),
        c: colorFor(e),
        isPeriod,
        periodLabel: periodLabel || undefined,
        displayT,
      });
    }

    const maxCenter = items.length ? Math.max(...items.map(it => it.x)) : 0;
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
        contentContainerStyle={{
          height: BELT_H,
          paddingHorizontal: EDGE_PAD,
          width: layout.contentW + EDGE_PAD * 2,
          ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : null),
        }}
      >
        <View style={{ width: layout.contentW, height: BELT_H }}>
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
              onSeek(it.e.t ?? 0); // ✅ seek to REAL event time
            };

            const handleLong = () => {
              lockUser(1400);
              onPillLongPress(it.e);
            };

            if (it.isPeriod) {
              const numLabel = (it.periodLabel && it.periodLabel.replace(/\D/g, '')) || it.periodLabel;

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
                  <Text style={{ color: '#111', fontWeight: '900', fontSize: 14 }}>
                    {numLabel || it.periodLabel}
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
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                  {`${abbrKind(pillKind)}${
                    typeof (it.e as any).points === 'number' && (it.e as any).points > 0
                      ? `+${(it.e as any).points}`
                      : ''
                  }`}
                </Text>

                {/* ✅ show the DISPLAY time (lead-up position) so belt matches what you see */}
                <Text style={{ color: 'white', opacity: 0.9, fontSize: 9, marginTop: 1 }}>
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

/* ==================== Quick Edit sheet ==================== */

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
      <Text style={{ color: '#fff', fontWeight: '900', marginBottom: 6, fontSize: 14, textAlign: 'center' }}>
        Edit {abbrKind(displayKindForPill(event))}
        {(event as any).points ? `+${(event as any).points}` : ''} @ {fmt((event as any).t)}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Pressable
          onPress={onReplace}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563eb' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 14 }}>Replace…</Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#dc2626' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 14 }}>Delete</Text>
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
          <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 14 }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
