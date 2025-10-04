import * as FileSystem from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Overlay used in Edit/Add mode
import WrestlingFolkstyleOverlay from '../../components/overlays/WrestlingFolkstyleOverlay';
import type { OverlayEvent } from '../../components/overlays/types';

/* === colors === */
const GREEN = '#16a34a';
const RED   = '#dc2626';
const GREY  = '#9ca3af';

const SKIP_SEC = 5;         // double-tap skip (5s per your request)
const BELT_H   = 76;        // event belt height

/* ==================== types ==================== */
type Actor = 'home' | 'opponent' | 'neutral';

type EventRow = {
  _id?: string; // local id for edits
  t: number;
  kind: string;
  points?: number;
  actor?: Actor;
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

type Sidecar = {
  athlete?: string;
  sport?: string;
  style?: string;
  createdAt?: number;
  events?: EventRow[];
  finalScore?: { home: number; opponent: number }; // keep defined/undefined (not null)
  homeIsAthlete?: boolean;
  appVersion?: number;
};

/* ==================== helpers ==================== */
const fmt = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const abbrKind = (k?: string) => {
  if (!k) return 'EV';
  switch ((k || '').toLowerCase()) {
    case 'takedown':  return 'T';
    case 'escape':    return 'E';
    case 'reversal':  return 'R';
    case 'nearfall':  return 'NF';
    case 'stall':
    case 'stalling':  return 'ST';
    case 'caution':   return 'C';
    case 'penalty':   return 'P';
    case 'warning':   return 'W';
    case 'pin':       return 'PIN';
    default:          return k.slice(0, 2).toUpperCase();
  }
};

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const PENALTYISH = new Set(['stall', 'stalling', 'caution', 'penalty', 'warning']);

function normSideToken(v: any, homeIsAthlete: boolean): 'home'|'opponent'|null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (['home', 'h'].includes(s)) return 'home';
  if (['opponent', 'opp', 'o'].includes(s)) return 'opponent';
  if (['athlete', 'me', 'us', 'our'].includes(s)) return homeIsAthlete ? 'home' : 'opponent';
  if (['them', 'their', 'away', 'visitor'].includes(s)) return homeIsAthlete ? 'opponent' : 'home';
  if (['green'].includes(s)) return 'home';
  if (['red'].includes(s)) return 'opponent';
  return null;
}

function inferActor(e: EventRow, homeIsAthlete: boolean): Actor {
  if (e.actor === 'home' || e.actor === 'opponent' || e.actor === 'neutral') return e.actor;

  const kind = String(e.kind || '').toLowerCase();
  const penaltyish = PENALTYISH.has(kind);
  const m = e.meta ?? {};

  const to =
    normSideToken(m.to, homeIsAthlete) ??
    normSideToken(m.toSide, homeIsAthlete) ??
    normSideToken(m.scorer, homeIsAthlete) ??
    normSideToken(m.awardedTo, homeIsAthlete) ??
    normSideToken(m.pointTo, homeIsAthlete) ??
    normSideToken(m.benefit, homeIsAthlete) ??
    null;
  if (to) return to;

  const against =
    normSideToken(m.against, homeIsAthlete) ??
    normSideToken(m.on, homeIsAthlete) ??
    normSideToken(m.calledOn, homeIsAthlete) ??
    normSideToken(m.penalized, homeIsAthlete) ??
    normSideToken(m.who, homeIsAthlete) ??
    normSideToken(m.side, homeIsAthlete) ??
    null;
  if (against === 'home') return 'opponent';
  if (against === 'opponent') return 'home';

  if (penaltyish && typeof e.points === 'number' && e.points > 0) {
    return homeIsAthlete ? 'home' : 'opponent';
  }
  if (penaltyish) return homeIsAthlete ? 'home' : 'opponent';

  return 'neutral';
}

function normalizeEvents(evts: EventRow[], homeIsAthlete: boolean): EventRow[] {
  return evts.map(e => ({ ...e, actor: inferActor(e, homeIsAthlete) }));
}

