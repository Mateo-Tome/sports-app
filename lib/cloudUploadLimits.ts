// lib/cloudUploadLimits.ts
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';

const GB = 1024 * 1024 * 1024;

export const FREE_MAX_CLOUD_VIDEOS = 2;
export const PRO_MAX_STORAGE_BYTES = 250 * GB;

export type UploadLimitResult =
  | { ok: true }
  | { ok: false; title: string; message: string };

export async function checkCloudUploadAllowed(params: {
  uid: string;
  isPro: boolean;
  isTester?: boolean;
  fileSizeBytes?: number | null;
}): Promise<UploadLimitResult> {
  const { uid, isPro, isTester, fileSizeBytes } = params;

  if (!uid) {
    return {
      ok: false,
      title: 'Sign in required',
      message: 'Sign in before uploading to the cloud.',
    };
  }

  if (isTester) {
    return { ok: true };
  }

  const videosRef = collection(db, 'videos');

  const q = query(
    videosRef,
    where('ownerUid', '==', uid),
    limit(500)
  );

  const snap = await getDocs(q);

  let activeVideoCount = 0;
  let storageUsedBytes = 0;

  snap.forEach((doc) => {
    const data = doc.data() as any;

    activeVideoCount += 1;

    const size =
      typeof data.videoSizeBytes === 'number'
        ? data.videoSizeBytes
        : typeof data.sizeBytes === 'number'
          ? data.sizeBytes
          : 0;

    storageUsedBytes += Number.isFinite(size) ? size : 0;
  });

  if (!isPro) {
    if (activeVideoCount >= FREE_MAX_CLOUD_VIDEOS) {
      return {
        ok: false,
        title: 'Free upload limit reached',
        message:
          'Free accounts can keep 2 cloud videos uploaded at a time. Delete one cloud video or upgrade to Pro.',
      };
    }

    return { ok: true };
  }

  const nextSize = typeof fileSizeBytes === 'number' ? fileSizeBytes : 0;

  if (storageUsedBytes + nextSize > PRO_MAX_STORAGE_BYTES) {
    return {
      ok: false,
      title: 'Cloud storage full',
      message:
        'Your Pro cloud storage is full. Delete older cloud videos to free up space.',
    };
  }

  return { ok: true };
}