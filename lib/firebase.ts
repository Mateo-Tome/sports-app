// lib/firebase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import {
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

import * as AuthNS from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (__DEV__ && !firebaseConfig.apiKey) {
  console.warn('Firebase configuration is missing. Check your .env file or EAS Secrets.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth>;

try {
  auth = initializeAuth(app, {
    persistence: (AuthNS as any).getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

let _authReady: Promise<User | null> | null = null;

export function authReady(): Promise<User | null> {
  if (_authReady) return _authReady;

  _authReady = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  return _authReady;
}

export async function requireSignedInUser(): Promise<User> {
  const user = auth.currentUser ?? (await authReady());

  if (!user || user.isAnonymous) {
    throw new Error('Sign in required.');
  }

  return user;
}

export { app, auth, db, storage };
