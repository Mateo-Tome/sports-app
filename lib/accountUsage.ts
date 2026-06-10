// lib/accountUsage.ts
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
export const PRO_STORAGE_LIMIT_BYTES = 250 * GB;

export type AccountUsage = {
  cloudVideoCount: number;
  cloudStorageUsedBytes: number;
  freeMaxCloudVideos: number;
  proStorageLimitBytes: number;
};

export async function getAccountUsage(uid: string): Promise<AccountUsage> {
  const q = query(
    collection(db, 'videos'),
    where('ownerUid', '==', uid),
    limit(1000)
  );

  const snap = await getDocs(q);

  let cloudVideoCount = 0;
  let cloudStorageUsedBytes = 0;

  snap.forEach((d) => {
    const data = d.data() as any;
    cloudVideoCount += 1;

    const size =
      typeof data.videoSizeBytes === 'number'
        ? data.videoSizeBytes
        : typeof data.sizeBytes === 'number'
          ? data.sizeBytes
          : 0;

    if (Number.isFinite(size)) {
      cloudStorageUsedBytes += size;
    }
  });

  return {
    cloudVideoCount,
    cloudStorageUsedBytes,
    freeMaxCloudVideos: FREE_MAX_CLOUD_VIDEOS,
    proStorageLimitBytes: PRO_STORAGE_LIMIT_BYTES,
  };
}

export function formatStorage(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB';
  return `${(bytes / GB).toFixed(2)} GB`;
}