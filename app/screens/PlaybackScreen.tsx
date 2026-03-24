
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSidecar } from '../../src/hooks/useLocalSidecar';
import { usePlaybackChrome } from '../../src/hooks/usePlaybackChrome';
import { usePlaybackPlayer } from '../../src/hooks/usePlaybackPlayer';
import { useShareSidecar } from '../../src/hooks/useShareSidecar';
import { useSkipTapZones } from '../../src/hooks/useSkipTapZones';
import useWebVideoController from '../../src/hooks/useWebVideoController';

import {
  EditModeMask,
  LoadingErrorOverlay,
  ReplayOverlay,
  SkipHudOverlay,
} from '../../components/playback/PlaybackOverlays';
import TopScrubber from '../../components/playback/TopScrubber';

import type { OverlayEvent } from '../../components/modules/types';
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

import * as PlaybackModuleRegistry from '../../components/modules/PlaybackModuleRegistry';

const GREEN = '#16a34a';
const RED = '#dc2626';
const SKIP_SEC = 5;

const isWeb = Platform.OS === 'web';

export default function PlaybackScreen() {
  const router = useRouter();
  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/library');
    }
  };

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
          onPress={handleBackPress}
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
    now: nativeNow,
    dur: nativeDur,
    isPlaying: nativeIsPlaying,
    atVideoEnd: nativeAtVideoEnd,
    setIsScrubbing,
    onSeek: seekInternal,
    onPlayPause: onPlayPauseInternal,
    getLiveDuration,
    loading,
    errorMsg,
    refreshSignedUrl,
    sidecarUrl,
    isReady,
    loadedSrc,
  } = usePlaybackPlayer(source);

  const videoKey = useMemo(() => {
    return videoPath ? `local:${videoPath}` : shareId ? `share:${shareId}` : 'none';
  }, [videoPath, shareId]);

  const {
    bindRef,
    webNow,
    webDur,
    webIsPlaying,
    seek: webSeek,
    playPause: webPlayPause,
    videoHandlers,
    webVideoRef,
  } = useWebVideoController();

  const now = isWeb ? webNow : nativeNow;
  const dur = isWeb ? webDur : nativeDur;
  const isPlaying = isWeb ? webIsPlaying : nativeIsPlaying;

  const atVideoEnd = useMemo(() => {
    if (!isWeb) return nativeAtVideoEnd;
    if (!dur) return false;
    return !webIsPlaying && Math.abs((webNow || 0) - dur) < 0.25;
  }, [dur, nativeAtVideoEnd, webIsPlaying, webNow]);

  const getDurationSafe = useCallback(() => {
    if (isWeb) return dur || 0;
    try {
      const D = typeof getLiveDuration === 'function' ? getLiveDuration() : dur || 0;
      return D || 0;
    } catch {
      return dur || 0;
    }
  }, [dur, getLiveDuration]);

  // ✅ Critical: DO NOT upper-clamp when duration is unknown (D<=0).
  const clampToDuration = useCallback(
    (sec: number) => {
      const D = getDurationSafe();
      const low = Math.max(0, sec);
      if (isFinite(D) && D > 0) return Math.min(D, low);
      return low;
    },
    [getDurationSafe],
  );

  // ---- time refs ----
  const desiredTimeRef = useRef<number>(0); // latest intended time from scrub/seek
  const lastUserSeekMsRef = useRef<number>(0);
  const isScrubbingRef = useRef<boolean>(false);

  // single source of truth for edit stamping
  const editAnchorTimeRef = useRef<number>(0);

  // unified seek (updates desired immediately)
  const onSeek = useCallback(
    (sec: number) => {
      const t = clampToDuration(sec);
      desiredTimeRef.current = t;
      lastUserSeekMsRef.current = Date.now();

      if (isWeb) {
        webSeek(t);
      } else {
        seekInternal(t);
      }
    },
    [clampToDuration, seekInternal, webSeek],
  );

  // preview time from scrubber drag (intent only)
  const onPreviewTime = useCallback(
    (sec: number) => {
      const t = clampToDuration(sec);
      desiredTimeRef.current = t;
      lastUserSeekMsRef.current = Date.now();
    },
    [clampToDuration],
  );

  const onPlayPause = useCallback(async () => {
    if (isWeb) {
      await webPlayPause();
      return;
    }
    await onPlayPauseInternal();
  }, [onPlayPauseInternal, webPlayPause]);

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

  const skipLeft5 = useCallback(() => {
    const t = clampToDuration((now || 0) - SKIP_SEC);
    onSeek(t);
    try {
      handleLeftTap?.();
    } catch {}
  }, [clampToDuration, handleLeftTap, now, onSeek]);

  const skipRight5 = useCallback(() => {
    const t = clampToDuration((now || 0) + SKIP_SEC);
    onSeek(t);
    try {
      handleRightTap?.();
    } catch {}
  }, [clampToDuration, handleRightTap, now, onSeek]);

  const { leftZoneProps, rightZoneProps, skipHUD: tapSkipHUD } = useSkipTapZones({
    chromeVisible,
    showChrome,
    onSkipLeft: skipLeft5,
    onSkipRight: skipRight5,
    onPlayPause,
    doubleTapMs: 280,
    singleTapShowsChrome: true,
    skipSeconds: 5,
    hudHoldMs: 650,
  } as any);

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
    const tPlayer = clampToDuration(now || 0);

    const msSinceSeek = Date.now() - (lastUserSeekMsRef.current || 0);
    const hasRecentSeek = msSinceSeek >= 0 && msSinceSeek < 2000;

    if (!hasRecentSeek) {
      desiredTimeRef.current = tPlayer;
    } else {
      desiredTimeRef.current = clampToDuration(desiredTimeRef.current || tPlayer);
    }

    editAnchorTimeRef.current = desiredTimeRef.current || tPlayer;

    // force player seek to anchor (no gating)
    onSeek(editAnchorTimeRef.current);

    // pause to reduce drift
    try {
      (player as any)?.pause?.();
    } catch {}
    try {
      webVideoRef.current?.pause?.();
    } catch {}

    setEditMode(true);
    setEditSubmode('add');
    setEditTargetId(null);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditSubmode(null);
    setEditTargetId(null);
    setQuickEditFor(null);
  };

  // ADD stamps at frozen editAnchorTimeRef while in edit mode
  // REPLACE keeps original pill timestamp
  const handleOverlayEventFromModule = (evt: OverlayEvent) => {
    const actor: Actor = toActor((evt as any).actor);
    const kind = String((evt as any).key ?? (evt as any).kind ?? 'unknown');
    const points = typeof (evt as any).value === 'number' ? (evt as any).value : undefined;

    const baseMeta = ((evt as any).meta ?? {}) as Record<string, any>;
    const label = (evt as any).label;
    const metaForRow = { ...(label ? { label } : {}), ...baseMeta };

    const tPlayer = clampToDuration(now || 0);
    const tEdit = clampToDuration(editAnchorTimeRef.current || 0);
    const tNow = editMode ? tEdit : tPlayer;

    const addAtTime = (t: number) => {
      const newEvt: EventRow = { _id: genId(), t, kind, points, actor, meta: metaForRow };
      const sorted = [...events, newEvt].sort((a, b) => a.t - b.t);
      const next: EventRow[] = accumulateEvents(sorted);
      setEvents(next);
      saveSidecar(next);
    };

    const replaceKeepingTime = (targetId: string) => {
      const target = events.find((e) => (e as any)._id === targetId);
      const tKeep = typeof (target as any)?.t === 'number' ? (target as any).t : tNow;

      const nextBase: EventRow[] = events.map((e) => {
        if ((e as any)._id !== targetId) return e;
        return {
          ...(e as any),
          _id: (e as any)._id,
          t: tKeep,
          kind,
          points,
          actor,
          meta: metaForRow,
          scoreAfter: undefined,
        } as EventRow;
      });

      const next: EventRow[] = accumulateEvents(nextBase.sort((a, b) => a.t - b.t));
      setEvents(next);
      saveSidecar(next);
    };

    if (editSubmode === 'add') {
      addAtTime(tNow);
      exitEditMode();
      return;
    }

    if (editSubmode === 'replace' && editTargetId) {
      replaceKeepingTime(editTargetId);
      exitEditMode();
      return;
    }

    // fallback (shouldn't usually happen)
    addAtTime(tNow);
  };

  const { Module: ModuleCmp } =
    PlaybackModuleRegistry.getPlaybackModule?.(effectiveSport, effectiveStyle) ?? { Module: null };

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

      const m = { ...inner, ...meta };

      const isHex = (v: any) => typeof v === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());
      const normalizeNamed = (raw: any): 'red' | 'blue' | 'green' | null => {
        if (!raw) return null;
        const v = String(raw).trim().toLowerCase();
        if (v === 'red') return 'red';
        if (v === 'blue') return 'blue';
        if (v === 'green') return 'green';
        return null;
      };
      const mapNamedToHex = (name: 'red' | 'blue' | 'green') => {
        if (name === 'green') return GREEN;
        if (name === 'red') return RED;
        return '#3b82f6';
      };

      const colorIsGreen = effectiveHomeColorIsGreen !== false;
      const athleteColorLegacy = colorIsGreen ? GREEN : RED;
      const opponentColorLegacy = colorIsGreen ? RED : GREEN;

      const athleteActor: 'home' | 'opponent' | null =
        m.athleteActor === 'home' || m.athleteActor === 'opponent' ? m.athleteActor : null;

      const myActor = effectiveHomeIsAthlete ? 'home' : 'opponent';
      const isAthleteActor = athleteActor ? e.actor === athleteActor : e.actor === myActor;

      if (isHex(m.athleteColor) || isHex(m.opponentColor)) {
        const aHex = isHex(m.athleteColor) ? m.athleteColor : null;
        const oHex = isHex(m.opponentColor) ? m.opponentColor : null;
        if (isAthleteActor && aHex) return aHex;
        if (!isAthleteActor && oHex) return oHex;
        if (aHex) return aHex;
        if (oHex) return oHex;
      }

      const mkName = normalizeNamed(m.myKidColor);
      const okName = normalizeNamed(m.opponentColor);
      if (mkName || okName) {
        const athleteColor = mkName ? mapNamedToHex(mkName) : athleteColorLegacy;
        const opponentColor = okName ? mapNamedToHex(okName) : opponentColorLegacy;
        return isAthleteActor ? athleteColor : opponentColor;
      }

      const metaSide = (v: any): 'home' | 'opponent' | null => {
        const s = String(v ?? '').trim().toLowerCase();
        if (!s) return null;
        if (s === 'home' || s === 'h') return 'home';
        if (s === 'opponent' || s === 'opp' || s === 'o') return 'opponent';
        return null;
      };

      const targeted =
        metaSide(m.for) ??
        metaSide(m.awardedTo) ??
        metaSide(m.scorer) ??
        metaSide(m.to) ??
        metaSide(m.offender) ??
        metaSide(m.penalized) ??
        metaSide(m.calledOn) ??
        null;

      const kind = String(e.kind || '').toLowerCase();
      const pts = typeof e.points === 'number' ? e.points : 0;

      if (targeted) {
        const isTargetAthlete = targeted === myActor;
        const athleteColor = athleteColorLegacy;
        const opponentColor = opponentColorLegacy;
        if (pts > 0) return isTargetAthlete ? athleteColor : opponentColor;
        if (PENALTYISH.has(kind)) return isTargetAthlete ? athleteColor : opponentColor;
      }

      if (pts > 0) return isAthleteActor ? athleteColorLegacy : opponentColorLegacy;
      if (PENALTYISH.has(kind)) return 'rgba(148,163,184,0.9)';
      return 'rgba(148,163,184,0.9)';
    },
    [effectiveHomeIsAthlete, effectiveHomeColorIsGreen],
  );

  const skipHudMaxWidth = Math.max(140, screenW - (insets.left + insets.right + SAFE_MARGIN * 2 + 24 * 2));

  const handlePlayPress = async () => {
    showChrome();
    await onPlayPause();
  };

  const shouldMountVideoView = isWeb ? isReady : true;
  const beltBlock = showEventBelt ? BELT_H + insets.bottom : 0;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1 }}>
        {shouldMountVideoView ? (
          isWeb ? (
            <View style={{ flex: 1, backgroundColor: 'black' }}>
              <video
                key={videoKey}
                ref={bindRef}
                src={loadedSrc || undefined}
                playsInline
                controls={false}
                muted={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }}
                {...(videoHandlers as any)}
              />
            </View>
          ) : (
            <VideoView
              key={videoKey}
              player={player}
              style={{ flex: 1 }}
              allowsFullscreen
              allowsPictureInPicture
              nativeControls={false}
              contentFit="contain"
            />
          )
        ) : (
          <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800' }}>Loading video…</Text>
          </View>
        )}

        <Pressable
          onPress={showChrome}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: beltBlock }}
          pointerEvents={chromeVisible ? 'none' : 'auto'}
        />

        <LoadingErrorOverlay
          visible={!!errorMsg || !!loading}
          loading={!!loading}
          errorMsg={errorMsg ?? ''}
          onBack={handleBackPress}
          onRetry={refreshSignedUrl}
        />

        <SkipHudOverlay
          visible={!!tapSkipHUD}
          side={(tapSkipHUD as any)?.side ?? 'left'}
          total={(tapSkipHUD as any)?.total ?? 0}
          insets={{ left: insets.left, right: insets.right }}
          safeMargin={SAFE_MARGIN}
          maxWidth={skipHudMaxWidth}
        />

        <ReplayOverlay
          visible={atVideoEnd && !editMode}
          onReplay={async () => {
            onSeek(0);
            await onPlayPause();
          }}
        />

        {!editMode && (
          <>
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: SCRUB_RESERVED_TOP,
                bottom: tapZoneBottomGap,
                flexDirection: 'row',
                zIndex: 5,
                elevation: 5,
              }}
              pointerEvents="box-none"
            >
              <Pressable style={{ flex: 1 }} {...(leftZoneProps as any)} />
              <Pressable style={{ flex: 1 }} {...(rightZoneProps as any)} />
            </View>

            <Pressable
              onPress={handleBackPress}
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
                zIndex: 10,
              }}
              pointerEvents={chromeVisible ? 'auto' : 'none'}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>‹ Back</Text>
            </Pressable>

            <Pressable
              onPress={() => setOverlayMenuOpen((v) => !v)}
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
                zIndex: 10,
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
              onSelect={(m) => {
                setOverlayMode(m);
                setOverlayMenuOpen(false);
              }}
            />

            {chromeVisible && (
              <TopScrubber
                current={now}
                duration={dur}
                onSeek={(t) => {
                  onSeek(t);
                  showChrome();
                }}
                onPreviewTime={onPreviewTime}
                insets={insets}
                visible={true}
                onInteracting={(v) => {
                  isScrubbingRef.current = v;
                  setIsScrubbing(v);
                }}
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
                  zIndex: 10,
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
                  zIndex: 10,
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
                onPillLongPress={(ev) => setQuickEditFor(ev)}
              />
            )}

            <QuickEditSheet
              visible={!!quickEditFor}
              event={quickEditFor}
              insets={insets as Insets}
              onCancel={() => setQuickEditFor(null)}
              onDelete={() => {
                if (!quickEditFor) return;
                const next = events.filter((e) => e._id !== quickEditFor._id);
                const ordered = [...next].sort((a, b) => a.t - b.t);
                const withScores = accumulateEvents(ordered);
                setEvents(withScores);
                saveSidecar(withScores);
                setQuickEditFor(null);
              }}
              onReplace={() => {
                if (!quickEditFor) return;
                const id = quickEditFor._id;
                const tKeep = quickEditFor.t;

                setQuickEditFor(null);
                if (!id) return;

                editAnchorTimeRef.current = clampToDuration(tKeep);
                onSeek(editAnchorTimeRef.current);

                try {
                  (player as any)?.pause?.();
                } catch {}
                try {
                  webVideoRef.current?.pause?.();
                } catch {}

                setEditMode(true);
                setEditSubmode('replace');
                setEditTargetId(id);
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
            onPillLongPress={(ev) => setQuickEditFor(ev)}
            liveScore={liveScore}
            finalScore={effectiveFinalScore}
            editMode={editMode}
            editSubmode={editSubmode}
            athleteName={displayAthlete}
          />
        ) : null}

        <EditModeMask visible={editMode} bottomInset={insets.bottom} onExit={exitEditMode} />
      </View>
    </GestureHandlerRootView>
  );
}