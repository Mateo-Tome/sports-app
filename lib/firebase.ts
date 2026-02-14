// lib/firebase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import {
  getAuth,
  initializeAuth,
  signInAnonymously,
  type User,
} from 'firebase/auth';

// Namespace import so we can call getReactNativePersistence at runtime
import * as AuthNS from 'firebase/auth';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    // Crash early in dev if env isn't set (prevents weird auth behavior)
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

const firebaseConfig = {
  apiKey: requireEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requireEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

// ✅ Initialize Firebase app ONCE
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Initialize Auth ONCE with React Native persistence
// This is what keeps users logged in across app restarts (TestFlight + production)
let auth: ReturnType<typeof getAuth>;

try {
  auth = initializeAuth(app, {
    // getReactNativePersistence exists at runtime; TS can be annoying depending on versions
    persistence: (AuthNS as any).getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  // If Auth was already initialized (Fast Refresh / reload), reuse it
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export async function ensureAnonymous(): Promise<User> {
  if (!auth.currentUser) {
    const { user } = await signInAnonymously(auth);
    return user;
  }
  return auth.currentUser as User;
}

export { app, auth, db, storage };
