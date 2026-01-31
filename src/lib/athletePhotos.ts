// src/lib/athletePhotos.ts
import * as FileSystem from 'expo-file-system';

const DIR = FileSystem.documentDirectory + 'athletePhotos/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

function safeId(input: string) {
  return String(input || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Persist a picked image into app storage (documentDirectory).
 * Works for file://, content://, and most ImagePicker outputs.
 * Verifies the file exists after writing.
 */
export async function persistAthleteProfilePhoto(localTempUri: string, athleteId?: string) {
  if (!localTempUri) throw new Error('Missing localTempUri');

  await ensureDir();

  const id = safeId(athleteId || 'unknown');
  const filename = `profile_${id}_${Date.now()}.jpg`;
  const dest = DIR + filename;

  // Try copy first
  try {
    await FileSystem.copyAsync({ from: localTempUri, to: dest });
  } catch (e) {
    // Fallback: downloadAsync handles more URI schemes on some devices
    const r = await FileSystem.downloadAsync(localTempUri, dest);
    if (!r?.uri) throw e;
  }

  // Verify it exists
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) {
    throw new Error(`persistAthleteProfilePhoto wrote missing file: ${dest}`);
  }

  return dest; // file://... under Documents
}
