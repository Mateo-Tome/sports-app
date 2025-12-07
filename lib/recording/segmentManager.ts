// lib/recording/segmentManager.ts
// Handles segmented recording start/stop for CameraView, with shared
// logic for both startRecording and recordAsync paths.

import type { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import type { MutableRefObject, RefObject } from 'react';
import { Alert } from 'react-native';

const SEG_DIR = FileSystem.cacheDirectory + 'segments/';

const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // directory already exists or cannot be created: ignore here,
    // camera error flows will still surface if this truly breaks.
  }
};

const tsStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
};

async function waitFor(
  pred: () => boolean,
  timeoutMs: number,
  pollMs = 40,
) {
  const start = Date.now();
  while (!pred()) {
    await new Promise((r) => setTimeout(r, pollMs));
    if (Date.now() - start > timeoutMs) break;
  }
}

export async function startNewSegment(
  cameraRef: RefObject<CameraView | null>,
  cameraReady: boolean,
  segmentsRef: MutableRefObject<string[]>,
  segmentActiveRef: MutableRefObject<boolean>,
  recordPromiseRef: MutableRefObject<Promise<any> | null>,
) {
  const cam: any = cameraRef.current;
  if (!cam || !cameraReady) {
    console.warn('[segment] camera not ready');
    return;
  }

  await ensureDir(SEG_DIR);
  segmentActiveRef.current = true;
  recordPromiseRef.current = null;

  try {
    if (typeof cam.startRecording === 'function') {
      // CameraView.startRecording path
      cam.startRecording({
        mute: false,
        onRecordingFinished: async (res: any) => {
          const uri = typeof res === 'string' ? res : res?.uri;
          if (uri) {
            const dest = SEG_DIR + `seg_${tsStamp()}.mp4`;
            try {
              await FileSystem.copyAsync({ from: uri, to: dest });
            } catch {}
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {}
            segmentsRef.current.push(dest);
          }
          segmentActiveRef.current = false;
        },
        onRecordingError: (e: any) => {
          console.warn('[segment error startRecording]', e);
          segmentActiveRef.current = false;
          Alert.alert(
            'Recording error',
            (e && (e.message || e.toString())) || 'Unknown camera error',
          );
        },
      });
    } else if (typeof cam.recordAsync === 'function') {
      // recordAsync path
      recordPromiseRef.current = cam
        .recordAsync({ mute: false })
        .then(async (res: any) => {
          const uri = typeof res === 'string' ? res : res?.uri;
          if (uri) {
            const dest = SEG_DIR + `seg_${tsStamp()}.mp4`;
            try {
              await FileSystem.copyAsync({ from: uri, to: dest });
            } catch {}
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {}
            segmentsRef.current.push(dest);
          }
          segmentActiveRef.current = false;
        })
        .catch((e: any) => {
          console.warn('[segment error recordAsync]', e);
          segmentActiveRef.current = false;
          Alert.alert(
            'Recording error',
            (e && (e.message || e.toString())) || 'Unknown camera error',
          );
        });
    } else {
      throw new Error('No recording API found on CameraView');
    }
  } catch (e: any) {
    console.warn('[segment start exception]', e);
    segmentActiveRef.current = false;
    Alert.alert('Recording error', e?.message ?? String(e));
  }
}

export async function stopCurrentSegment(
  cameraRef: RefObject<CameraView | null>,
  segmentActiveRef: MutableRefObject<boolean>,
) {
  const cam: any = cameraRef.current;
  try {
    cam?.stopRecording?.();
  } catch {}

  await waitFor(() => !segmentActiveRef.current, 2500);
}
