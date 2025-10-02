// app/screens/PlaybackScreen.tsx
import * as FileSystem from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* === colors === */
const GREEN = '#16a34a';
const RED   = '#dc2626';
const GREY  = '#9ca3af';

const SKIP_SEC = 10;        // double-tap skip
const BELT_H   = 76;        // event belt height

/* ==================== types ==================== */
type EventRow = {
  t: number;
  kind: string;
  points?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

type Sidecar = {
  athlete?: string;
  sport?: string;
  style?: string;
  createdAt?: number;
  events?: EventRow[];
  finalScore?: { home: number; opponent: number };
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
    case 'stalling':  return 'ST';
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

/* ==================== bottom event belt (fixed; pills don’t shrink) ==================== */
function EventBelt({
  duration,
  current,
  events,
  onSeek,
  bottomInset,
}: {
  duration: number;
  current: number;
  events: EventRow[];
  onSeek: (sec: number) => void;
  bottomInset: number;
}) {
  const screenW = Dimensions.get('window').width;

  const PILL_W = 64;
  const PILL_H = 28;
  const PX_PER_SEC = 10; // time → x mapping for belt

  const ordered = useMemo(() => [...events].sort((a, b) => a.t - b.t), [events]);
  const isPast = (t: number) => t <= current;
  const maxTime = Math.max(duration || 0, ordered.length ? ordered[ordered.length - 1].t : 0);
  const contentW = Math.max(screenW, maxTime * PX_PER_SEC + 24);

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

  const colorFor = (actor?: string) =>
    actor === 'home' ? GREEN : actor === 'opponent' ? RED : GREY;

  const rowY = (actor?: string) =>
    actor === 'home' ? 10 : actor === 'opponent' ? 40 : 25;

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
        contentContainerStyle={{ height: BELT_H, paddingHorizontal: 8, width: contentW }}
      >
        <View style={{ width: contentW, height: BELT_H }}>
          {/* visual reference track */}
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
          {ordered.map((e, i) => {
            const x = e.t * PX_PER_SEC;
            const y = rowY(e.actor);
            const c = colorFor(e.actor);
            const label = `${abbrKind(e.kind)}${typeof e.points === 'number' && e.points > 0 ? `+${e.points}` : ''}`;
            const bg = hexToRgba(c, 0.75);
            const opacity = isPast(e.t) ? 0.75 : 1;
            return (
              <Pressable
                key={`${e.t}-${i}`}
                onPress={() => onSeek(e.t)}
                style={{
                  position: 'absolute',
                  left: x - PILL_W / 2,
                  top: y,
                  width: PILL_W,
                  height: PILL_H,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: bg,
                  borderWidth: 1,
                  borderColor: c,
                  opacity,
                }}
              >
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={{ color: 'white', opacity: 0.85, fontSize: 9, marginTop: 1 }}>
                  {fmt(e.t)}
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
  visible: boolean;               // chromeVisible
  onInteracting?: (active: boolean) => void;
}) {
  const screenW = Dimensions.get('window').width;
  const H_MARG = Math.max(12, Math.min(24, screenW * 0.04));
  const MAX_W = 520;
  const width = Math.min(MAX_W, screenW - insets.left - insets.right - H_MARG * 2);

  // below back/toggle/outcome row
  const TOP = insets.top + 86;

  const TRACK_H = 8;
  const THUMB_D = 28;

  const [dragging, setDragging] = useState(false);
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

  const begin = () => { setDragging(true); onInteracting?.(true); };
  const end = () => {
    setDragging(false);
    onInteracting?.(false);
    setTimeout(() => setBubble(null), 300);
    if (rafRef.current == null && pendingSecRef.current != null) flushSeek();
    setTimeout(() => setLocalSec(null), 60);
  };

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    if (!(duration > 0)) return; // ignore until duration known
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
      // keep touchable even when faded
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
        activeOffsetX={[-3, 3]}   // start only on horizontal movement
      >
        <View
          onLayout={(e) => {
            layoutWRef.current = Math.max(1, e.nativeEvent.layout.width);
          }}
          style={{
            height: 48, // comfy hit target
            justifyContent: 'center',
          }}
        >
          {/* track */}
          <View
            style={{
              height: TRACK_H,
              borderRadius: TRACK_H / 2,
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          />
          {/* progress */}
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
          {/* thumb */}
          <View
            style={{
              position: 'absolute',
              left: clamp(thumbX - THUMB_D / 2, 0, width - THUMB_D),
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

          {/* time bubble while dragging */}
          {bubble && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: clamp(bubble.x - 28, 0, width - 56),
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

/* ==================== screen ==================== */
export default function PlaybackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { videoPath: rawVideoPath } = useLocalSearchParams();
  const videoPath = Array.isArray(rawVideoPath) ? rawVideoPath[0] : (rawVideoPath || '');

  const [events, setEvents] = useState<EventRow[]>([]);
  const [debugMsg, setDebugMsg] = useState<string>('');
  const [sidecarPath, setSidecarPath] = useState<string>('');
  const [finalScore, setFinalScore] = useState<{ home: number; opponent: number } | null>(null);
  const [homeIsAthlete, setHomeIsAthlete] = useState<boolean>(true);
  const [athleteName, setAthleteName] = useState<string>('Athlete');

  const [overlayOn, setOverlayOn] = useState(true);
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

  const onTogglePlay = () => {
    try {
      isPlaying ? (player as any)?.pause?.() : (player as any)?.play?.();
    } catch {}
  };

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
      let parsed = await tryReadSidecar(guessSidecar);
      if (!parsed) parsed = await tryDirectorySearch();

      if (!parsed) {
        setSidecarPath(guessSidecar);
        setEvents([]);
        setFinalScore(null);
        setDebugMsg(`No sidecar found. Looked for:\n${guessSidecar}`);
        return;
      }

      setSidecarPath(guessSidecar);
      setAthleteName(parsed.athlete?.trim() || 'Athlete');
      setHomeIsAthlete(parsed.homeIsAthlete !== false); // default true
      const evts = Array.isArray(parsed.events) ? parsed.events : [];
      const ordered = [...evts].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      setEvents(withScores);

      const fs = parsed.finalScore ?? (withScores.length
        ? withScores[withScores.length - 1].scoreAfter ?? null
        : null);
      setFinalScore(fs ?? null);
      setDebugMsg(withScores.length ? '' : 'Sidecar loaded but no events.');
    })();
  }, [videoPath]);

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

  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HIDE_AFTER_MS = 2200;
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

  const lastTapLeft = useRef(0);
  const lastTapRight = useRef(0);
  const singleTimerLeft = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTimerRight = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_MS = 260;

  const onSeekRelative = (delta: number) => onSeek((now || 0) + delta);

  const handleLeftTap = () => {
    const nowMs = Date.now();
    if (nowMs - lastTapLeft.current < DOUBLE_MS) {
      if (singleTimerLeft.current) { clearTimeout(singleTimerLeft.current); singleTimerLeft.current = null; }
      lastTapLeft.current = 0;
      onSeekRelative(-SKIP_SEC);
      showSkipHud('left', SKIP_SEC);
      showChrome();
    } else {
      lastTapLeft.current = nowMs;
      singleTimerLeft.current = setTimeout(() => {
        onTogglePlay();
        showChrome();
        singleTimerLeft.current = null;
      }, DOUBLE_MS + 20);
    }
  };

  const handleRightTap = () => {
    const nowMs = Date.now();
    if (nowMs - lastTapRight.current < DOUBLE_MS) {
      if (singleTimerRight.current) { clearTimeout(singleTimerRight.current); singleTimerRight.current = null; }
      lastTapRight.current = 0;
      onSeekRelative(+SKIP_SEC);
      showSkipHud('right', SKIP_SEC);
      showChrome();
    } else {
      lastTapRight.current = nowMs;
      singleTimerRight.current = setTimeout(() => {
        onTogglePlay();
        showChrome();
        singleTimerRight.current = null;
      }, DOUBLE_MS + 20);
    }
  };

  // keep the tap zones well below the scrubber so they never intercept it
  const SCRUB_RESERVED_TOP = insets.top + 140;
  const tapZoneBottomGap = (overlayOn ? BELT_H : 0) + insets.bottom;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      {/* hide expo-router header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* full-screen video */}
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

        {/* overlay toggle (TOP-RIGHT) */}
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

        {/* Play button — visible only when paused */}
        {!isPlaying && (
          <Pressable
            onPress={() => { onTogglePlay(); showChrome(); }}
            style={{
              position: 'absolute',
              left: 0, right: 0,
              bottom: (overlayOn ? (BELT_H + 28) : 24) + insets.bottom,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
                ▶︎
              </Text>
            </View>
          </Pressable>
        )}

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
            <Text style={{ color: 'white', fontWeight: '900' }}>{athleteName} • {myScore}</Text>
          </View>
          <View style={{ position: 'absolute', right: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: hexToRgba(RED, 0.22), borderWidth: 1, borderColor: hexToRgba(RED, 0.4) }}>
            <Text style={{ color: 'white', fontWeight: '900' }}>Opponent • {oppScore}</Text>
          </View>
        </View>

        {/* Top scrub bar (RNGH) */}
        <TopScrubber
          current={now}
          duration={dur}
          onSeek={(t) => { onSeek(t); showChrome(); }}
          insets={insets}
          visible={chromeVisible}
          onInteracting={setIsScrubbing}
        />

        {/* YouTube-style skip overlay */}
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

        {/* bottom event belt (buttons) */}
        {overlayOn && (
          <EventBelt
            duration={dur}
            current={now}
            events={events}
            onSeek={onSeek}
            bottomInset={insets.bottom}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

