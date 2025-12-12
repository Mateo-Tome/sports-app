// components/library/UploadButton.tsx
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { app, auth, ensureAnonymous } from '../../lib/firebase';

import { testGetUploadUrl } from '../../lib/backend';
import { uploadVideoToB2 } from '../../lib/uploadVideoToB2';

// Small helper: read the full sidecar JSON for a given video URI (for upload).
async function readSidecarForUpload(videoUri: string): Promise<any | null> {
  try {
    const lastSlash = videoUri.lastIndexOf('/');
    const lastDot = videoUri.lastIndexOf('.');
    const base = lastDot > lastSlash ? videoUri.slice(0, lastDot) : videoUri;
    const guess = `${base}.json`;

    const tryRead = async (p: string): Promise<any | null> => {
      const info: any = await FileSystem.getInfoAsync(p);
      if (!info?.exists) return null;
      const txt = await FileSystem.readAsStringAsync(p);
      return txt ? JSON.parse(txt) : {};
    };

    // 1) Try the obvious same-name sidecar first
    let sc: any | null = await tryRead(guess);
    if (sc) return sc;

    // 2) Fallback: look in the same directory for a matching .json
    const dir = videoUri.slice(0, lastSlash + 1);
    try {
      // @ts-ignore
      const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
      const baseName = base.slice(lastSlash + 1);
      const candidate = files.find(
        (f) => f.toLowerCase() === `${baseName.toLowerCase()}.json`,
      );
      if (candidate) {
        sc = await tryRead(dir + candidate);
        if (sc) return sc;
      }
    } catch {}

    return null;
  } catch (e) {
    console.log('readSidecarForUpload error', e);
    return null;
  }
}

export type UploadButtonProps = {
  localUri: string;
  sidecar?: unknown;
  uploaded?: boolean;
  onUploaded?: (cloudKey: string, url: string) => void; // kept for compatibility
};

// simple random shareId
function randomShareId(length = 12): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Use existing user if present; otherwise fall back to anonymous
async function getCurrentOrAnonUser() {
  const current = auth.currentUser;
  if (current) return current;
  return await ensureAnonymous();
}

export function UploadButton({
  localUri,
  sidecar,
  uploaded,
  onUploaded,
}: UploadButtonProps) {
  const [state, setState] = useState<'idle' | 'uploading' | 'done'>(
    uploaded ? 'done' : 'idle',
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setState(uploaded ? 'done' : 'idle');
  }, [uploaded]);

  if (state === 'done') {
    return (
      <Text style={{ fontWeight: '600', color: 'white' }}>✅ Uploaded</Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={async () => {
          setError(undefined);
          setState('uploading');

          const current = auth.currentUser;
          console.log('[UploadButton] starting B2 upload for user:', {
            uid: current?.uid,
            email: current?.email,
            isAnonymous: current?.isAnonymous,
            localUri,
          });

          try {
            // Ensure we have a user
            const user = await getCurrentOrAnonUser();

            // 1) Get Backblaze uploadUrl + token from backend
            const creds: any = await testGetUploadUrl();
            if (!creds?.uploadUrl || !creds?.uploadAuthToken) {
              throw new Error(
                `testGetUploadUrl missing creds: ${JSON.stringify(creds)}`,
              );
            }

            // 2) Decide our keys (deterministic)
            const shareId = randomShareId();
            const now = Date.now();

            // Video key (B2 fileName)
            const b2VideoFileName = `${shareId}.mp4`;

            // 3) Upload video bytes to B2
            const videoUploadResult = await uploadVideoToB2({
              uploadUrl: creds.uploadUrl,
              uploadAuthToken: creds.uploadAuthToken,
              uid: user.uid,
              localFileUri: localUri,
              originalFileName: b2VideoFileName,
              mimeType: 'video/mp4',
            });

            // This is the path inside the bucket
            const b2VideoKey = videoUploadResult?.fileName; // e.g. videos/<uid>/<shareId>.mp4
            const b2VideoFileId = videoUploadResult?.fileId;

            // 4) Sidecar JSON (optional)
            let b2SidecarKey: string | undefined;
            let b2SidecarFileId: string | undefined;

            let fullSidecar = await readSidecarForUpload(localUri);
            if (!fullSidecar && sidecar && typeof sidecar === 'object') {
              fullSidecar = sidecar as any;
            }

            if (fullSidecar) {
              // Create a temp json file to upload
              const jsonPath =
                FileSystem.cacheDirectory + `sidecar-${shareId}.json`;

              const payload = {
                ...fullSidecar,
                uploadMeta: {
                  localUri,
                  uploadedAt: now,
                  shareId,
                  b2VideoKey,
                  b2VideoFileId,
                  bucket: creds.bucketName,
                },
              };

              await FileSystem.writeAsStringAsync(
                jsonPath,
                JSON.stringify(payload),
                { encoding: FileSystem.EncodingType.UTF8 },
              );

              // IMPORTANT: get a fresh uploadUrl/token (they can be single-use / short-lived)
              const creds2: any = await testGetUploadUrl();
              if (!creds2?.uploadUrl || !creds2?.uploadAuthToken) {
                throw new Error(
                  `testGetUploadUrl missing creds2: ${JSON.stringify(creds2)}`,
                );
              }

              const sidecarUploadResult = await uploadVideoToB2({
                uploadUrl: creds2.uploadUrl,
                uploadAuthToken: creds2.uploadAuthToken,
                uid: user.uid,
                localFileUri: jsonPath,
                originalFileName: `${shareId}.json`,
                mimeType: 'application/json',
              });

              b2SidecarKey = sidecarUploadResult?.fileName; // videos/<uid>/<shareId>.json (see note below)
              b2SidecarFileId = sidecarUploadResult?.fileId;
            }

            // NOTE: your uploadVideoToB2 currently always uploads under videos/<uid>/...
            // That’s fine for now. Later we can adjust it to support sidecars/<uid>/...

            // 5) Write Firestore metadata
            try {
              const db = getFirestore(app);

              const docData = {
                ownerUid: user.uid,
                athleteId: null as string | null,
                sport: null as string | null,
                style: null as string | null,
                createdAt: now,
                updatedAt: now,

                // NEW: Backblaze pointers
                b2Bucket: creds.bucketName,
                b2VideoKey,
                b2VideoFileId,
                b2SidecarKey: b2SidecarKey ?? null,
                b2SidecarFileId: b2SidecarFileId ?? null,

                shareId,
                isPublic: true,
              };

              const ref = await addDoc(collection(db, 'videos'), docData);
              console.log('[UploadButton] created VideoDoc:', ref.id, docData);
            } catch (metaErr) {
              console.warn(
                '[UploadButton] upload succeeded but metadata write failed:',
                metaErr,
              );
            }

            setState('done');

            // Keep callback for now but pass B2 key
            onUploaded?.(b2VideoKey ?? shareId, 'b2://quickclip-videos');

          } catch (e: any) {
            console.log('UploadButton(B2) error', e);
            setError(e?.message ?? 'Upload failed');
            setState('idle');
            Alert.alert(
              'Upload failed',
              e?.message ?? 'Please try again while online.',
            );
          }
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'white',
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>
          {state === 'uploading' ? 'Uploading…' : 'Upload'}
        </Text>
      </Pressable>
      {state === 'uploading' && <ActivityIndicator />}
      {!!error && <Text style={{ color: 'tomato' }}>{error}</Text>}
    </View>
  );
}