const assignIds = (list: EventRow[]) =>
  list.map((e, i) => (e._id ? e : { ...e, _id: `${Math.round(e.t * 1000)}_${i}` }));

const toActor = (a: any): Actor =>
  a === 'home' || a === 'opponent' || a === 'neutral' ? a : 'neutral';

/* ==================== bottom event belt (2 lanes + long press) ==================== */
function EventBelt({
  duration,
  current,
  events,
  onSeek,
  bottomInset,
  onPillLongPress,
}: {
  duration: number;
  current: number;
  events: EventRow[];
  onSeek: (sec: number) => void;
  bottomInset: number;
  onPillLongPress?: (ev: EventRow) => void;
}) {
  const screenW = Dimensions.get('window').width;

  const PILL_W = 64;
  const PILL_H = 28;
  const PX_PER_SEC = 10;
  const MIN_GAP = 8;

  const rowY = (actor?: string) => (actor === 'home' ? 10 : 40);
  const colorFor = (actor?: string) => (actor === 'home' ? GREEN : RED);

  const layout = useMemo(() => {
    const twoLane = events.map(e =>
      e.actor === 'home' || e.actor === 'opponent' ? e : { ...e, actor: 'opponent' as const }
    );

    const indexed = twoLane.map((e, i) => ({ e, i }));
    indexed.sort((a, b) => (a.e.t - b.e.t) || (a.i - b.i));

    const lastLeft: Record<'home'|'opponent', number> = { home: -Infinity, opponent: -Infinity };
    const items: Array<{ e: EventRow; x: number; y: number; c: string }> = [];

    for (const { e } of indexed) {
      const lane = (e.actor === 'home' ? 'home' : 'opponent') as 'home'|'opponent';
      const desiredX = e.t * PX_PER_SEC;
      const desiredLeft = desiredX - PILL_W / 2;
      const prevLeft = lastLeft[lane];
      const placedLeft = Math.max(desiredLeft, prevLeft + PILL_W + MIN_GAP);
      lastLeft[lane] = placedLeft;

      items.push({ e, x: placedLeft + PILL_W / 2, y: rowY(lane), c: colorFor(lane) });
    }

    const maxCenter = items.length ? Math.max(...items.map(it => it.x)) : 0;
    const contentW = Math.max(screenW, maxCenter + PILL_W / 2 + 24);
    return { items, contentW };
  }, [events, screenW]);

  const scrollRef = useRef<ScrollView>(null);
  const userScrolling = useRef(false);
  const lastAuto = useRef(0);

  useEffect(() => {
    if (!duration) return;
    if (userScrolling.current) return;
    const playheadX = current * PX_PER_SEC;
    const targetX = Math.max(0, playheadX - screenW * 0.5);
    const now = Date.now();
    if (now - lastAuto.current > 120) {
      scrollRef.current?.scrollTo({ x: targetX, animated: false });
      lastAuto.current = now;
    }
  }, [current, duration, screenW]);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: bottomInset + 4 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (userScrolling.current = true)}
        onScrollEndDrag={() => (userScrolling.current = false)}
        onMomentumScrollBegin={() => (userScrolling.current = true)}
        onMomentumScrollEnd={() => (userScrolling.current = false)}
        contentContainerStyle={{ height: BELT_H, paddingHorizontal: 8, width: layout.contentW }}
      >
        <View style={{ width: layout.contentW, height: BELT_H }}>
          {/* center reference track */}
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

          {/* pills */}
          {layout.items.map((it, i) => {
            const isPassed = current >= it.e.t;
            return (
              <Pressable
                key={`${it.e._id ?? 'n'}-${i}`}
                onPress={() => onSeek(it.e.t)}
                onLongPress={() => onPillLongPress?.(it.e)}
                delayLongPress={260}
                style={{
                  position: 'absolute',
                  left: it.x - 64 / 2,
                  top: it.y,
                  width: 64,
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
                  {`${abbrKind(it.e.kind)}${typeof it.e.points === 'number' && it.e.points > 0 ? `+${it.e.points}` : ''}`}
                </Text>
                <Text style={{ color: 'white', opacity: 0.9, fontSize: 9, marginTop: 1 }}>
                  {fmt(it.e.t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ==================== compact top scrub bar (RNGH) ==================== */
function TopScrubber({
  current,
  duration,
  onSeek,
  insets,
  visible,
  onInteracting,
}: {
  current: number;
  duration: number;
  onSeek: (sec: number) => void;
  insets: { top: number; right: number; bottom: number; left: number };
  visible: boolean;
  onInteracting?: (active: boolean) => void;
}) {
  const screenW = Dimensions.get('window').width;
  const H_MARG = Math.max(12, Math.min(24, screenW * 0.04));
  const MAX_W = 520;
  const width = Math.min(MAX_W, screenW - insets.left - insets.right - H_MARG * 2);

  const TOP = insets.top + 96;  // moved up a bit so it clears top score
  const TRACK_H = 8;
  const THUMB_D = 28;

  const [localSec, setLocalSec] = useState<number | null>(null);
  const [bubble, setBubble] = useState<{ x: number; t: number } | null>(null);

  const layoutWRef = useRef(0);
  const getW = () => (layoutWRef.current > 0 ? layoutWRef.current : width);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const secToX = useCallback((sec: number) => {
    const w = getW();
    const p = duration ? sec / duration : 0;
    return p * w;
  }, [duration]);
  const xToSec = useCallback((x: number) => {
    const w = getW();
    const p = clamp(x, 0, w) / w;
    return (duration || 0) * p;
  }, [duration]);

  // RAF throttle for seeks
  const pendingSecRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const flushSeek = useCallback(() => {
    if (pendingSecRef.current == null) { rafRef.current = null; return; }
    const t = pendingSecRef.current;
    pendingSecRef.current = null;
    onSeek(t);
    rafRef.current = null;
  }, [onSeek]);
  const scheduleSeek = useCallback((t: number) => {
    pendingSecRef.current = t;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushSeek);
    }
  }, [flushSeek]);

  const begin = () => { onInteracting?.(true); };
  const end = () => {
    onInteracting?.(false);
    setTimeout(() => setBubble(null), 300);
    if (rafRef.current == null && pendingSecRef.current != null) flushSeek();
    setTimeout(() => setLocalSec(null), 60);
  };

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    if (!(duration > 0)) return;
    const x = clamp(e.nativeEvent.x, 0, getW());
    const sec = xToSec(x);
    setLocalSec(sec);
    setBubble({ x, t: sec });
    scheduleSeek(sec);
  };

  const onStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    const s = e.nativeEvent.state;
    if (s === State.BEGAN || s === State.ACTIVE) begin();
    if (s === State.END || s === State.CANCELLED || s === State.FAILED) end();
  };

  const effectiveSec = localSec ?? current;
  const thumbX = secToX(effectiveSec);

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: (screenW - width) / 2,
        width,
        top: TOP,
        opacity: visible ? 1 : 0.04,
        zIndex: 50,
        elevation: 3,
      }}
    >
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onStateChange}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        activeOffsetX={[-3, 3]}
      >
        <View
          onLayout={(ev) => {
            layoutWRef.current = Math.max(1, ev.nativeEvent.layout.width);
          }}
          style={{ height: 48, justifyContent: 'center' }}
        >
          <View style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: Math.max(0, width - thumbX),
              height: TRACK_H,
              borderRadius: TRACK_H / 2,
              backgroundColor: 'rgba(255,255,255,0.9)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(width - THUMB_D, thumbX - THUMB_D / 2)),
              width: THUMB_D,
              height: THUMB_D,
              borderRadius: THUMB_D / 2,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>↔︎</Text>
          </View>

          {bubble && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: Math.max(0, Math.min(width - 56, bubble.x - 28)),
                bottom: THUMB_D + 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>{fmt(bubble.t)}</Text>
            </View>
          )}
        </View>
      </PanGestureHandler>
    </View>
  );
}

