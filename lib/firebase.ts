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

// ✅ Direct assignment ensures Expo can "find and replace" these during the build
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Optional: Log an error in dev if keys are missing without crashing the whole app
if (__DEV__ && !firebaseConfig.apiKey) {
  console.warn("Firebase configuration is missing. Check your .env file or EAS Secrets.");
}

// ✅ Initialize Firebase app ONCE
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Initialize Auth ONCE with React Native persistence
let auth: ReturnType<typeof getAuth>;

try {
  auth = initializeAuth(app, {
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
