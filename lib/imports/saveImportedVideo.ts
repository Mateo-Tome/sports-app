import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { getOrCreateThumb } from '../library/thumbs';
import { saveToAppStorage } from '../recording/videoStorage';

type SaveImportedVideoInput = {
  sourceUri: string;
  athlete: string;
  sport: string;
  style: string;
  fileName?: string | null;

  // Swimming-specific optional metadata
  stroke?: string | null;
  distance?: string | null;
  raceLabel?: string | null;
};

export async function saveImportedVideo(input: SaveImportedVideoInput) {
  const athlete = input.athlete.trim() || 'Unassigned';
  const sport = input.sport.trim() || 'unknown';
  const style = input.style.trim() || 'default';

  const stroke = input.stroke?.trim() || null;
  const distance = input.distance?.trim() || null;
  const raceLabel = input.raceLabel?.trim() || null;

  const sportKey = `${sport}:${style}`;

  const { appUri } = await saveToAppStorage(input.sourceUri, athlete, sportKey, {
    importToPhotos: false,
  });

  if (!appUri) {
    throw new Error('Could not save imported video.');
  }

  const jsonUri = appUri.replace(/\.[^/.]+$/, '') + '.json';

  const sidecar = {
    athlete,
    sport,
    style,

    // Swimming import metadata
    stroke,
    distance,
    raceLabel,

    createdAt: Date.now(),
    imported: true,
    importedFileName: input.fileName ?? null,

    events: [],
    finalScore: { home: 0, opponent: 0 },
    homeIsAthlete: true,
    highlights: [],
    processedClips: [],

    orientationOverride: 0,
    recordingOrientation: 'unknown',
    recordingWindowOrientation: 'unknown',
    recordingPlatform: Platform.OS,

    recordingMeta: {
      appSidecarVersion: 3,
      importedVideo: true,
      cameraMountedOnlyAfterLandscape: false,
      playbackAutoRotationApplied: false,

      // Helpful for debugging imported swim clips
      importedStroke: stroke,
      importedDistance: distance,
      importedRaceLabel: raceLabel,
    },
  };

  await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(sidecar, null, 2));

  try {
    await getOrCreateThumb(appUri);
  } catch {}

  return {
    appUri,
    jsonUri,
    sidecar,
  };
}