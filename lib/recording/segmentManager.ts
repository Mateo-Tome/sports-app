// lib/recording/segmentManager.ts
import type { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import type { MutableRefObject, RefObject } from 'react';

const SEG_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}segments/`;

export type StartSegmentResult = {
  ok: boolean;
  reason?: string;
};

const ensureDir = async (dir: string) => {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};

const tsStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  const rand = Math.random().toString(36).slice(2, 7);

  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${ms}_${rand}`
  );
};

async function waitFor(
  pred: () => boolean,
  timeoutMs: number,
  pollMs = 40,
): Promise<boolean> {
  const start = Date.now();

  while (!pred()) {
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return true;
}

async function finalizeSegmentFile(
  uri: string,
  segmentsRef: MutableRefObject<string[]>,
): Promise<boolean> {
  await ensureDir(SEG_DIR);

  const dest = SEG_DIR + `seg_${tsStamp()}.mp4`;

  try {
    await FileSystem.moveAsync({ from: uri, to: dest });
    segmentsRef.current.push(dest);
    return true;
  } catch (e) {
    console.warn('[segment] moveAsync failed, falling back to copyAsync', e);
  }

  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    await FileSystem.deleteAsync(uri, { idempotent: true });
    segmentsRef.current.push(dest);
    return true;
  } catch (e) {
    console.warn('[segment] copy/delete fallback failed', e);
    return false;
  }
}

export async function startNewSegment(
  cameraRef: RefObject<CameraView | null>,
  cameraReady: boolean,
  segmentsRef: MutableRefObject<string[]>,
  segmentActiveRef: MutableRefObject<boolean>,
  recordPromiseRef: MutableRefObject<Promise<any> | null>,
): Promise<StartSegmentResult> {
  const cam: any = cameraRef.current;

  if (!cam || !cameraReady) {
    console.warn('[segment] camera not ready');
    return { ok: false, reason: 'camera-not-ready' };
  }

  try {
    await ensureDir(SEG_DIR);
  } catch (e) {
    console.warn('[segment] failed to create segment directory', e);
    return { ok: false, reason: 'segment-dir-failed' };
  }

  segmentActiveRef.current = true;
  recordPromiseRef.current = null;

  const onFinished = async (res: any) => {
    const uri = typeof res === 'string' ? res : res?.uri;

    try {
      if (!uri) {
        console.warn('[segment] recording finished with no uri');
        return;
      }

      const saved = await finalizeSegmentFile(uri, segmentsRef);
      if (!saved) {
        console.warn('[segment] failed to finalize segment file');
      }
    } catch (e) {
      console.warn('[segment] onFinished failed', e);
    } finally {
      segmentActiveRef.current = false;
    }
  };

  const onError = (e: any) => {
    console.warn('[segment] recording error', e);
    segmentActiveRef.current = false;
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
      segmentActiveRef.current = false;
      return { ok: false, reason: 'no-recording-api' };
    }
  } catch (e) {
    console.warn('[segment] start exception', e);
    segmentActiveRef.current = false;
    return { ok: false, reason: 'start-exception' };
  }

  await new Promise((r) => setTimeout(r, 250));

  if (!segmentActiveRef.current) {
    return { ok: false, reason: 'settled-immediately' };
  }

  return { ok: true };
}

export async function stopCurrentSegment(
  cameraRef: RefObject<CameraView | null>,
  segmentActiveRef: MutableRefObject<boolean>,
): Promise<boolean> {
  if (!segmentActiveRef.current) return true;

  const cam: any = cameraRef.current;

  try {
    cam?.stopRecording?.();
  } catch (e) {
    console.warn('[segment] stopRecording threw', e);
  }

  const stopped = await waitFor(() => !segmentActiveRef.current, 7000);

  if (!stopped) {
    console.warn(
      '[segment] stopCurrentSegment timed out after 7000ms — segment may still be writing',
    );
  }

  return stopped;
}