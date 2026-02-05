// lib/access.ts
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export function subscribeAccess(setAccess: (v: any) => void) {
  let unsubDoc: null | (() => void) = null;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubDoc) {
      unsubDoc();
      unsubDoc = null;
    }

    if (!user) {
      setAccess({
        uid: null,
        isSignedIn: false,
        isAnonymous: false,
        allowedSport: null,
        isPro: false,
        isTester: false,
      });
      return;
    }

    // optimistic auth state
    setAccess((prev: any) => ({
      ...prev,
      uid: user.uid,
      isSignedIn: true,
      isAnonymous: !!user.isAnonymous,
    }));

    const ref = doc(db, 'users', user.uid);

    unsubDoc = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() || {};

        const isTester = !!data.isTester;
        const isPro = !!data.isPro || isTester; // ✅ tester bypass

        setAccess({
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport: (data.freeSport ?? null),
          isPro,
          isTester,
        });
      },
      (err) => {
        console.log('[subscribeAccess] snapshot error:', err);
        setAccess({
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport: null,
          isPro: false,
          isTester: false,
        });
      }
    );
  });

  return () => {
    if (unsubDoc) unsubDoc();
    unsubAuth();
  };
}
