// lib/userProfile.ts
import { auth, db } from '@/lib/firebase';
import {
    doc,
    getDoc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';

/**
 * Sports supported by the app.
 * Keep these lowercase and stable — they become stored data.
 */
export type SportKey =
  | 'wrestling'
  | 'baseball'
  | 'basketball'
  | 'volleyball'
  | 'bjj';

/**
 * Firestore user profile document shape.
 * Stored at: users/{uid}
 */
export type UserProfile = {
  createdAt?: any;
  email?: string | null;

  // Free-tier lock (FOREVER unless Pro)
  freeSport?: SportKey | null;
  freeSportLockedAt?: any | null;

  // Future use
  storageUsedBytes?: number;
};

/**
 * Get a typed reference to users/{uid}
 */
export function userDocRef(uid: string) {
  return doc(db, 'users', uid);
}

/**
 * Ensure the Firestore user document exists.
 * Safe to call multiple times.
 */
export async function ensureUserDoc(uid: string) {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      email: auth.currentUser?.email ?? null,
      freeSport: null,
      freeSportLockedAt: null,
      storageUsedBytes: 0,
    } satisfies UserProfile);
  }
}

/**
 * Subscribe to live updates of the user profile.
 * Used by UI to react to freeSport changes.
 */
export function subscribeUserProfile(
  uid: string,
  onValue: (profile: UserProfile | null) => void
) {
  const ref = userDocRef(uid);

  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onValue(null);
    } else {
      onValue(snap.data() as UserProfile);
    }
  });
}

/**
 * Lock the free-tier sport FOREVER.
 * Uses a transaction to prevent race conditions.
 */
export async function lockFreeSport(uid: string, chosen: SportKey) {
  const ref = userDocRef(uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      throw new Error('User profile missing.');
    }

    const data = snap.data() as UserProfile;

    // Already locked → refuse
    if (data.freeSport) {
      throw new Error(`Sport already locked to ${data.freeSport}.`);
    }

    tx.update(ref, {
      freeSport: chosen,
      freeSportLockedAt: serverTimestamp(),
    });
  });
}
