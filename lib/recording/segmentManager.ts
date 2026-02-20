// lib/recording/segmentManager.ts
import type { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import type { MutableRefObject, RefObject } from 'react';
import { Alert } from 'react-native';

const SEG_DIR = FileSystem.cacheDirectory + 'segments/';

const ensureDir = async (dir: string) => {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    // ignore — downstream file ops will surface errors if truly broken
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

async function waitFor(pred: () => boolean, timeoutMs: number, pollMs = 40) {
  const start = Date.now();
  while (!pred()) {
    await new Promise((r) => setTimeout(r, pollMs));
    if (Date.now() - start > timeoutMs) break;
  }
}

async function finalizeSegmentFile(uri: string, segmentsRef: MutableRefObject<string[]>) {
  const dest = SEG_DIR + `seg_${tsStamp()}.mp4`;

  // Prefer moveAsync: faster and avoids FS lag on large files
  try {
    await FileSystem.moveAsync({ from: uri, to: dest });
    segmentsRef.current.push(dest);
    return;
  } catch (e) {
    console.warn('[segment] moveAsync failed, falling back to copyAsync', e);
  }

  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
  } catch (e) {
    console.warn('[segment] copyAsync failed', e);
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}

  segmentsRef.current.push(dest);
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

  const onFinished = async (res: any) => {
    const uri = typeof res === 'string' ? res : res?.uri;
    try {
      if (uri) await finalizeSegmentFile(uri, segmentsRef);
    } finally {
      segmentActiveRef.current = false;
    }
  };

  const onError = (e: any) => {
    console.warn('[segment error]', e);
    segmentActiveRef.current = false;
    Alert.alert(
      'Recording error',
      (e && (e.message || e.toString())) || 'Unknown camera error',
    );
  };

  try {
    if (typeof cam.startRecording === 'function') {
      cam.startRecording({
        mute: false,
        onRecordingFinished: onFinished,
        onRecordingError: onError,
      });
    } else if (typeof cam.recordAsync === 'function') {
      recordPromiseRef.current = cam
        .recordAsync({ mute: false })
        .then(onFinished)
        .catch(onError);
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

  // Longer timeout to cover slower devices + iOS mp4 finalization
  await waitFor(() => !segmentActiveRef.current, 3500);
}