/* ==================== Quick Edit sheet (Replace/Delete) ==================== */
function QuickEditSheet({
  visible,
  event,
  onReplace,
  onDelete,
  onCancel,
  insets,
}: {
  visible: boolean;
  event: EventRow | null;
  onReplace: () => void;
  onDelete: () => void;
  onCancel: () => void;
  insets: { top: number; right: number; bottom: number; left: number };
}) {
  if (!visible || !event) return null;
  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 16 + BELT_H + 8,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        padding: 12,
        zIndex: 60,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', marginBottom: 8 }}>
        Edit {abbrKind(event.kind)}{event.points ? `+${event.points}` : ''} @ {fmt(event.t)}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Pressable
          onPress={onReplace}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#2563eb' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>Replace…</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#dc2626' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>Delete</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ==================== screen ==================== */
export default function PlaybackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // params
  const { videoPath: rawVideoPath, athlete: athleteParam } = useLocalSearchParams();
  const videoPath = Array.isArray(rawVideoPath) ? rawVideoPath[0] : (rawVideoPath || '');

  const [athleteName, setAthleteName] = useState<string>('Athlete');
  const athleteParamStr = typeof athleteParam === 'string' ? athleteParam : Array.isArray(athleteParam) ? athleteParam[0] : '';
  const displayAthlete = (athleteParamStr?.trim() || athleteName);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [debugMsg, setDebugMsg] = useState<string>('');
  const [finalScore, setFinalScore] = useState<{ home: number; opponent: number } | undefined>(undefined);
  const [homeIsAthlete, setHomeIsAthlete] = useState<boolean>(true);

  const [overlayOn, setOverlayOn] = useState(true); // bottom belt visibility
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [skipHUD, setSkipHUD] = useState<{ side: 'left'|'right'; total: number; shownAt: number } | null>(null);
  const skipHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSkipHud = (side: 'left'|'right', add: number) => {
    setSkipHUD((prev) => {
      const now = Date.now();
      if (prev && prev.side === side && now - prev.shownAt < 600) {
        return { side, total: prev.total + add, shownAt: now };
      }
      return { side, total: add, shownAt: now };
    });
    if (skipHudTimer.current) clearTimeout(skipHudTimer.current);
    skipHudTimer.current = setTimeout(() => setSkipHUD(null), 900);
  };

  const player = useVideoPlayer('', (p) => { p.loop = false; });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoPath) return;
      try {
        await (player as any).replaceAsync(String(videoPath));
        if (cancelled) return;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [videoPath, player]);

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const c = (player as any)?.currentTime ?? 0;
        const d = (player as any)?.duration ?? (((player as any)?.durationMs ?? 0) / 1000) ?? 0;
        const playing = (player as any)?.playing ?? (player as any)?.isPlaying ?? false;

        if (!isScrubbing) setNow(typeof c === 'number' ? c : 0);
        setDur(typeof d === 'number' ? d : 0);
        setIsPlaying(!!playing);
      } catch {}
    }, 240);
    return () => clearInterval(id);
  }, [player, isScrubbing]);

  const getLiveDuration = () => {
    const d = (player as any)?.duration;
    const dm = (player as any)?.durationMs;
    return (typeof d === 'number' && d > 0)
      ? d
      : (typeof dm === 'number' && dm > 0 ? dm / 1000 : (dur || 0));
  };

  const onSeek = (sec: number) => {
    try {
      const D = getLiveDuration();
      if (!D) return;
      const clamped = Math.max(0, Math.min(D, sec));
      (player as any).currentTime = clamped;
      if (isScrubbing) setNow(clamped);
    } catch {}
  };

  const onPlayPause = () => {
    try {
      isPlaying ? (player as any)?.pause?.() : (player as any)?.play?.();
    } catch {}
  };

  // accumulate and produce running score
  const accumulate = (evts: EventRow[]) => {
    let h = 0, o = 0;
    return evts.map(e => {
      const pts = typeof e.points === 'number' ? e.points : 0;
      if (pts > 0) {
        if (e.actor === 'home') h += pts;
        else if (e.actor === 'opponent') o += pts;
      }
      return { ...e, scoreAfter: e.scoreAfter ?? { home: h, opponent: o } };
    });
  };

  // === sidecar IO ===
  const sidecarPathRef = useRef<string | null>(null);

  const saveSidecar = async (next: EventRow[]) => {
    try {
      const path = sidecarPathRef.current;
      if (!path) return;

      const ordered = [...next].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      // compute final score
      const last = withScores[withScores.length - 1]?.scoreAfter ?? { home: 0, opponent: 0 };
      setFinalScore(last);

      const payload: Sidecar = {
        athlete: athleteName,
        sport: sidecarMeta.current.sport,
        style: sidecarMeta.current.style,
        createdAt: sidecarMeta.current.createdAt,
        events: withScores,
        finalScore: last,
        homeIsAthlete,
        appVersion: 1,
      };
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload));
    } catch {}
  };

  const sidecarMeta = useRef<{ sport?: string; style?: string; createdAt?: number }>({});

  useEffect(() => {
    if (!videoPath) {
      setDebugMsg('No video path provided.');
      setEvents([]);
      return;
    }
    const lastSlash = videoPath.lastIndexOf('/');
    const lastDot = videoPath.lastIndexOf('.');
       const base = lastDot > lastSlash ? videoPath.slice(0, lastDot) : videoPath;
    const guessSidecar = `${base}.json`;

    const tryReadSidecar = async (p: string) => {
      try {
        const info = await FileSystem.getInfoAsync(p);
        if (!(info as any)?.exists) return null;
        const txt = await FileSystem.readAsStringAsync(p);
        const parsed: Sidecar = JSON.parse(txt || '{}');
        return parsed;
      } catch { return null; }
    };

    const tryDirectorySearch = async () => {
      try {
        const dir = videoPath.slice(0, lastSlash + 1);
        // @ts-ignore
        const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
        const baseName = base.slice(lastSlash + 1);
        const candidate = files.find(f => f.toLowerCase() === `${baseName.toLowerCase()}.json`);
        if (!candidate) return null;
        return await tryReadSidecar(dir + candidate);
      } catch { return null; }
    };

    (async () => {
      setDebugMsg('Loading sidecar…');
      let usedPath: string | null = guessSidecar;

      let parsed = await tryReadSidecar(guessSidecar);
      if (!parsed) {
        parsed = await tryDirectorySearch();
        if (parsed) {
          usedPath = `${videoPath.slice(0, lastSlash + 1)}${base.slice(lastSlash + 1)}.json`;
        }
      }

      sidecarPathRef.current = usedPath;

      if (!parsed) {
        setEvents([]);
        setFinalScore(undefined);
        setDebugMsg(`No sidecar found. Looked for:\n${guessSidecar}`);
        sidecarMeta.current = {};
        return;
      }

      const hiA = parsed.homeIsAthlete !== false; // default true
      setHomeIsAthlete(hiA);
      setAthleteName(parsed.athlete?.trim() || 'Athlete');
      sidecarMeta.current = {
        sport: parsed.sport,
        style: parsed.style,
        createdAt: parsed.createdAt,
      };

      const rawEvts = Array.isArray(parsed.events) ? parsed.events : [];
      const normalized = normalizeEvents(rawEvts, hiA);
      const withIds = assignIds(normalized);
      const ordered = [...withIds].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      setEvents(withScores);

      const fs = parsed.finalScore ?? (withScores.length
        ? withScores[withScores.length - 1].scoreAfter
        : { home: 0, opponent: 0 });
      setFinalScore(fs);
      setDebugMsg(withScores.length ? '' : 'Sidecar loaded but no events.');
    })();
  }, [videoPath]);

  // live score
  const liveScore = useMemo(() => {
    if (!events.length) return { home: 0, opponent: 0 };
    let s = { home: 0, opponent: 0 };
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.t <= now) s = e.scoreAfter ?? s;
      else break;
    }
    return s;
  }, [events, now]);

  const myScore  = homeIsAthlete ? liveScore.home : liveScore.opponent;
  const oppScore = homeIsAthlete ? liveScore.opponent : liveScore.home;

  const outcomeChip = useMemo(() => {
    if (!finalScore) return null;
    const a = homeIsAthlete ? finalScore.home : finalScore.opponent;
    const b = homeIsAthlete ? finalScore.opponent : finalScore.home;
    const out = a > b ? 'W' : a < b ? 'L' : 'T';
    const color = out === 'W' ? GREEN : out === 'L' ? RED : '#f59e0b';
    return { out, a, b, color };
  }, [finalScore, homeIsAthlete]);

  // chrome show/hide
  const [chromeVisible, setChromeVisible] = useState(true);
  const HIDE_AFTER_MS = 2200;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHideTimer = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };
  const showChrome = useCallback(() => {
    setChromeVisible(true);
    clearHideTimer();
    hideTimer.current = setTimeout(() => setChromeVisible(false), HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    clearHideTimer();
    if (isPlaying) showChrome(); else setChromeVisible(true);
    return clearHideTimer;
  }, [isPlaying, showChrome]);

  // Tap zones: single tap only shows chrome; double tap seeks by 5s
  const lastTapLeft = useRef(0);
  const lastTapRight = useRef(0);
  const DOUBLE_MS = 260;

  const onSeekRelative = (delta: number) => onSeek((now || 0) + delta);

  const handleLeftTap = () => {
    const nowMs = Date.now();
    if (nowMs - lastTapLeft.current < DOUBLE_MS) {
      lastTapLeft.current = 0;
      onSeekRelative(-SKIP_SEC);
      showSkipHud('left', SKIP_SEC);
      showChrome();
    } else {
      lastTapLeft.current = nowMs;
      // Single tap: just reveal chrome, no play/pause
      setTimeout(() => showChrome(), DOUBLE_MS + 20);
    }
  };

  const handleRightTap = () => {
    const nowMs = Date.now();
    if (nowMs - lastTapRight.current < DOUBLE_MS) {
      lastTapRight.current = 0;
      onSeekRelative(+SKIP_SEC);
      showSkipHud('right', SKIP_SEC);
      showChrome();
    } else {
      lastTapRight.current = nowMs;
      setTimeout(() => showChrome(), DOUBLE_MS + 20);
    }
  };

  const SCRUB_RESERVED_TOP = insets.top + 150; // leave room for scrubber/score
  const tapZoneBottomGap = (overlayOn ? BELT_H : 0) + insets.bottom;

  /* ====== Edit/Add state ====== */
  const [editMode, setEditMode] = useState(false);
  const [editSubmode, setEditSubmode] = useState<'add'|'replace'|null>(null);
  const [editAnchorSec, setEditAnchorSec] = useState<number>(0);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [quickEditFor, setQuickEditFor] = useState<EventRow | null>(null);

  const genId = () => Math.random().toString(36).slice(2, 9);

  const enterAddMode = () => {
    setEditMode(true);
    setEditSubmode('add');
    setEditAnchorSec(now || 0);
    setEditTargetId(null);
    setOverlayOn(true);
    showChrome(); // reveal UI
  };

  const enterReplaceMode = (ev: EventRow) => {
    setEditMode(true);
    setEditSubmode('replace');
    setEditTargetId(ev._id ?? genId());
    setOverlayOn(true);
    showChrome();
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditSubmode(null);
    setEditTargetId(null);
    setQuickEditFor(null);
    // keep overlayOn as-is (belt toggle)
    showChrome();
  };

  // Handle selection from sport overlay during Edit/Add
  const handleEditOverlayEvent = (evt: OverlayEvent) => {
    const actor: Actor = toActor(evt.actor);
    const kind = String((evt as any).key ?? (evt as any).kind ?? 'unknown');
    const points = typeof evt.value === 'number' ? evt.value : undefined;

    if (editSubmode === 'add') {
      const t = Math.max(0, Math.min(getLiveDuration(), editAnchorSec || 0));
      const newEvt: EventRow = { _id: genId(), t, kind, points, actor, meta: evt as any };
      const next: EventRow[] = accumulate([...events, newEvt].sort((a, b) => a.t - b.t));
      setEvents(next);
      saveSidecar(next);
      exitEditMode();
      return;
    }

    if (editSubmode === 'replace' && editTargetId) {
      const nextBase: EventRow[] = events.map(e =>
        e._id === editTargetId
          ? ({ ...e, kind, points, actor, meta: evt as any } as EventRow)
          : e
      );
      const next: EventRow[] = accumulate(nextBase);
      setEvents(next);
      saveSidecar(next);
      exitEditMode();
      return;
    }

    exitEditMode();
  };

  // Which overlay to show while editing — expand later for more sports
  const renderEditOverlay = () => {
    // For now always Folkstyle; later switch by sidecarMeta.current.sport/style
    return (
      <WrestlingFolkstyleOverlay
        isRecording={true}
        onEvent={handleEditOverlayEvent}
        getCurrentTSec={() => Math.round(editAnchorSec)}
        sport="wrestling"
        style="folkstyle"
        score={{ home: 0, opponent: 0 }}
      />
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1 }}>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls={false}
          contentFit="contain"
        />

        {/* TWO half-screen tap zones — start BELOW the scrub bar */}
        <View
          style={{
            position: 'absolute',
            left: 0, right: 0,
            top: SCRUB_RESERVED_TOP,
            bottom: tapZoneBottomGap,
            flexDirection: 'row',
          }}
          pointerEvents="box-none"
        >
          <Pressable onPress={handleLeftTap} style={{ flex: 1 }} />
          <Pressable onPress={handleRightTap} style={{ flex: 1 }} />
        </View>

        {/* back button (top-left) */}
        <Pressable
          onPress={() => router.back()}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.45)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            opacity: chromeVisible ? 1 : 0,
          }}
          pointerEvents={chromeVisible ? 'auto' : 'none'}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>‹ Back</Text>
        </Pressable>

        {/* overlay toggle (top-right) */}
        <Pressable
          onPress={() => setOverlayOn((v) => !v)}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.45)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            opacity: chromeVisible ? 1 : 0,
          }}
          pointerEvents={chromeVisible ? 'auto' : 'none'}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>
            {overlayOn ? 'Overlay: On' : 'Overlay: Off'}
          </Text>
        </Pressable>

        {/* FINAL outcome chip centered at top */}
        {outcomeChip && (
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: hexToRgba(outcomeChip.color, 0.22), borderWidth: 1, borderColor: hexToRgba(outcomeChip.color, 0.4) }}>
              <Text style={{ color: 'white', fontWeight: '900' }}>
                {outcomeChip.out} {outcomeChip.a}–{outcomeChip.b}
              </Text>
            </View>
          </View>
        )}

        {/* LIVE score — left (athlete) / right (opponent) */}
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 50, left: 8, right: 8 }}>
          <View style={{ position: 'absolute', left: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: hexToRgba(GREEN, 0.22), borderWidth: 1, borderColor: hexToRgba(GREEN, 0.4) }}>
            <Text style={{ color: 'white', fontWeight: '900' }}>{displayAthlete} • {homeIsAthlete ? myScore : oppScore}</Text>
          </View>
          <View style={{ position: 'absolute', right: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: hexToRgba(RED, 0.22), borderWidth: 1, borderColor: hexToRgba(RED, 0.4) }}>
            <Text style={{ color: 'white', fontWeight: '900' }}>Opponent • {homeIsAthlete ? oppScore : myScore}</Text>
          </View>
        </View>

        {/* Top scrub bar */}
        <TopScrubber
          current={now}
          duration={dur}
          onSeek={(t) => { onSeek(t); showChrome(); }}
          insets={insets}
          visible={chromeVisible}
          onInteracting={setIsScrubbing}
        />

        {/* YouTube-style skip overlay (5s) */}
        {skipHUD && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: Math.max(insets.top + 120, Dimensions.get('window').height * 0.35),
              ...(skipHUD.side === 'left'
                ? { left: insets.left + 24, alignItems: 'flex-start' }
                : { right: insets.right + 24, alignItems: 'flex-end' }),
              zIndex: 20,
            }}
          >
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
              <Text style={{ color: 'white', fontSize: 28, fontWeight: '900' }}>
                {skipHUD.side === 'left' ? '⟲' : '⟳'} {skipHUD.total}s
              </Text>
              <Text style={{ color: 'white', opacity: 0.9, fontSize: 12, marginTop: 4 }}>
                {skipHUD.side === 'left' ? 'Rewind' : 'Forward'}
              </Text>
            </View>
          </View>
        )}

        {/* bottom event belt */}
        {overlayOn && (
          <EventBelt
            duration={dur}
            current={now}
            events={events}
            onSeek={onSeek}
            bottomInset={insets.bottom}
            onPillLongPress={(ev) => setQuickEditFor(ev)}
          />
        )}

        {/* Edit/Add (bottom-left) */}
        <Pressable
          onPress={enterAddMode}
          style={{
            position: 'absolute',
            left: 12,
            bottom: insets.bottom + (overlayOn ? BELT_H + 20 : 16),
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: 'white',
            opacity: chromeVisible ? 1 : 0,
          }}
          pointerEvents={chromeVisible ? 'auto' : 'none'}
        >
          <Text style={{ color: '#111', fontWeight: '900' }}>Edit / Add</Text>
        </Pressable>

        {/* Play/Pause (bottom-right) — only via button */}
        <Pressable
          onPress={() => { onPlayPause(); showChrome(); }}
          style={{
            position: 'absolute',
            right: 12,
            bottom: insets.bottom + (overlayOn ? BELT_H + 20 : 16),
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            opacity: chromeVisible ? 1 : 0,
          }}
          pointerEvents={chromeVisible ? 'auto' : 'none'}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>{isPlaying ? 'Pause' : 'Play'}</Text>
        </Pressable>

        {/* Quick Edit (Replace/Delete) on pill long-press */}
        <QuickEditSheet
          visible={!!quickEditFor}
          event={quickEditFor}
          insets={insets}
          onCancel={() => setQuickEditFor(null)}
          onDelete={() => {
            if (!quickEditFor) return;
            const next: EventRow[] = accumulate(events.filter(e => e._id !== quickEditFor._id));
            setEvents(next);
            saveSidecar(next);
            setQuickEditFor(null);
          }}
          onReplace={() => {
            if (!quickEditFor) return;
            enterReplaceMode(quickEditFor);
            setQuickEditFor(null);
          }}
        />

        {/* ========== EDIT OVERLAY (full screen over video; scrub still works) ========== */}
        {editMode && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          >
            {/* sport overlay consumes touches only on its own buttons */}
            <View pointerEvents="auto" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
              {renderEditOverlay()}
            </View>

            {/* Mid-screen hint */}
            <View pointerEvents="none" style={{ position: 'absolute', top: Dimensions.get('window').height * 0.25, left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.25)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)' }}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>
                  {editSubmode === 'add'
                    ? `Add @ ${fmt(editAnchorSec)} — tap a button`
                    : `Replace — tap a button`}
                </Text>
              </View>
            </View>

            {/* Tap to exit (center) */}
            <Pressable
              onPress={exitEditMode}
              style={{
                position: 'absolute',
                left: 0, right: 0,
                top: Dimensions.get('window').height * 0.40,
                alignItems: 'center',
              }}
            >
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f59e0b' }}>
                <Text style={{ color: '#111', fontWeight: '900' }}>Tap to exit Edit/Add</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
