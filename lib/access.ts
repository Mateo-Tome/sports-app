// lib/access.ts
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export function subscribeAccess(setAccess: (v: any) => void) {
  let unsubDoc: null | (() => void) = null;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    // stop any prior doc listener
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
      });
      return;
    }

    // now safe to read Firestore as this user
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
        setAccess({
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport: (data.freeSport ?? null),
          isPro: !!data.isPro,
        });
      },
      (err) => {
        console.log('[subscribeAccess] snapshot error:', err);
        // keep auth state but no access data
        setAccess({
          uid: user.uid,
          isSignedIn: true,
          isAnonymous: !!user.isAnonymous,
          allowedSport: null,
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
