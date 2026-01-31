// src/lib/athletePhotoUpload.ts
import * as FileSystem from 'expo-file-system';
import { getAuth } from 'firebase/auth';
import { ensureAnonymous } from '../../lib/firebase';

const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

function mustBaseUrl() {
  if (!FUNCTIONS_BASE_URL) throw new Error('Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL');
  return FUNCTIONS_BASE_URL.replace(/\/+$/, '');
}

type UploadUrlResp = {
  uploadUrl: string;
  uploadAuthToken: string;
  fileName: string;
  photoUrl: string; // ✅ tokened CDN URL (or otherwise publicly loadable)
  expiresInSec?: number;
};

export async function uploadAthleteProfilePhotoToB2(params: {
  athleteId: string;
  localFileUri: string; // file://... (documentDirectory)
}): Promise<{ photoUrl: string }> {
  const { athleteId, localFileUri } = params;

  await ensureAnonymous();

  const user = getAuth().currentUser;
  const idToken = user ? await user.getIdToken() : null;
  if (!idToken) throw new Error('Not authenticated');

  const base = mustBaseUrl();
  const url = `${base}/getAthletePhotoUploadUrl?athleteId=${encodeURIComponent(athleteId)}`;

  const r = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const j = (await r.json().catch(() => ({}))) as Partial<UploadUrlResp> & {
    error?: string;
    details?: string;
  };

  if (!r.ok) {
    throw new Error(j?.error || j?.details || `getAthletePhotoUploadUrl failed (${r.status})`);
  }

  if (!j.uploadUrl || !j.uploadAuthToken || !j.fileName || !j.photoUrl) {
    throw new Error('Bad response from getAthletePhotoUploadUrl (missing fields)');
  }

  // 2) upload bytes to B2
  const up = await FileSystem.uploadAsync(j.uploadUrl, localFileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: j.uploadAuthToken,
      'X-Bz-File-Name': j.fileName,
      'Content-Type': 'image/jpeg',
      'X-Bz-Content-Sha1': 'do_not_verify',
    },
  });

  if (up.status < 200 || up.status >= 300) {
    throw new Error(`B2 upload failed: ${up.status} ${String(up.body || '').slice(0, 300)}`);
  }

  // ✅ store this on athlete.photoUrl
  return { photoUrl: j.photoUrl };
}
