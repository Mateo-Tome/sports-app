// app/screens/PlaybackScreen.tsx
import * as FileSystem from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ NEW: extracted player hook
import { usePlaybackPlayer } from '../../src/hooks/usePlaybackPlayer';

// === Module registry (add your modules here)
import BaseballHittingPlaybackModule from '../../components/modules/baseball/BaseballHittingPlaybackModule';
import WrestlingFolkstylePlaybackModule from '../../components/modules/wrestling/WrestlingFolkstylePlaybackModule';
import TopScrubber from '../../components/playback/TopScrubber';

import type { OverlayEvent, PlaybackModuleProps } from '../../components/modules/types';

// 🔹 NEW: shared core helpers/types
import {
  Actor,
  assignIds,
  deriveOutcome,
  EventRow,
  normalizeEvents,
  PENALTYISH,
  Sidecar,
  toActor,
} from '../../components/playback/playbackCore';

// 🔹 NEW: UI helpers extracted to separate file
import {
  BELT_H,
  EventBelt,
  Insets,
  OverlayMode,
  OverlayModeMenu,
  QuickEditSheet,
  SAFE_MARGIN,
} from '../../components/playback/PlaybackChrome';

/* === constants that stay local === */
const GREEN = '#16a34a';
const RED = '#dc2626';
const SKIP_SEC = 5;

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
  const overlayOn = overlayMode === 'all' || overlayMode === 'noBelt';
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

  // ✅ Player + timing extracted into hook
  const {
    player,
    now,
    dur,
    isPlaying,
    atVideoEnd,
    isScrubbing,
    setIsScrubbing,
    onSeek,
    onPlayPause,
    getLiveDuration,
  } = usePlaybackPlayer(videoPath);

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
          : e,
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

      const isAthleteActor = (e.actor === 'home' && homeIsAthlete) || (e.actor === 'opponent' && !homeIsAthlete);

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
    [homeIsAthlete, homeColorIsGreen],
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
              <Text style={{ color: 'white', fontWeight: '800' }}>{overlayLabel} ▾</Text>
            </Pressable>

            {/* Overlay mode menu */}
            <OverlayModeMenu
              visible={overlayMenuOpen && chromeVisible}
              mode={overlayMode}
              insets={insets as Insets}
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
                <Text style={{ color: '#fff', fontWeight: '900' }}>{isPlaying ? '❚❚ Pause' : '▶ Play'}</Text>
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
              insets={insets as Insets}
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
