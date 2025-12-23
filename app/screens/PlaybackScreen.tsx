// app/screens/PlaybackScreen.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSidecar } from '../../src/hooks/useLocalSidecar';
import { usePlaybackChrome } from '../../src/hooks/usePlaybackChrome';
import { usePlaybackPlayer } from '../../src/hooks/usePlaybackPlayer';
import { useShareSidecar } from '../../src/hooks/useShareSidecar';

import {
  EditModeMask,
  LoadingErrorOverlay,
  ReplayOverlay,
  SkipHudOverlay,
} from '../../components/playback/PlaybackOverlays';

import BaseballHittingPlaybackModule from '../../components/modules/baseball/BaseballHittingPlaybackModule';
import WrestlingFolkstylePlaybackModule from '../../components/modules/wrestling/WrestlingFolkstylePlaybackModule';
import TopScrubber from '../../components/playback/TopScrubber';

import type { OverlayEvent, PlaybackModuleProps } from '../../components/modules/types';

import { Actor, EventRow, PENALTYISH, toActor } from '../../components/playback/playbackCore';

import {
  BELT_H,
  EventBelt,
  Insets,
  OverlayMode,
  OverlayModeMenu,
  QuickEditSheet,
  SAFE_MARGIN,
} from '../../components/playback/PlaybackChrome';

const GREEN = '#16a34a';
const RED = '#dc2626';
const SKIP_SEC = 5;

const ModuleRegistry: Record<string, React.ComponentType<PlaybackModuleProps>> = {
  'wrestling:folkstyle': WrestlingFolkstylePlaybackModule,
  'baseball:hitting': BaseballHittingPlaybackModule,
};

const isWeb = Platform.OS === 'web';

