// lib/recording/finalizeRecording.ts
// Takes finished segments + metadata, creates the final match file,
// runs highlights, writes the JSON payload, and cleans up.

import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

import { stitchSegmentsWithFallback } from './segmentStitcher';
import { processHighlights, saveToAppStorage } from './videoStorage';

export type Actor = 'home' | 'opponent' | 'neutral';

export type MatchEvent = {
  t: number;
  kind: string;
  points?: number;
  actor: Actor;
  meta?: Record<string, any>;
  scoreAfter?: { home: number; opponent: number };
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
  let finalPath: string | null = null;

  if (segments.length === 0) {
    Alert.alert(
      'Nothing recorded',
      'Try recording at least a second before stopping.',
    );
    return;
  }

  if (segments.length === 1) {
    // Single segment: just use it
    finalPath = segments[0];
  } else {
    // ✅ Use the stitcher with Android fallback
    const { ok, finalPath: stitchedPath } =
      await stitchSegmentsWithFallback(segments);

    if (!ok || !stitchedPath) {
      Alert.alert('Save error', 'Failed to stitch segments.');
      return;
    }

    finalPath = stitchedPath;
  }

  const { appUri, assetId } = await saveToAppStorage(
    finalPath,
    chosenAthlete,
    sportKey,
  );

  let processedClips: { url: string; markerTime: number }[] = [];
  if (appUri && markers.length > 0) {
    processedClips = await processHighlights(
      appUri,
      markers,
      HILITE_DURATION_SEC,
      chosenAthlete,
    );
  }

  if (appUri) {
    const jsonUri = appUri.replace(/\.[^/.]+$/, '') + '.json';
    const payload = {
      athlete: chosenAthlete,
      sport: sportKey.split(':')[0],
      style: sportKey.split(':')[1],
      createdAt: Date.now(),
      events,
      finalScore: score,
      homeIsAthlete: true,
      highlights: markers.map((t) => ({
        t,
        duration: HILITE_DURATION_SEC,
      })),
      processedClips,
    };
    await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(payload));
  }

  // clean up segments
  for (const seg of segments) {
    try {
      await FileSystem.deleteAsync(seg, { idempotent: true });
    } catch {}
  }

  Alert.alert(
    'Recording saved',
    `Athlete: ${chosenAthlete}\nSegments: ${
      segments.length
    }\nHighlights: ${processedClips.length} of ${
      markers.length
    }\nPhotos: ${assetId ? 'imported ✔︎' : 'not imported'}`,
  );
}
