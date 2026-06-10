// lib/userProfile.ts
import { auth, db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

export type PlanTier = 'free' | 'pro';

export type UserProfile = {
  createdAt?: any;
  updatedAt?: any;
  email?: string | null;

  isPro?: boolean;
  isTester?: boolean;
  plan?: PlanTier;

  // Free = 2 active cloud videos max.
  cloudUploadsUsed?: number;

  // Pro = storage based.
  cloudStorageUsedBytes?: number;
  cloudStorageLimitBytes?: number;

  // Free = 1 active device. Pro = 8 devices.
  deviceLimit?: number;
};

const GB = 1024 * 1024 * 1024;

export function userDocRef(uid: string) {
  return doc(db, 'users', uid);
}

export async function ensureUserDoc(uid: string) {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      email: auth.currentUser?.email ?? null,

      isPro: false,
      isTester: false,
      plan: 'free',

      cloudUploadsUsed: 0,
      cloudStorageUsedBytes: 0,
      cloudStorageLimitBytes: 0,

      deviceLimit: 1,
    } satisfies UserProfile);
    return;
  }

  const data = snap.data() as UserProfile;

  const patch: Partial<UserProfile> = {};

  if (!data.plan) patch.plan = data.isPro ? 'pro' : 'free';
  if (typeof data.cloudUploadsUsed !== 'number') patch.cloudUploadsUsed = 0;
  if (typeof data.cloudStorageUsedBytes !== 'number') patch.cloudStorageUsedBytes = 0;
  if (typeof data.cloudStorageLimitBytes !== 'number') {
    patch.cloudStorageLimitBytes = data.isPro ? 250 * GB : 0;
  }
  if (typeof data.deviceLimit !== 'number') {
    patch.deviceLimit = data.isPro ? 8 : 1;
  }

  if (Object.keys(patch).length > 0) {
    await setDoc(
      ref,
      {
        ...patch,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export function subscribeUserProfile(
  uid: string,
  onValue: (profile: UserProfile | null) => void
) {
  const ref = userDocRef(uid);

  return onSnapshot(ref, (snap) => {
    onValue(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}