export default function PlaybackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

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

  const [editMode, setEditMode] = useState(false);
  const [editSubmode, setEditSubmode] = useState<'add' | 'replace' | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [quickEditFor, setQuickEditFor] = useState<EventRow | null>(null);

  const source = videoPath ? { videoPath } : { shareId: shareId! };

  const {
    player,
    now,
    dur,
    isPlaying,
    atVideoEnd,
    setIsScrubbing,
    onSeek,
    onPlayPause,
    getLiveDuration,
    loading,
    errorMsg,
    refreshSignedUrl,
    sidecarUrl,
    isReady,
  } = usePlaybackPlayer(source);

  // ✅ Force-remount VideoView when source changes (helps some web cases)
  const videoKey = useMemo(() => {
    return videoPath ? `local:${videoPath}` : shareId ? `share:${shareId}` : 'none';
  }, [videoPath, shareId]);

  const {
    events,
    setEvents,
    finalScore,
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

  const { shareMeta } = useShareSidecar({
    shareId,
    sidecarUrl,
    accumulateEvents,
    setEvents,
  });

  const effectiveSport = shareId ? (shareMeta.sport ?? sport) : sport;
  const effectiveStyle = shareId ? (shareMeta.style ?? style) : style;
  const effectiveAthleteName = shareId ? (shareMeta.athleteName ?? athleteName) : athleteName;

  const effectiveHomeIsAthlete =
    shareId && typeof shareMeta.homeIsAthlete === 'boolean' ? shareMeta.homeIsAthlete : homeIsAthlete;

  const effectiveHomeColorIsGreen =
    shareId && typeof shareMeta.homeColorIsGreen === 'boolean' ? shareMeta.homeColorIsGreen : homeColorIsGreen;

  const effectiveFinalScore = shareId ? (shareMeta.finalScore ?? finalScore) : finalScore;

  const displayAthlete = athleteParamStr?.trim() || effectiveAthleteName;

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

  const liveScore = useMemo(() => {
    if (!events.length) return { home: 0, opponent: 0 };
    let s = { home: 0, opponent: 0 };
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.t <= (now || 0)) s = e.scoreAfter ?? s;
      else break;
    }
    return s;
  }, [events, now]);

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
    const metaForRow = { ...(label ? { label } : {}), ...baseMeta };

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
        e._id === editTargetId ? ({ ...e, t: tNow, kind, points, actor, meta: metaForRow } as EventRow) : e,
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

  const moduleKey = `${String(effectiveSport || '').toLowerCase()}:${String(effectiveStyle || 'default').toLowerCase()}`;
  const ModuleCmp = ModuleRegistry[moduleKey];

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

      const isAthleteActor =
        (e.actor === 'home' && effectiveHomeIsAthlete) || (e.actor === 'opponent' && !effectiveHomeIsAthlete);

      if (mk || ok) {
        if (isAthleteActor && mk) return mk;
        if (!isAthleteActor && ok) return ok;
      }

      const colorIsGreen = effectiveHomeColorIsGreen !== false;
      const athleteColor = colorIsGreen ? GREEN : RED;
      const opponentColor = colorIsGreen ? RED : GREEN;

      const kind = String(e.kind || '').toLowerCase();
      const pts = typeof e.points === 'number' ? e.points : 0;

      if (pts > 0) return isAthleteActor ? athleteColor : opponentColor;
      if (PENALTYISH.has(kind)) return opponentColor;

      return 'rgba(148,163,184,0.9)';
    },
    [effectiveHomeIsAthlete, effectiveHomeColorIsGreen],
  );

  const skipHudMaxWidth = Math.max(140, screenW - (insets.left + insets.right + SAFE_MARGIN * 2 + 24 * 2));

  const handlePlayPress = async () => {
    showChrome();
    await onPlayPause();
  };

  // ✅ WEB gating: never mount VideoView until isReady === true (prevents src="").
  const shouldMountVideoView = isWeb ? isReady : true;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1 }}>
        {shouldMountVideoView ? (
          <VideoView
            key={videoKey}
            player={player}
            style={{ flex: 1 }}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls={false}
            contentFit="contain"
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800' }}>
              Loading video…
            </Text>
          </View>
        )}

        {/* Tap anywhere to reveal chrome. Only active when chrome hidden so it never steals taps. */}
        <Pressable
          onPress={showChrome}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          pointerEvents={chromeVisible ? 'none' : 'auto'}
        />

        <LoadingErrorOverlay
          visible={!!errorMsg || !!loading}
          loading={!!loading}
          errorMsg={errorMsg ?? ''}
          onBack={() => router.back()}
          onRetry={refreshSignedUrl}
        />

        <SkipHudOverlay
          visible={!!skipHUD}
          side={skipHUD?.side ?? 'left'}
          total={skipHUD?.total ?? 0}
          insets={{ left: insets.left, right: insets.right }}
          safeMargin={SAFE_MARGIN}
          maxWidth={skipHudMaxWidth}
        />

        <ReplayOverlay
          visible={atVideoEnd && !editMode}
          onReplay={async () => {
            onSeek(0);
            await onPlayPause(); // user gesture qualifies
          }}
        />

        {!editMode && (
          <>
            {/* Left/right tap zones for skip. Disable when chrome visible so buttons are clickable. */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: SCRUB_RESERVED_TOP,
                bottom: tapZoneBottomGap,
                flexDirection: 'row',
              }}
              pointerEvents={chromeVisible ? 'none' : 'box-none'}
            >
              <Pressable onPress={handleLeftTap} style={{ flex: 1 }} />
              <Pressable onPress={handleRightTap} style={{ flex: 1 }} />
            </View>

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

            {!atVideoEnd && (
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

            {!atVideoEnd && (
              <Pressable
                onPress={handlePlayPress}
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

        {ModuleCmp ? (
          <ModuleCmp
            now={now}
            duration={dur}
            events={events}
            homeIsAthlete={effectiveHomeIsAthlete}
            homeColorIsGreen={effectiveHomeColorIsGreen}
            overlayOn={overlayOn}
            insets={insets}
            onSeek={onSeek}
            onPlayPause={onPlayPause}
            isPlaying={isPlaying}
            enterAddMode={enterAddMode}
            onOverlayEvent={handleOverlayEventFromModule}
            onPillLongPress={ev => setQuickEditFor(ev)}
            liveScore={liveScore}
            finalScore={effectiveFinalScore}
            editMode={editMode}
            editSubmode={editSubmode}
            athleteName={displayAthlete}
          />
        ) : null}

        {isWeb && chromeVisible && (
          <View
            style={{
              position: 'absolute',
              left: insets.left + SAFE_MARGIN,
              right: insets.right + SAFE_MARGIN,
              bottom: insets.bottom + (showEventBelt ? BELT_H + SAFE_MARGIN * 2 : SAFE_MARGIN * 2),
              alignItems: 'center',
              opacity: 0.9,
            }}
            pointerEvents="none"
          >
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
              If audio is silent on web, it’s CORS from B2 (needs bucket CORS config).
            </Text>
          </View>
        )}

        <EditModeMask visible={editMode} bottomInset={insets.bottom} onExit={exitEditMode} />
      </View>
    </GestureHandlerRootView>
  );
}
