// app/screens/PlaybackScreen.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ extracted player hook
import { usePlaybackPlayer } from '../../src/hooks/usePlaybackPlayer';

// ✅ extracted local sidecar hook
import { useLocalSidecar } from '../../src/hooks/useLocalSidecar';

// ✅ extracted chrome/tap/skip logic hook
import { usePlaybackChrome } from '../../src/hooks/usePlaybackChrome';

// === Module registry (add your modules here)
import BaseballHittingPlaybackModule from '../../components/modules/baseball/BaseballHittingPlaybackModule';
import WrestlingFolkstylePlaybackModule from '../../components/modules/wrestling/WrestlingFolkstylePlaybackModule';
import TopScrubber from '../../components/playback/TopScrubber';

import type { OverlayEvent, PlaybackModuleProps } from '../../components/modules/types';

// 🔹 shared core helpers/types
import { Actor, EventRow, PENALTYISH, toActor } from '../../components/playback/playbackCore';

// 🔹 UI helpers extracted to separate file
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
  const { width: screenW } = useWindowDimensions();

  // ==================== Params (typed + safe) ====================
  type PlaybackParams = {
    videoPath?: string;
    shareId?: string;
    athlete?: string;
  };

  const { videoPath: rawVideoPath, shareId: rawShareId, athlete: athleteParam } =
    useLocalSearchParams<PlaybackParams>();

  const shareId =
    typeof rawShareId === 'string' ? rawShareId : Array.isArray(rawShareId) ? rawShareId[0] : undefined;

  const videoPath =
    typeof rawVideoPath === 'string' ? rawVideoPath : Array.isArray(rawVideoPath) ? rawVideoPath[0] : undefined;

  const athleteParamStr =
    typeof athleteParam === 'string' ? athleteParam : Array.isArray(athleteParam) ? athleteParam[0] : '';

  const hasSource = !!videoPath || !!shareId;

  // ✅ Guard: never crash on missing params
  if (!hasSource) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, marginBottom: 8 }}>Nothing to play</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 14 }}>
          This screen needs either a local videoPath or a cloud shareId.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ==================== Overlay mode ====================
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('all');
  const [overlayMenuOpen, setOverlayMenuOpen] = useState(false);

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

  // ==================== Edit state ====================
  const [editMode, setEditMode] = useState(false);
  const [editSubmode, setEditSubmode] = useState<'add' | 'replace' | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [quickEditFor, setQuickEditFor] = useState<EventRow | null>(null);

  // ==================== Playback source contract ====================
  // Guard above ensures one exists.
  const source = videoPath ? { videoPath } : { shareId: shareId! };

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
  } = usePlaybackPlayer(source);

  // ✅ Local sidecar (still keyed by both; handles whichever exists)
  const {
    events,
    setEvents,
    finalScore,
    debugMsg,
    athleteName,
    sport,
    style,
    homeIsAthlete,
    homeColorIsGreen,
    saveSidecar,
    accumulate: accumulateEvents,
  } = useLocalSidecar({
    videoPath: videoPath ?? '',
    shareId,
  });
  

  const displayAthlete = athleteParamStr?.trim() || athleteName;

  // ✅ chrome + tap zones + skip HUD
  const {
    chromeVisible,
    showChrome,
    skipHUD,
    handleLeftTap,
    handleRightTap,
    SCRUB_RESERVED_TOP,
    tapZoneBottomGap,
  } = usePlaybackChrome({
    now: now || 0,
    isPlaying,
    editMode,
    showEventBelt,
    insets,
    beltHeight: BELT_H,
    safeMargin: SAFE_MARGIN,
    skipSeconds: SKIP_SEC,
    onSeek,
  });

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

  // editing from modules
  const genId = () => Math.random().toString(36).slice(2, 9);

  const enterAddMode = () => {
    setEditMode(true);
    setEditSubmode('add');
    setEditTargetId(null);
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

    const baseMeta = ((evt as any).meta ?? {}) as Record<string, any>;
    const label = (evt as any).label;
    const metaForRow = {
      ...(label ? { label } : {}),
      ...baseMeta,
    };

    const tNow = Math.max(0, Math.min(getLiveDuration(), now || 0));

    if (editSubmode === 'add') {
      const newEvt: EventRow = { _id: genId(), t: tNow, kind, points, actor, meta: metaForRow };
      const next: EventRow[] = accumulateEvents([...events, newEvt].sort((a, b) => a.t - b.t));
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
      const next: EventRow[] = accumulateEvents(nextBase.sort((a, b) => a.t - b.t));
      setEvents(next);
      saveSidecar(next);
      exitEditMode();
      return;
    }

    const newEvt: EventRow = { _id: genId(), t: tNow, kind, points, actor, meta: metaForRow };
    const next: EventRow[] = accumulateEvents([...events, newEvt].sort((a, b) => a.t - b.t));
    setEvents(next);
    saveSidecar(next);
  };

  // Module resolve
  const moduleKey = `${(sport || '').toLowerCase()}:${(style || 'default').toLowerCase()}`;
  const ModuleCmp = ModuleRegistry[moduleKey];

  // Color mapping for belt
  const colorForPill = useCallback(
    (e: EventRow) => {
      const meta = (e.meta ?? {}) as any;
      const inner = (meta.meta ?? {}) as any;

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

      if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit;

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

      if (mk || ok) {
        if (isAthleteActor && mk) return mk;
        if (!isAthleteActor && ok) return ok;
      }

      const colorIsGreen = homeColorIsGreen !== false;
      const athleteColor = colorIsGreen ? GREEN : RED;
      const opponentColor = colorIsGreen ? RED : GREEN;

      const kind = String(e.kind || '').toLowerCase();
      const pts = typeof e.points === 'number' ? e.points : 0;

      if (pts > 0) return isAthleteActor ? athleteColor : opponentColor;
      if (PENALTYISH.has(kind)) return opponentColor;

      return 'rgba(148,163,184,0.9)';
    },
    [homeIsAthlete, homeColorIsGreen],
  );

  // --- Skip HUD bounds (fixes landscape off-screen) ---
  const skipHudMaxWidth = Math.max(140, screenW - (insets.left + insets.right + SAFE_MARGIN * 2 + 24 * 2));

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

        {/* Skip HUD (double-tap indicator) */}
        {!!skipHUD && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '45%',
              left: skipHUD.side === 'left' ? insets.left + SAFE_MARGIN : undefined,
              right: skipHUD.side === 'right' ? insets.right + SAFE_MARGIN : undefined,
              maxWidth: skipHudMaxWidth,
              alignSelf: 'flex-start',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              zIndex: 60,
            }}
          >
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
              {skipHUD.side === 'left' ? `⟲  -${skipHUD.total}s` : `+${skipHUD.total}s  ⟳`}
            </Text>
          </View>
        )}

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
                const next = events.filter(e => e._id !== quickEditFor._id);
                const ordered = [...next].sort((a, b) => a.t - b.t);
                const withScores = accumulateEvents(ordered);
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
              onPress={exitEditMode}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 24,
                alignItems: 'center',
              }}
            >
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f59e0b' }}>
                <Text style={{ color: '#111', fontWeight: '900' }}>Tap to exit Edit/Add</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* optional debug text */}
        {!!debugMsg && (
          <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{debugMsg}</Text>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
