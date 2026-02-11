// lib/access.ts
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { SportKey } from '@/lib/userProfile';

export type AccessState = {
  loading: boolean;
  uid: string | null;
  isSignedIn: boolean;
  isAnonymous: boolean;
  allowedSport: SportKey | null;
  isTester: boolean;
  isPro: boolean; // includes tester bypass
};

const SIGNED_OUT: AccessState = {
  loading: false,
  uid: null,
  isSignedIn: false,
  isAnonymous: false,
  allowedSport: null,
  isTester: false,
  isPro: false,
};

export function subscribeAccess(setAccess: (v: AccessState | ((prev: AccessState) => AccessState)) => void) {
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

        const isTester = !!data.isTester;
        const isPro = !!data.isPro || isTester; // ✅ tester bypass

        setAccess({
          loading: false,
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport: (data.freeSport ?? null) as SportKey | null,
          isTester,
          isPro,
        });
      },
      (err) => {
        console.log('[subscribeAccess] snapshot error:', err);
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
