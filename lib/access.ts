// lib/access.ts
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export type PlanTier = 'free' | 'pro';

export type AccessState = {
  loading: boolean;
  uid: string | null;
  isSignedIn: boolean;
  isAnonymous: boolean;

  isTester: boolean;
  isPro: boolean; // includes tester bypass

  plan: PlanTier;

  // Free = 2 active cloud videos max.
  // Pro = storage-based instead of upload-count-based.
  maxCloudVideos: number | null;
  maxCloudStorageBytes: number | null;
  maxDevices: number;
};

const GB = 1024 * 1024 * 1024;

export const FREE_LIMITS = {
  maxCloudVideos: 2,
  maxCloudStorageBytes: null,
  maxDevices: 1,
} as const;

export const PRO_LIMITS = {
  maxCloudVideos: null,
  maxCloudStorageBytes: 250 * GB,
  maxDevices: 8,
} as const;

// ✅ Open Beta switch: treat users like Pro/Testers in this build when set to "1"
const BETA_UNLOCK_ALL = process.env.EXPO_PUBLIC_BETA_UNLOCK_ALL === '1';

const SIGNED_OUT: AccessState = {
  loading: false,
  uid: null,
  isSignedIn: false,
  isAnonymous: false,

  isTester: false,
  isPro: false,
  plan: 'free',

  maxCloudVideos: FREE_LIMITS.maxCloudVideos,
  maxCloudStorageBytes: FREE_LIMITS.maxCloudStorageBytes,
  maxDevices: FREE_LIMITS.maxDevices,
};

function buildAccessState(user: any, data: any): AccessState {
  const firestoreTester = !!data?.isTester;

  const isTester = BETA_UNLOCK_ALL ? true : firestoreTester;
  const isPro = !!data?.isPro || isTester;

  const plan: PlanTier = isPro ? 'pro' : 'free';
  const limits = isPro ? PRO_LIMITS : FREE_LIMITS;

  return {
    loading: false,
    uid: user.uid,
    isSignedIn: true,
    isAnonymous: !!user.isAnonymous,

    isTester,
    isPro,
    plan,

    maxCloudVideos: limits.maxCloudVideos,
    maxCloudStorageBytes: limits.maxCloudStorageBytes,
    maxDevices: limits.maxDevices,
  };
}

export function subscribeAccess(
  setAccess: (v: AccessState | ((prev: AccessState) => AccessState)) => void
) {
  let unsubDoc: null | (() => void) = null;

  setAccess((prev: any) => ({
    ...(prev ?? SIGNED_OUT),
    loading: true,
  }));

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubDoc) {
      unsubDoc();
      unsubDoc = null;
    }

    if (!user) {
      setAccess(SIGNED_OUT);
      return;
    }

    setAccess((prev: any) => ({
      ...(prev ?? SIGNED_OUT),
      loading: true,
      uid: user.uid,
      isSignedIn: true,
      isAnonymous: !!user.isAnonymous,
    }));

    const ref = doc(db, 'users', user.uid);

    unsubDoc = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setAccess(buildAccessState(user, data));
      },
      (err) => {
        console.log('[subscribeAccess] snapshot error:', err);

        if (BETA_UNLOCK_ALL) {
          setAccess(buildAccessState(user, { isTester: true, isPro: true }));
          return;
        }

        setAccess(buildAccessState(user, {}));
      }
    );
  });

  return () => {
    if (unsubDoc) unsubDoc();
    unsubAuth();
  };
}