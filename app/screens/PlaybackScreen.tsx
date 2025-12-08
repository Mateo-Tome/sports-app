// app/screens/PlaybackScreen.tsx
import * as FileSystem from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// === Module registry (add your modules here)
import BaseballHittingPlaybackModule from '../../components/modules/baseball/BaseballHittingPlaybackModule';
import WrestlingFolkstylePlaybackModule from '../../components/modules/wrestling/WrestlingFolkstylePlaybackModule';
import TopScrubber from '../../components/playback/TopScrubber';

import type { OverlayEvent, PlaybackModuleProps } from '../../components/modules/types';

// 🔹 NEW: shared core helpers/types
import {
  abbrKind,
  Actor,
  assignIds,
  deriveOutcome,
  EventRow,
  fmt,
  normalizeEvents,
  PENALTYISH,
  Sidecar,
  toActor
} from '../../components/playback/playbackCore';

/* === constants (shared chrome only) === */
const GREEN = '#16a34a';
const RED = '#dc2626';
const SKIP_SEC = 5;
const BELT_H = 76;
const EDGE_PAD = 24;
const SAFE_MARGIN = 12;

/* === overlay visibility modes (score vs belt) === */
type OverlayMode = 'all' | 'noBelt' | 'noScore' | 'off';

/* ==================== Event Belt (shared) ==================== */
function EventBelt({
  duration,
  current,
  events,
  onSeek,
  bottomInset,
  colorFor,
  onPillLongPress,
}: {
  duration: number;
  current: number;
  events: EventRow[];
  onSeek: (sec: number) => void;
  bottomInset: number;
  colorFor: (e: EventRow) => string;
  onPillLongPress: (ev: EventRow) => void;
}) {
  const screenW = Dimensions.get('window').width;
  const PILL_W = 64;
  const MIN_GAP = 8;
  const PX_PER_SEC = 10;
  const BASE_LEFT = EDGE_PAD;

  const rowY = (actor?: string) => (actor === 'home' ? 10 : 40);

  const layout = React.useMemo(() => {
    const twoLane = events.map(e =>
      e.actor === 'home' || e.actor === 'opponent' ? e : { ...e, actor: 'opponent' as const }
    );
    const indexed = twoLane.map((e, i) => ({ e, i }));
    indexed.sort((a, b) => a.e.t - b.e.t || a.i - b.i);
    const lastLeft: Record<'home' | 'opponent', number> = { home: BASE_LEFT - PILL_W, opponent: BASE_LEFT - PILL_W };
    const items: Array<{ e: EventRow; x: number; y: number; c: string }> = [];

    for (const { e } of indexed) {
      const lane = (e.actor === 'home' ? 'home' : 'opponent') as 'home' | 'opponent';
      const desiredX = e.t * PX_PER_SEC;
      const desiredLeft = Math.max(desiredX - PILL_W / 2, BASE_LEFT);
      const prevLeft = lastLeft[lane];
      const placedLeft = Math.max(desiredLeft, prevLeft + PILL_W + MIN_GAP, BASE_LEFT);
      lastLeft[lane] = placedLeft;

      items.push({ e, x: placedLeft + PILL_W / 2, y: rowY(lane), c: colorFor(e) });
    }
    const maxCenter = items.length ? Math.max(...items.map(it => it.x)) : 0;
    const contentW = Math.max(screenW, maxCenter + PILL_W / 2 + EDGE_PAD);
    return { items, contentW };
  }, [events, screenW, colorFor]);

  const scrollRef = useRef<ScrollView>(null);
  const userScrolling = useRef(false);
  const lastAuto = useRef(0);

  useEffect(() => {
    if (!duration) return;
    if (userScrolling.current) return;
    const playheadX = current * PX_PER_SEC;
    const targetX = Math.max(0, playheadX - screenW * 0.5);
    const nowMs = Date.now();
    if (nowMs - lastAuto.current > 120) {
      scrollRef.current?.scrollTo({ x: targetX, animated: false });
      lastAuto.current = nowMs;
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
        contentContainerStyle={{ height: BELT_H, paddingHorizontal: EDGE_PAD, width: layout.contentW + EDGE_PAD * 2 }}
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
            const isPassed = current >= it.e.t;
            return (
              <Pressable
                key={`${it.e._id ?? 'n'}-${i}`}
                onPress={() => onSeek(it.e.t)}
                onLongPress={() => onPillLongPress(it.e)}
                delayLongPress={280}
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
                  {`${abbrKind(it.e.kind)}${
                    typeof it.e.points === 'number' && it.e.points > 0 ? `+${it.e.points}` : ''
                  }`}
                </Text>

                <Text style={{ color: 'white', opacity: 0.9, fontSize: 9, marginTop: 1 }}>{fmt(it.e.t)}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ==================== Quick Edit sheet (shared) ==================== */
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
        Edit {abbrKind(event.kind)}
        {event.points ? `+${event.points}` : ''} @ {fmt(event.t)}
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

/* ==================== Overlay mode popup ==================== */
function OverlayModeMenu({
  visible,
  mode,
  onSelect,
  onClose,
  insets,
}: {
  visible: boolean;
  mode: OverlayMode;
  onSelect: (m: OverlayMode) => void;
  onClose: () => void;
  insets: { top: number; right: number; bottom: number; left: number };
}) {
  if (!visible) return null;

  // super short labels: All / Score / Belt / Off
  const options: { key: OverlayMode; label: string }[] = [
    { key: 'all', label: 'All' }, // score + belt
    { key: 'noBelt', label: 'Score' }, // score only
    { key: 'noScore', label: 'Belt' }, // belt only
    { key: 'off', label: 'Off' }, // everything off
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
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
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
          minWidth: 120, // much narrower than before
        }}
      >
        {options.map(opt => {
          const isActive = opt.key === mode;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                onSelect(opt.key);
              }}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: isActive ? 'rgba(59,130,246,0.35)' : 'transparent',
                marginBottom: 2,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ==================== MODULE REGISTRY ==================== */
const ModuleRegistry: Record<string, React.ComponentType<PlaybackModuleProps>> = {
  'wrestling:folkstyle': WrestlingFolkstylePlaybackModule,
  'baseball:hitting': BaseballHittingPlaybackModule,
};

/* ==================== screen ==================== */
export default function PlaybackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // params
  const { videoPath: rawVideoPath, athlete: athleteParam } = useLocalSearchParams();
  const videoPath = Array.isArray(rawVideoPath) ? rawVideoPath[0] : rawVideoPath || '';

  const [athleteName, setAthleteName] = useState<string>('Athlete');
  const athleteParamStr =
    typeof athleteParam === 'string' ? athleteParam : Array.isArray(athleteParam) ? athleteParam[0] : '';
  const displayAthlete = athleteParamStr?.trim() || athleteName;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [debugMsg, setDebugMsg] = useState<string>('');
  const [finalScore, setFinalScore] = useState<{ home: number; opponent: number } | undefined>(undefined);

  const [homeIsAthlete, setHomeIsAthlete] = useState<boolean>(true);
  const [homeColorIsGreen, setHomeColorIsGreen] = useState<boolean>(true);
  const [sport, setSport] = useState<string | undefined>(undefined);
  const [style, setStyle] = useState<string | undefined>(undefined);

  // overlay visibility mode (drives ALL sports)
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('all');
  const [overlayMenuOpen, setOverlayMenuOpen] = useState(false);

  // derived flags
  // overlayOn = sport-specific overlays (scoreboard, pills, etc.)
  const overlayOn = overlayMode === 'all' || overlayMode === 'noBelt';
  // event belt visibility is driven separately
  const showEventBelt = overlayMode === 'all' || overlayMode === 'noScore';

  const overlayLabel = useMemo(() => {
    switch (overlayMode) {
      case 'all':
        return 'Overlay: All';
      case 'noBelt':
        return 'Score Only';
      case 'noScore':
        return 'Belt Only';
      case 'off':
      default:
        return 'Overlay: Off';
    }
  }, [overlayMode]);

  const [isScrubbing, setIsScrubbing] = useState(false);

  // edit state
  const [editMode, setEditMode] = useState(false);
  const [editSubmode, setEditSubmode] = useState<'add' | 'replace' | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [quickEditFor, setQuickEditFor] = useState<EventRow | null>(null);

  // skip HUD state (reserved)
  const [skipHUD, setSkipHUD] = useState<{ side: 'left' | 'right'; total: number; shownAt: number } | null>(null);
  const skipHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSkipHud = (side: 'left' | 'right', add: number) => {
    setSkipHUD(prev => {
      const now = Date.now();
      if (prev && prev.side === side && now - prev.shownAt < 600) {
        return { side, total: prev.total + add, shownAt: now };
      }
      return { side, total: add, shownAt: now };
    });
    if (skipHudTimer.current) clearTimeout(skipHudTimer.current);
    skipHudTimer.current = setTimeout(() => setSkipHUD(null), 900);
  };

  const player = useVideoPlayer('', p => {
    p.loop = false;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!videoPath) return;
      try {
        await (player as any).replaceAsync(String(videoPath));
        if (cancelled) return;
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [videoPath, player]);

  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const c = (player as any)?.currentTime ?? 0;
        const d = (player as any)?.duration ?? ((player as any)?.durationMs ?? 0) / 1000 ?? 0;
        const playing = (player as any)?.playing ?? (player as any)?.isPlaying ?? false;

        if (!isScrubbing) setNow(typeof c === 'number' ? c : 0);
        setDur(typeof d === 'number' ? d : 0);
        setIsPlaying(!!playing);
      } catch {}
    }, 240);
    return () => clearInterval(id);
  }, [player, isScrubbing]);

  const atVideoEnd = !isPlaying && dur > 0 && Math.abs(now - dur) < 0.25;

  const getLiveDuration = () => {
    const d = (player as any)?.duration;
    const dm = (player as any)?.durationMs;
    return typeof d === 'number' && d > 0 ? d : typeof dm === 'number' && dm > 0 ? dm / 1000 : dur || 0;
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

  const accumulate = (evts: EventRow[]) => {
    let h = 0,
      o = 0;
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
  const sidecarMeta = useRef<{ sport?: string; style?: string; createdAt?: number }>({});

  const saveSidecar = async (next: EventRow[]) => {
    try {
      const path = sidecarPathRef.current;
      if (!path) return;

      const ordered = [...next].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      const o = deriveOutcome(withScores, homeIsAthlete);
      setFinalScore(o.finalScore);

      const payload: Sidecar = {
        athlete: athleteName,
        sport: sidecarMeta.current.sport,
        style: sidecarMeta.current.style,
        createdAt: sidecarMeta.current.createdAt,
        events: withScores,
        finalScore: o.finalScore,
        homeIsAthlete,
        homeColorIsGreen,
        appVersion: 1,
        outcome: o.outcome,
        winner: o.winner,
        endedBy: o.endedBy,
        athletePinned: o.athletePinned,
        athleteWasPinned: o.athleteWasPinned,
        modifiedAt: Date.now(),
      };

      const tmp = `${path}.tmp`;
      await FileSystem.writeAsStringAsync(tmp, JSON.stringify(payload));
      try {
        DeviceEventEmitter.emit('sidecarUpdated', { uri: videoPath, sidecar: payload });
      } catch {}
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {}
      await FileSystem.moveAsync({ from: tmp, to: path });
    } catch {}
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
      } catch {
        return null;
      }
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
      } catch {
        return null;
      }
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
        setSport(undefined);
        setStyle(undefined);
        setHomeIsAthlete(true);
        setHomeColorIsGreen(true);
        return;
      }

      const hiA = parsed.homeIsAthlete !== false; // default true
      const hcG = parsed.homeColorIsGreen !== false; // default true

      setHomeIsAthlete(hiA);
      setHomeColorIsGreen(hcG);

      setAthleteName(parsed.athlete?.trim() || 'Athlete');
      sidecarMeta.current = {
        sport: parsed.sport,
        style: parsed.style,
        createdAt: parsed.createdAt,
      };
      setSport(parsed.sport);
      setStyle(parsed.style);

      const rawEvts = Array.isArray(parsed.events) ? parsed.events : [];
      const normalized = normalizeEvents(rawEvts, hiA);
      const withIds = assignIds(normalized);
      const ordered = [...withIds].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      setEvents(withScores);

      const fs =
        parsed.finalScore ??
        (withScores.length ? withScores[withScores.length - 1].scoreAfter : { home: 0, opponent: 0 });
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

  // chrome show/hide (scrubber + play/pause + edit use this)
  const [chromeVisible, setChromeVisible] = useState(true);
  const HIDE_AFTER_MS = 2200;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  const showChrome = useCallback(() => {
    setChromeVisible(true);
    clearHideTimer();
    hideTimer.current = setTimeout(() => setChromeVisible(false), HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    clearHideTimer();
    if (!editMode) {
      if (isPlaying) showChrome();
      else setChromeVisible(true);
    } else {
      setChromeVisible(false);
    }
    return clearHideTimer;
  }, [isPlaying, showChrome, editMode]);

  // Tap zones (double tap skip; single tap shows chrome)
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

  const SCRUB_RESERVED_TOP = insets.top + 150;
  const tapZoneBottomGap = (showEventBelt ? BELT_H : 0) + insets.bottom;

  // ====== editing from modules ======
  const genId = () => Math.random().toString(36).slice(2, 9);

  const enterAddMode = () => {
    setEditMode(true);
    setEditSubmode('add');
    setEditTargetId(null);
    try {
      (player as any)?.pause?.();
    } catch {}
  };

  const enterReplaceMode = (ev: EventRow) => {
    setEditMode(true);
    setEditSubmode('replace');
    setEditTargetId(ev._id ?? genId());
    try {
      (player as any)?.pause?.();
    } catch {}
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditSubmode(null);
    setEditTargetId(null);
    setQuickEditFor(null);
  };

  const handleOverlayEventFromModule = (evt: OverlayEvent) => {
    const actor: Actor = toActor((evt as any).actor);
    const kind = String((evt as any).key ?? (evt as any).kind ?? 'unknown');
    const points = typeof (evt as any).value === 'number' ? (evt as any).value : undefined;

    // FLATTEN META: take evt.meta as row.meta, plus label
    const baseMeta = ((evt as any).meta ?? {}) as Record<string, any>;
    const label = (evt as any).label;
    const metaForRow = {
      ...(label ? { label } : {}),
      ...baseMeta,
    };

    const tNow = Math.max(0, Math.min(getLiveDuration(), now || 0));

    if (editSubmode === 'add') {
      const newEvt: EventRow = { _id: genId(), t: tNow, kind, points, actor, meta: metaForRow };
      const next: EventRow[] = accumulate([...events, newEvt].sort((a, b) => a.t - b.t));
      setEvents(next);
      saveSidecar(next);
      exitEditMode();
      return;
    }

    if (editSubmode === 'replace' && editTargetId) {
      const nextBase: EventRow[] = events.map(e =>
        e._id === editTargetId
          ? ({
              ...e,
              t: tNow,
              kind,
              points,
              actor,
              meta: metaForRow,
            } as EventRow)
          : e
      );
      const next: EventRow[] = accumulate(nextBase.sort((a, b) => a.t - b.t));
      setEvents(next);
      saveSidecar(next);
      exitEditMode();
      return;
    }

    const newEvt: EventRow = { _id: genId(), t: tNow, kind, points, actor, meta: metaForRow };
    const next: EventRow[] = accumulate([...events, newEvt].sort((a, b) => a.t - b.t));
    setEvents(next);
    saveSidecar(next);
  };

  // ====== Module resolve ======
  const moduleKey = `${(sport || '').toLowerCase()}:${(style || 'default').toLowerCase()}`;
  const ModuleCmp = ModuleRegistry[moduleKey];

  // === COLOR MAPPING FOR BELT ===
  const colorForPill = useCallback(
    (e: EventRow) => {
      const meta = (e.meta ?? {}) as any;
      const inner = (meta.meta ?? {}) as any; // support older nested shape

      // --- Step 1: sport-agnostic explicit colors ---
      const explicit =
        meta.pillColor ??
        inner.pillColor ??
        meta.color ??
        inner.color ??
        meta.tint ??
        inner.tint ??
        meta.buttonColor ??
        inner.buttonColor ??
        meta.chipColor ??
        inner.chipColor;

      if (typeof explicit === 'string' && explicit.trim().length > 0) {
        return explicit;
      }

      // --- Step 2: legacy wrestling-style fallback using myKidColor/opponentColor ---
      const pickColor = (which: 'myKidColor' | 'opponentColor'): string | undefined => {
        const raw = meta[which] ?? inner[which];
        if (!raw) return undefined;
        const v = String(raw).toLowerCase();
        if (v === 'green') return GREEN;
        if (v === 'red') return RED;
        return undefined;
      };

      const mk = pickColor('myKidColor');
      const ok = pickColor('opponentColor');

      const isAthleteActor =
        (e.actor === 'home' && homeIsAthlete) ||
        (e.actor === 'opponent' && !homeIsAthlete);

      // If per-event colors exist, use them
      if (mk || ok) {
        const athleteColor = mk;
        const opponentColor = ok;

        if (isAthleteActor && athleteColor) return athleteColor;
        if (!isAthleteActor && opponentColor) return opponentColor;
      }

      // Fallback: color based on global "homeColorIsGreen" + who's the athlete
      const colorIsGreen = homeColorIsGreen !== false; // default true
      const athleteColor = colorIsGreen ? GREEN : RED;
      const opponentColor = colorIsGreen ? RED : GREEN;

      const kind = String(e.kind || '').toLowerCase();
      const pts = typeof e.points === 'number' ? e.points : 0;

      // Scoring events: my kid vs opponent
      if (pts > 0) {
        return isAthleteActor ? athleteColor : opponentColor;
      }

      // Penalties / stalling: treat as "bad" for my kid
      if (PENALTYISH.has(kind)) {
        return opponentColor;
      }

      // Neutral / unknown
      return 'rgba(148,163,184,0.9)';
    },
    [homeIsAthlete, homeColorIsGreen]
  );

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

        {/* Replay */}
        {atVideoEnd && !editMode && (
          <Pressable
            onPress={() => {
              onSeek(0);
              try {
                (player as any)?.play?.();
              } catch {}
            }}
            style={{
              position: 'absolute',
              top: '45%',
              alignSelf: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              zIndex: 40,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>Replay ⟲</Text>
          </Pressable>
        )}

        {/* Interaction layers */}
        {!editMode && (
          <>
            {/* tap zones */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: SCRUB_RESERVED_TOP,
                bottom: tapZoneBottomGap,
                flexDirection: 'row',
              }}
              pointerEvents="box-none"
            >
              <Pressable onPress={handleLeftTap} style={{ flex: 1 }} />
              <Pressable onPress={handleRightTap} style={{ flex: 1 }} />
            </View>

            {/* back */}
            <Pressable
              onPress={() => router.back()}
              style={{
                position: 'absolute',
                top: insets.top + SAFE_MARGIN,
                left: insets.left + SAFE_MARGIN,
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

            {/* overlay toggle (opens mode popup) */}
            <Pressable
              onPress={() => setOverlayMenuOpen(v => !v)}
              style={{
                position: 'absolute',
                top: insets.top + SAFE_MARGIN,
                right: insets.right + SAFE_MARGIN,
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
                {overlayLabel} ▾
              </Text>
            </Pressable>

            {/* Overlay mode menu */}
            <OverlayModeMenu
              visible={overlayMenuOpen && chromeVisible}
              mode={overlayMode}
              insets={insets}
              onClose={() => setOverlayMenuOpen(false)}
              onSelect={m => {
                setOverlayMode(m);
                setOverlayMenuOpen(false);
              }}
            />

            {/* Top scrubber */}
            {chromeVisible && (
              <TopScrubber
                current={now}
                duration={dur}
                onSeek={t => {
                  onSeek(t);
                  showChrome();
                }}
                insets={insets}
                visible={true}
                onInteracting={setIsScrubbing}
              />
            )}

            {/* Bottom-left Edit button */}
            {!atVideoEnd && !editMode && (
              <Pressable
                onPress={() => {
                  enterAddMode();
                  showChrome();
                }}
                style={{
                  position: 'absolute',
                  left: insets.left + SAFE_MARGIN,
                  bottom: insets.bottom + (showEventBelt ? BELT_H + SAFE_MARGIN : SAFE_MARGIN),
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: 'rgba(245,158,11,0.95)',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.4)',
                  opacity: chromeVisible ? 1 : 0,
                }}
                pointerEvents={chromeVisible ? 'auto' : 'none'}
              >
                <Text style={{ color: '#111', fontWeight: '900' }}>Edit</Text>
              </Pressable>
            )}

            {/* Bottom-right Play/Pause button */}
            {!atVideoEnd && (
              <Pressable
                onPress={() => {
                  onPlayPause();
                  showChrome();
                }}
                style={{
                  position: 'absolute',
                  right: insets.right + SAFE_MARGIN,
                  bottom: insets.bottom + (showEventBelt ? BELT_H + SAFE_MARGIN : SAFE_MARGIN),
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                  opacity: chromeVisible ? 1 : 0,
                }}
                pointerEvents={chromeVisible ? 'auto' : 'none'}
              >
                <Text style={{ color: '#fff', fontWeight: '900' }}>
                  {isPlaying ? '❚❚ Pause' : '▶ Play'}
                </Text>
              </Pressable>
            )}

            {/* bottom event belt */}
            {showEventBelt && (
              <EventBelt
                duration={dur}
                current={now}
                events={events}
                onSeek={onSeek}
                bottomInset={insets.bottom}
                colorFor={colorForPill}
                onPillLongPress={ev => setQuickEditFor(ev)}
              />
            )}

            {/* Quick Edit sheet */}
            <QuickEditSheet
              visible={!!quickEditFor}
              event={quickEditFor}
              insets={insets}
              onCancel={() => setQuickEditFor(null)}
              onDelete={() => {
                if (!quickEditFor) return;
                const next: EventRow[] = events.filter(e => e._id !== quickEditFor._id);
                const ordered = [...next].sort((a, b) => a.t - b.t);
                const withScores = ordered.map(e => e);
                setEvents(withScores);
                saveSidecar(withScores);
                setQuickEditFor(null);
              }}
              onReplace={() => {
                if (!quickEditFor) return;
                const id = quickEditFor._id;
                setQuickEditFor(null);
                if (!id) return;
                setEditMode(true);
                setEditSubmode('replace');
                setEditTargetId(id);
                try {
                  (player as any)?.pause?.();
                } catch {}
              }}
            />
          </>
        )}

        {/* SPORT-SPECIFIC MODULE */}
        {ModuleCmp && (
          <ModuleCmp
            now={now}
            duration={dur}
            events={events}
            homeIsAthlete={homeIsAthlete}
            homeColorIsGreen={homeColorIsGreen}
            overlayOn={overlayOn}
            insets={insets}
            onSeek={onSeek}
            onPlayPause={onPlayPause}
            isPlaying={isPlaying}
            enterAddMode={enterAddMode}
            onOverlayEvent={handleOverlayEventFromModule}
            onPillLongPress={ev => setQuickEditFor(ev)}
            liveScore={liveScore}
            finalScore={finalScore}
            editMode={editMode}
            editSubmode={editSubmode}
            athleteName={displayAthlete}
          />
        )}

        {/* EDIT MODE MASK */}
        {editMode && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 100 }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.15)',
              }}
            />
            <Pressable
              onPress={() => {
                setEditMode(false);
                setEditSubmode(null);
                setEditTargetId(null);
                setQuickEditFor(null);
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 24,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: '#f59e0b',
                }}
              >
                <Text style={{ color: '#111', fontWeight: '900' }}>Tap to exit Edit/Add</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
