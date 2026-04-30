// lib/recording/finalizeRecording.ts

import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';

import { stitchSegmentsWithFallback } from './segmentStitcher';
import {
  processHighlights,
  runPostSaveTasksSafe,
  saveToAppStorage,
} from './videoStorage';

export type Actor = 'home' | 'opponent' | 'neutral';

export type MatchEvent = {
  eventId: string;
  t: number;
  tsMs?: number;
  kind: string;
  label?: string;
  key?: string;
  points?: number;
  actor: Actor;
  meta?: Record<string, any>;
  scoreAfter?: { home: number; opponent: number };
};

export type OrientationOverride = 0 | 90 | 180 | 270;
export type RecordingOrientationKind = 'portrait' | 'landscape' | 'unknown';

type FinalizeRecordingOptions = {
  recordingOrientation?: RecordingOrientationKind;
  windowOrientation?: RecordingOrientationKind;
  orientationOverride?: OrientationOverride;
  viewportWidth?: number;
  viewportHeight?: number;
};

type SidecarPayload = {
  athlete: string;
  sport: string;
  style: string;
  createdAt: number;
  events: MatchEvent[];
  finalScore: { home: number; opponent: number };
  homeIsAthlete: boolean;
  highlights: Array<{ t: number; duration: number }>;
  processedClips: Array<{ url: string; markerTime: number }>;
  orientationOverride: OrientationOverride;
  recordingOrientation: RecordingOrientationKind;
  recordingWindowOrientation: RecordingOrientationKind;
  recordingPlatform: typeof Platform.OS;
  recordingViewport?: {
    width: number;
    height: number;
  };
  recordingMeta: {
    appSidecarVersion: number;
    cameraMountedOnlyAfterLandscape: boolean;
    playbackAutoRotationApplied: boolean;
  };
};

function normalizeOrientationOverride(value: unknown): OrientationOverride {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

function normalizeRecordingOrientation(value: unknown): RecordingOrientationKind {
  if (value === 'landscape' || value === 'portrait') return value;
  return 'unknown';
}

export async function finalizeRecording(
  segments: string[],
  chosenAthlete: string,
  sportKey: string,
  markers: number[],
  events: MatchEvent[],
  score: { home: number; opponent: number },
  options: FinalizeRecordingOptions = {},
) {
  const HILITE_DURATION_SEC = 10;
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[finalize] ${msg} +${Date.now() - t0}ms`);

  let finalPath: string | null = null;

  if (segments.length === 0) {
    Alert.alert('Nothing recorded', 'Try recording at least a second before stopping.');
    return;
  }

  log(`begin segments=${segments.length} markers=${markers.length} events=${events.length}`);

  if (segments.length === 1) {
    finalPath = segments[0];
    log('single segment: no stitch');
  } else {
    const stitchRes = await stitchSegmentsWithFallback(segments);

    log(
      `stitch done stage=${stitchRes.stitchStage ?? 'unknown'} usedFallback=${Boolean(
        stitchRes.usedFallback,
      )}`,
    );

    if (!stitchRes.ok || !stitchRes.finalPath) {
      Alert.alert('Save error', 'Failed to stitch segments.');
      return;
    }

    finalPath = stitchRes.finalPath;
  }

  const athlete = (chosenAthlete || '').trim() || 'Unassigned';
  const sport = (sportKey || '').trim() || 'unknown';

  const { appUri } = await saveToAppStorage(finalPath, athlete, sport, {
    importToPhotos: false,
  });

  log('saveToAppStorage done');

  let jsonUri: string | null = null;

  if (appUri) {
    jsonUri = appUri.replace(/\.[^/.]+$/, '') + '.json';

    const [sportOnlyRaw, styleRaw] = sportKey.split(':');

    const payload: SidecarPayload = {
      athlete,
      sport: sportOnlyRaw || 'unknown',
      style: styleRaw || 'default',
      createdAt: Date.now(),
      events,
      finalScore: score,
      homeIsAthlete: true,
      highlights: markers.map((t) => ({ t, duration: HILITE_DURATION_SEC })),
      processedClips: [],
      orientationOverride: normalizeOrientationOverride(options.orientationOverride),
      recordingOrientation: normalizeRecordingOrientation(options.recordingOrientation),
      recordingWindowOrientation: normalizeRecordingOrientation(options.windowOrientation),
      recordingPlatform: Platform.OS,
      recordingViewport:
        typeof options.viewportWidth === 'number' && typeof options.viewportHeight === 'number'
          ? {
              width: options.viewportWidth,
              height: options.viewportHeight,
            }
          : undefined,
      recordingMeta: {
        appSidecarVersion: 3,
        cameraMountedOnlyAfterLandscape: true,
        playbackAutoRotationApplied: false,
      },
    };

    await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(payload, null, 2));
    log(`sidecar written orientationOverride=${payload.orientationOverride}`);
  } else {
    console.log('[finalize] no appUri -> no json written');
  }

  for (const seg of segments) {
    try {
      await FileSystem.deleteAsync(seg, { idempotent: true });
    } catch {}
  }

  log('segments cleaned');

  Alert.alert(
    'Recording saved',
    `Athlete: ${athlete}\nSegments: ${segments.length}\nHighlights queued: ${markers.length}`,
  );

  if (appUri && markers.length > 0) {
    runPostSaveTasksSafe([
      async () => {
        log('post: highlights begin');

        const clips = await processHighlights(appUri, markers, HILITE_DURATION_SEC, athlete, {
          importHighlightsToPhotos: false,
          maxClips: 12,
        });

        log(`post: highlights done clips=${clips.length}`);

        if (jsonUri) {
          try {
            const txt = await FileSystem.readAsStringAsync(jsonUri);
            const parsed = JSON.parse(txt) as SidecarPayload;

            parsed.processedClips = clips.map((c: any) => ({
              url: c.url,
              markerTime: c.markerTime,
            }));

            parsed.orientationOverride = normalizeOrientationOverride(parsed.orientationOverride);
            parsed.recordingOrientation = normalizeRecordingOrientation(parsed.recordingOrientation);
            parsed.recordingWindowOrientation = normalizeRecordingOrientation(
              parsed.recordingWindowOrientation,
            );
            parsed.recordingPlatform = parsed.recordingPlatform ?? Platform.OS;
            parsed.recordingMeta = {
              ...(parsed.recordingMeta ?? {}),
              appSidecarVersion: 3,
              cameraMountedOnlyAfterLandscape: true,
              playbackAutoRotationApplied: false,
            };

            await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(parsed, null, 2));
            log('post: sidecar updated with clips');
          } catch (e) {
            console.log('[finalize] post sidecar update failed', e);
          }
        }
      },
    ]);
  }

  log('return');
}