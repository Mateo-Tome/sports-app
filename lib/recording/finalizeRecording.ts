// lib/recording/finalizeRecording.ts
// Takes finished segments + metadata, creates the final match file,
// writes the JSON payload, and *optionally* post-processes (Photos import, highlights).

import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

import { stitchSegmentsWithFallback } from './segmentStitcher';
import {
  importToPhotosAndAlbums,
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
  orientationOverride: 0 | 90 | 180 | 270;
};

export async function finalizeRecording(
  segments: string[],
  chosenAthlete: string,
  sportKey: string,
  markers: number[],
  events: MatchEvent[],
  score: { home: number; opponent: number },
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

  // 1) Choose final path (stitch if multiple)
  if (segments.length === 1) {
    finalPath = segments[0];
    log('single segment: no stitch');
  } else {
    const stitchRes = await stitchSegmentsWithFallback(segments);
    log(`stitch done stage=${stitchRes.stitchStage ?? 'unknown'} usedFallback=${Boolean(stitchRes.usedFallback)}`);

    if (!stitchRes.ok || !stitchRes.finalPath) {
      Alert.alert('Save error', 'Failed to stitch segments.');
      return;
    }

    finalPath = stitchRes.finalPath;
  }

  // 2) Save to app storage FAST (do NOT block on Photos)
  const athlete = (chosenAthlete || '').trim() || 'Unassigned';
  const sport = (sportKey || '').trim() || 'unknown';

  const { appUri } = await saveToAppStorage(finalPath, athlete, sport, {
    importToPhotos: false, // critical for instant Stop UX
  });

  log('saveToAppStorage done');

  // 3) Write sidecar JSON next to appUri (fast)
  let jsonUri: string | null = null;

  if (appUri) {
    jsonUri = appUri.replace(/\.[^/.]+$/, '') + '.json';

    const payload: SidecarPayload = {
      athlete,
      sport: sportKey.split(':')[0],
      style: sportKey.split(':')[1],
      createdAt: Date.now(),
      events,
      finalScore: score,
      homeIsAthlete: true,
      highlights: markers.map((t) => ({ t, duration: HILITE_DURATION_SEC })),
      processedClips: [], // populated by post tasks later (best-effort)
      orientationOverride: 0,
    };

    await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(payload, null, 2));
    log('sidecar written');
  } else {
    console.log('[finalize] no appUri -> no json written');
  }

  // 4) Clean up original segments (best-effort)
  for (const seg of segments) {
    try {
      await FileSystem.deleteAsync(seg, { idempotent: true });
    } catch {}
  }
  log('segments cleaned');

  // SHOW QUICK CONFIRMATION (fast)
  Alert.alert(
    'Recording saved',
    `Athlete: ${athlete}\nSegments: ${segments.length}\nHighlights queued: ${markers.length}`,
  );

  // 5) Post-processing (safe fire-and-forget)
  // - Photos import for full match (optional)
  // - Highlights generation (optional)
  //
  // We do this AFTER returning, so Stop feels instant.
  if (appUri) {
    const sportName = sportKey; // keep your current convention

    runPostSaveTasksSafe([
      async () => {
        log('post: photos import begin');
        const assetId = await importToPhotosAndAlbums(appUri, athlete, sportName);
        log(`post: photos import done assetId=${assetId ? 'yes' : 'no'}`);
      },
      async () => {
        if (!markers.length) return;
        log('post: highlights begin');

        // Highlights are stored in app storage either way.
        // We keep Photos import OFF for highlights to avoid stalls.
        const clips = await processHighlights(appUri, markers, HILITE_DURATION_SEC, athlete, {
          importHighlightsToPhotos: false,
          maxClips: 12, // safety cap; raise if you want
        });

        log(`post: highlights done clips=${clips.length}`);

        // Optional: patch sidecar with processedClips list (best-effort)
        if (jsonUri) {
          try {
            const txt = await FileSystem.readAsStringAsync(jsonUri);
            const parsed = JSON.parse(txt) as SidecarPayload;
            parsed.processedClips = clips.map((c: any) => ({ url: c.url, markerTime: c.markerTime }));
            if (
              parsed.orientationOverride !== 0 &&
              parsed.orientationOverride !== 90 &&
              parsed.orientationOverride !== 180 &&
              parsed.orientationOverride !== 270
            ) {
              parsed.orientationOverride = 0;
            }
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