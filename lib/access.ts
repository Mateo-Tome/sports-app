// lib/access.ts
import { auth, db } from '@/lib/firebase';
import type { SportKey } from '@/lib/userProfile';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export type AccessState = {
  loading: boolean;
  uid: string | null;
  isSignedIn: boolean;
  isAnonymous: boolean;
  allowedSport: SportKey | null;
  isTester: boolean;
  isPro: boolean; // includes tester bypass
};

// ✅ Open Beta switch: unlock everything in this build when set to "1"
const BETA_UNLOCK_ALL = process.env.EXPO_PUBLIC_BETA_UNLOCK_ALL === '1';

const SIGNED_OUT: AccessState = {
  loading: false,
  uid: null,
  isSignedIn: false,
  isAnonymous: false,
  allowedSport: null,
  isTester: false,
  isPro: false,
};

export function subscribeAccess(
  setAccess: (v: AccessState | ((prev: AccessState) => AccessState)) => void
) {
  let unsubDoc: null | (() => void) = null;

  // start in loading=true so UI can wait for first snapshot
  setAccess((prev: any) => ({
    ...(prev ?? SIGNED_OUT),
    loading: true,
  }));

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    // stop any prior doc listener
    if (unsubDoc) {
      unsubDoc();
      unsubDoc = null;
    }

    if (!user) {
      setAccess(SIGNED_OUT);
      return;
    }

    // optimistic auth state (still loading until first snapshot)
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
        const data = (snap.exists() ? snap.data() : {}) as any;

        const firestoreTester = !!data.isTester;

        // ✅ Decide tester/pro
        const isTester = BETA_UNLOCK_ALL ? true : firestoreTester;
        const isPro = !!data.isPro || isTester; // ✅ tester bypass

        // ✅ In beta unlock-all builds, remove "freeSport forever" limitation from UI
        const allowedSport = BETA_UNLOCK_ALL
          ? null
          : ((data.freeSport ?? null) as SportKey | null);

        setAccess({
          loading: false,
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport,
          isTester,
          isPro,
        });
      },
      (err) => {
        console.log('[subscribeAccess] snapshot error:', err);

        // If Firestore is temporarily unavailable, but we’re in beta unlock-all,
        // keep the app usable instead of locking people out.
        if (BETA_UNLOCK_ALL) {
          setAccess({
            loading: false,
            uid: user.uid,
            isSignedIn: true,
            isAnonymous: !!user.isAnonymous,
            allowedSport: null,
            isTester: true,
            isPro: true,
          });
          return;
        }

        // keep auth state, but no access data
        setAccess({
          loading: false,
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport: null,
          isTester: false,
          isPro: false,
        });
      }
    );
  });

  return () => {
    if (unsubDoc) unsubDoc();
    unsubAuth();
  };
}