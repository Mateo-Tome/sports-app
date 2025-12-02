// components/library/UploadButton.tsx
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { uploadFileOnTap, uploadJSONOnTap } from '../../lib/sync';

// Small helper: read the full sidecar JSON for a given video URI (for upload).
async function readSidecarForUpload(videoUri: string): Promise<any | null> {
  try {
    const lastSlash = videoUri.lastIndexOf('/');
    const lastDot = videoUri.lastIndexOf('.');
    const base =
      lastDot > lastSlash ? videoUri.slice(0, lastDot) : videoUri;
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
      const files: string[] = await (FileSystem as any).readDirectoryAsync(
        dir,
      );
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
  onUploaded?: (cloudKey: string, url: string) => void;
};

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
          try {
            // 1) Upload the video file
            const { key, url } = await uploadFileOnTap(localUri);

            // 2) Try to read the full sidecar JSON from disk
            let fullSidecar = await readSidecarForUpload(localUri);

            // 3) If there is no .json on disk, fall back to the passed-in sidecar object
            if (!fullSidecar && sidecar && typeof sidecar === 'object') {
              fullSidecar = sidecar as any;
            }

            // 4) Only upload JSON if we actually have something to send
            if (fullSidecar) {
              const payload = {
                ...fullSidecar,
                uploadMeta: {
                  ...(typeof sidecar === 'object' && sidecar
                    ? (sidecar as any)
                    : {}),
                  localUri,
                  uploadedAt: Date.now(),
                  cloudKey: key,
                  cloudUrl: url,
                },
              };

              await uploadJSONOnTap(payload, 'sidecars/');
            }

            setState('done');
            onUploaded?.(key, url);
          } catch (e: any) {
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
