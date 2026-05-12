import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSidecar } from '../../src/hooks/useLocalSidecar';
import { usePlaybackChrome } from '../../src/hooks/usePlaybackChrome';
import { usePlaybackOrientationFix } from '../../src/hooks/usePlaybackOrientationFix';
import { usePlaybackPlayer } from '../../src/hooks/usePlaybackPlayer';
import { useShareSidecar } from '../../src/hooks/useShareSidecar';
import { useSkipTapZones } from '../../src/hooks/useSkipTapZones';
import useWebVideoController from '../../src/hooks/useWebVideoController';

import AvReviewPlayer, {
  type AvReviewPlayerHandle,
} from '../../components/playback/AvReviewPlayer';
import FrameStepControls from '../../components/playback/FrameStepControls';
import {
  EditModeMask,
  LoadingErrorOverlay,
  ReplayOverlay,
  SkipHudOverlay,
} from '../../components/playback/PlaybackOverlays';
import PlaybackSpeedControl, {
  type PlaybackRate,
} from '../../components/playback/PlaybackSpeedControl';
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
const FRAME_NUDGE_SEC = 0.05;
const JOG_RATE = 0.15;

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
  const { width: screenW, height: screenH } = useWindowDimensions();

  type PlaybackParams = {
    videoPath?: string;
    shareId?: string;
    athlete?: string;
  };

  const { videoPath: rawVideoPath, shareId: rawShareId, athlete: athleteParam } =
    useLocalSearchParams<PlaybackParams>();

  const shareId =
    typeof rawShareId === 'string'
      ? rawShareId
      : Array.isArray(rawShareId)
        ? rawShareId[0]
        : undefined;

  const videoPath =
    typeof rawVideoPath === 'string'
      ? rawVideoPath
      : Array.isArray(rawVideoPath)
        ? rawVideoPath[0]
        : undefined;

  const athleteParamStr =
    typeof athleteParam === 'string'
      ? athleteParam
      : Array.isArray(athleteParam)
        ? athleteParam[0]
        : '';

  const hasSource = !!videoPath || !!shareId;

  if (!hasSource) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text allowFontScaling={false} numberOfLines={1} style={{ color: 'white', fontWeight: '900', fontSize: 18, marginBottom: 8 }}>
          Nothing to play
        </Text>
        <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 14 }}>
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
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: 'white', fontWeight: '900' }}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const [overlayMode, setOverlayMode] = useState<OverlayMode>('all');
  const [overlayMenuOpen, setOverlayMenuOpen] = useState(false);

  const overlayOn = overlayMode === 'all' || overlayMode === 'noBelt';
  const showEventBelt = overlayMode === 'all' || overlayMode === 'noScore';

  const [editMode, setEditMode] = useState(false);
  const [editSubmode, setEditSubmode] = useState<'add' | 'replace' | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [quickEditFor, setQuickEditFor] = useState<EventRow | null>(null);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [frameStepping, setFrameStepping] = useState(false);

  const avReviewRef = useRef<AvReviewPlayerHandle | null>(null);
  const [avNow, setAvNow] = useState(0);
  const [avDur, setAvDur] = useState(0);
  const [avIsPlaying, setAvIsPlaying] = useState(false);

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

  const avUri = videoPath ?? loadedSrc;
  const useAvReviewPlayer = Platform.OS === 'ios' && !!avUri;

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

  const now = useAvReviewPlayer ? avNow : isWeb ? webNow : nativeNow;
  const dur = useAvReviewPlayer ? avDur : isWeb ? webDur : nativeDur;
  const isPlaying = useAvReviewPlayer ? avIsPlaying : isWeb ? webIsPlaying : nativeIsPlaying;

  const atVideoEnd = useMemo(() => {
    if (useAvReviewPlayer) {
      return !avIsPlaying && avDur > 0 && Math.abs((avNow || 0) - avDur) < 0.25;
    }

    if (!isWeb) return nativeAtVideoEnd;
    if (!dur) return false;
    return !webIsPlaying && Math.abs((webNow || 0) - dur) < 0.25;
  }, [avDur, avIsPlaying, avNow, dur, nativeAtVideoEnd, useAvReviewPlayer, webIsPlaying, webNow]);

  const getDurationSafe = useCallback(() => {
    if (useAvReviewPlayer) return avDur || 0;
    if (isWeb) return dur || 0;

    try {
      const D = typeof getLiveDuration === 'function' ? getLiveDuration() : dur || 0;
      return D || 0;
    } catch {
      return dur || 0;
    }
  }, [avDur, dur, getLiveDuration, useAvReviewPlayer]);

  const clampToDuration = useCallback(
    (sec: number) => {
      const D = getDurationSafe();
      const low = Math.max(0, sec);
      if (isFinite(D) && D > 0) return Math.min(D, low);
      return low;
    },
    [getDurationSafe],
  );

  const desiredTimeRef = useRef<number>(0);
  const lastUserSeekMsRef = useRef<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const editAnchorTimeRef = useRef<number>(0);

  const exitFrameMode = useCallback(() => {
    setFrameStepping(false);

    try {
      if (useAvReviewPlayer) {
        return;
      }

      if (isWeb) {
        const video = webVideoRef.current;
        if (video) video.playbackRate = playbackRate;
      } else {
        (player as any).playbackRate = playbackRate;
      }
    } catch {}
  }, [player, playbackRate, useAvReviewPlayer, webVideoRef]);

  const onSeek = useCallback(
    (sec: number) => {
      const t = clampToDuration(sec);
      desiredTimeRef.current = t;
      lastUserSeekMsRef.current = Date.now();

      if (useAvReviewPlayer) {
        avReviewRef.current?.seekTo(t);
        return;
      }

      if (isWeb) webSeek(t);
      else seekInternal(t);
    },
    [clampToDuration, seekInternal, useAvReviewPlayer, webSeek],
  );

  const onPreviewTime = useCallback(
    (sec: number) => {
      const t = clampToDuration(sec);
      desiredTimeRef.current = t;
      lastUserSeekMsRef.current = Date.now();
    },
    [clampToDuration],
  );

  const onPlayPause = useCallback(async () => {
    if (useAvReviewPlayer) {
      await avReviewRef.current?.playPause();
      return;
    }

    if (isWeb) {
      await webPlayPause();
      return;
    }

    await onPlayPauseInternal();
  }, [onPlayPauseInternal, useAvReviewPlayer, webPlayPause]);

  const {
    events,
    setEvents,
    finalScore,
    athleteName,
    sport,
    style,
    homeIsAthlete,
    homeColorIsGreen,
    orientationOverride,
    saveSidecar,
    persistOrientationOverride,
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

  const effectiveOrientationOverride =
    shareId && typeof shareMeta.orientationOverride === 'number'
      ? shareMeta.orientationOverride
      : orientationOverride;

  const displayAthlete = athleteParamStr?.trim() || effectiveAthleteName;

  const {
    canEditOrientation,
    rotationLabel,
    dirty: orientationDirty,
    isSaving: orientationSaving,
    rotateLeft,
    rotateRight,
    reset: resetOrientation,
    revert: revertOrientation,
    save: saveOrientation,
    videoStageStyle,
    videoSurfaceStyle,
    webVideoSurfaceStyle,
  } = usePlaybackOrientationFix({
    persistedOrientation: effectiveOrientationOverride,
    viewportWidth: screenW,
    viewportHeight: screenH,
    shareId,
    persistOrientationOverride,
  });

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

  const applyPlaybackRate = useCallback(
    (rate: PlaybackRate) => {
      setPlaybackRate(rate);

      try {
        if (useAvReviewPlayer) {
          showChrome();
          return;
        }

        if (isWeb) {
          const video = webVideoRef.current;
          if (video) video.playbackRate = rate;
        } else {
          (player as any).playbackRate = rate;
          (player as any).preservesPitch = true;
        }
      } catch (e) {
        console.log('[playback] failed to set playback rate', e);
      }

      setFrameStepping(false);
      showChrome();
    },
    [player, showChrome, useAvReviewPlayer, webVideoRef],
  );

  const onFrameNudge = useCallback(
    async (direction: -1 | 1) => {
      const fallbackNow = typeof now === 'number' && isFinite(now) ? now : 0;
      const base =
  frameStepping && desiredTimeRef.current > 0
    ? desiredTimeRef.current
    : fallbackNow;
      const next = clampToDuration(base + direction * FRAME_NUDGE_SEC);

      setFrameStepping(true);
      setOverlayMenuOpen(false);

      desiredTimeRef.current = next;
      lastUserSeekMsRef.current = Date.now();

      try {
        if (useAvReviewPlayer) {
          await avReviewRef.current?.seekTo(next);
        } else if (isWeb) {
          const video = webVideoRef.current;
          if (video) {
            video.pause?.();
            video.currentTime = next;
          }
        } else {
          (player as any)?.pause?.();
          (player as any).currentTime = next;
          seekInternal(next);
        }
      } catch (e) {
        console.log('[frame-nudge] failed', e);
        onSeek(next);
      }

      showChrome();
    },
    [clampToDuration, frameStepping, now, onSeek, player, seekInternal, showChrome, useAvReviewPlayer, webVideoRef],
  );

  const onFrameJogForwardStart = useCallback(async () => {
    setFrameStepping(true);
    setOverlayMenuOpen(false);
    showChrome();

    try {
      if (useAvReviewPlayer) {
        await avReviewRef.current?.playPause();
        return;
      }

      if (isWeb) {
        const video = webVideoRef.current;
        if (video) {
          video.playbackRate = JOG_RATE;
          video.play?.();
        }
      } else {
        (player as any).playbackRate = JOG_RATE;
        (player as any).preservesPitch = true;
        (player as any)?.play?.();
      }
    } catch (e) {
      console.log('[frame-jog] failed to start', e);
    }
  }, [player, showChrome, useAvReviewPlayer, webVideoRef]);

  const onFrameJogStop = useCallback(async () => {
    try {
      if (useAvReviewPlayer) {
        await avReviewRef.current?.pause();
        desiredTimeRef.current = now || desiredTimeRef.current || 0;
        showChrome();
        return;
      }

      if (isWeb) {
        const video = webVideoRef.current;
        if (video) {
          video.pause?.();
          video.playbackRate = playbackRate;
          desiredTimeRef.current = clampToDuration(video.currentTime || now || 0);
        }
      } else {
        (player as any)?.pause?.();
        (player as any).playbackRate = playbackRate;

        const current = (player as any)?.currentTime;
        desiredTimeRef.current = clampToDuration(
          typeof current === 'number' ? current : now || desiredTimeRef.current || 0,
        );
      }
    } catch (e) {
      console.log('[frame-jog] failed to stop', e);
    }

    lastUserSeekMsRef.current = Date.now();
    showChrome();
  }, [clampToDuration, now, playbackRate, player, showChrome, useAvReviewPlayer, webVideoRef]);

  const skipLeft5 = useCallback(() => {
    const t = clampToDuration((now || 0) - SKIP_SEC);
    exitFrameMode();
    onSeek(t);
    try {
      handleLeftTap?.();
    } catch {}
  }, [clampToDuration, exitFrameMode, handleLeftTap, now, onSeek]);

  const skipRight5 = useCallback(() => {
    const t = clampToDuration((now || 0) + SKIP_SEC);
    exitFrameMode();
    onSeek(t);
    try {
      handleRightTap?.();
    } catch {}
  }, [clampToDuration, exitFrameMode, handleRightTap, now, onSeek]);

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
    exitFrameMode();

    const tPlayer = clampToDuration(now || 0);
    const msSinceSeek = Date.now() - (lastUserSeekMsRef.current || 0);
    const hasRecentSeek = msSinceSeek >= 0 && msSinceSeek < 2000;

    if (!hasRecentSeek) desiredTimeRef.current = tPlayer;
    else desiredTimeRef.current = clampToDuration(desiredTimeRef.current || tPlayer);

    editAnchorTimeRef.current = desiredTimeRef.current || tPlayer;
    onSeek(editAnchorTimeRef.current);

    try {
      if (useAvReviewPlayer) {
        avReviewRef.current?.pause();
      } else {
        (player as any)?.pause?.();
      }
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

      const kind = String(e.kind || '').toLowerCase();
      const pts = typeof e.points === 'number' ? e.points : 0;

      if (pts > 0) return isAthleteActor ? athleteColorLegacy : opponentColorLegacy;
      if (PENALTYISH.has(kind)) return 'rgba(148,163,184,0.9)';
      return 'rgba(148,163,184,0.9)';
    },
    [effectiveHomeIsAthlete, effectiveHomeColorIsGreen],
  );

  const skipHudMaxWidth = Math.max(140, screenW - (insets.left + insets.right + SAFE_MARGIN * 2 + 24 * 2));

  const handlePlayPress = async () => {
    setFrameStepping(false);
    showChrome();

    if (useAvReviewPlayer) {
      await avReviewRef.current?.playPause();
      return;
    }

    const t = clampToDuration(desiredTimeRef.current || now || 0);

    if (!isWeb && frameStepping) {
      try {
        (player as any).currentTime = t;
      } catch {}
      seekInternal(t);
    }

    try {
      if (isWeb) {
        const video = webVideoRef.current;
        if (video) video.playbackRate = playbackRate;
      } else {
        (player as any).playbackRate = playbackRate;
      }
    } catch {}

    await onPlayPause();
  };

  const shouldMountVideoView = useAvReviewPlayer ? true : isWeb ? isReady : true;
  const beltBlock = showEventBelt ? BELT_H + insets.bottom : 0;

  const bottomControlsOffset =
    insets.bottom + (showEventBelt ? BELT_H + SAFE_MARGIN : SAFE_MARGIN);

  const showFrameStepControls =
    chromeVisible && !isPlaying && !editMode && !atVideoEnd;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1 }}>
        {shouldMountVideoView ? (
          <View style={{ flex: 1, backgroundColor: 'black', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <View style={videoStageStyle}>
              {useAvReviewPlayer && avUri ? (
                <AvReviewPlayer
                  ref={avReviewRef}
                  uri={avUri}
                  style={videoSurfaceStyle}
                  onTimeUpdate={(sec, duration, playing) => {
                    setAvNow(sec);
                    setAvDur(duration);
                    setAvIsPlaying(playing);
                  }}
                />
              ) : isWeb ? (
                <video
                  key={videoKey}
                  ref={bindRef}
                  src={loadedSrc || undefined}
                  playsInline
                  autoPlay
                  muted
                  controls={false}
                  style={webVideoSurfaceStyle as any}
                  {...(videoHandlers as any)}
                />
              ) : (
                <VideoView
                  key={videoKey}
                  player={player}
                  style={videoSurfaceStyle}
                  allowsFullscreen
                  allowsPictureInPicture
                  nativeControls={false}
                  contentFit="contain"
                  {...(Platform.OS === 'android' ? ({ surfaceType: 'textureView' } as any) : {})}
                />
              )}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
            <Text allowFontScaling={false} numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800' }}>
              Loading video…
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            exitFrameMode();
            showChrome();
          }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: beltBlock }}
          pointerEvents={chromeVisible ? 'none' : 'auto'}
        />

        <LoadingErrorOverlay
          visible={!useAvReviewPlayer && (!!errorMsg || !!loading)}
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
            exitFrameMode();
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
              <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: 'white', fontWeight: '800' }}>
                ‹ Back
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                exitFrameMode();
                showChrome();
                setOverlayMenuOpen((v) => !v);
              }}
              style={{
                position: 'absolute',
                top: insets.top + SAFE_MARGIN,
                right: insets.right + SAFE_MARGIN,
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
                opacity: chromeVisible ? 1 : 0,
                zIndex: 10,
              }}
              pointerEvents={chromeVisible ? 'auto' : 'none'}
            >
              <Text allowFontScaling={false} numberOfLines={1} style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
                ⚙
              </Text>
            </Pressable>

            <OverlayModeMenu
              visible={overlayMenuOpen}
              mode={overlayMode}
              insets={insets as Insets}
              onClose={() => setOverlayMenuOpen(false)}
              onSelect={(m) => {
                setOverlayMode(m);
              }}
              extraContent={
                <View>
                  <PlaybackSpeedControl
                    value={playbackRate}
                    onChange={applyPlaybackRate}
                  />
                </View>
              }
              canEditOrientation={canEditOrientation}
              rotationLabel={rotationLabel}
              orientationDirty={orientationDirty}
              orientationSaving={orientationSaving}
              onRotateLeft={() => {
                rotateLeft();
                showChrome();
              }}
              onRotateRight={() => {
                rotateRight();
                showChrome();
              }}
              onResetOrientation={() => {
                resetOrientation();
                showChrome();
              }}
              onRevertOrientation={() => {
                revertOrientation();
                showChrome();
              }}
              onSaveOrientation={async () => {
                await saveOrientation();
                showChrome();
              }}
            />

            {chromeVisible && !frameStepping && (
              <TopScrubber
                current={now}
                duration={dur}
                onSeek={(t) => {
                  exitFrameMode();
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

            {!atVideoEnd && !frameStepping && (
              <Pressable
                onPress={() => {
                  enterAddMode();
                  showChrome();
                }}
                style={{
                  position: 'absolute',
                  left: insets.left + SAFE_MARGIN,
                  bottom: bottomControlsOffset,
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
                <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: '#111', fontWeight: '900' }}>
                  Edit
                </Text>
              </Pressable>
            )}

            {!atVideoEnd && (
              <Pressable
                onPress={handlePlayPress}
                style={{
                  position: 'absolute',
                  right: insets.right + SAFE_MARGIN,
                  bottom: bottomControlsOffset,
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
                <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: '#fff', fontWeight: '900' }}>
                  {isPlaying ? '❚❚ Pause' : '▶ Play'}
                </Text>
              </Pressable>
            )}

            <FrameStepControls
              visible={showFrameStepControls}
              current={desiredTimeRef.current || now}
              duration={dur}
              insets={insets}
              bottomOffset={bottomControlsOffset}
              onNudge={onFrameNudge}
              onJogForwardStart={onFrameJogForwardStart}
              onJogStop={onFrameJogStop}
              onShowChrome={showChrome}
              onFrameStepStart={() => {
                setFrameStepping(true);
                setOverlayMenuOpen(false);
              }}
            />

            {showEventBelt && !frameStepping && (
              <EventBelt
                duration={dur}
                current={now}
                events={events}
                onSeek={(t) => {
                  exitFrameMode();
                  onSeek(t);
                }}
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

                exitFrameMode();
                editAnchorTimeRef.current = clampToDuration(tKeep);
                onSeek(editAnchorTimeRef.current);

                try {
                  if (useAvReviewPlayer) avReviewRef.current?.pause();
                  else (player as any)?.pause?.();
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
            overlayOn={overlayOn && !frameStepping}
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