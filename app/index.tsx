// app/index.tsx
import { auth } from '@/lib/firebase';
import { Redirect } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

export default function RootIndex() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) return null;                         // wait for Firebase
  const isAnonOrMissing = !user || user.isAnonymous === true;  // your rule

  return <Redirect href={isAnonOrMissing ? '/welcome' : '/(tabs)'} />;
}
