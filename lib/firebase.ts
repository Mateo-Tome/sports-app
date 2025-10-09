// lib/firebase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

// Keep the typed imports you need:
import {
  getAuth,
  initializeAuth,
  signInAnonymously,
  type User,
} from 'firebase/auth';

// 👇 Bring in the whole auth namespace to access getReactNativePersistence
// without TS yelling about the named export. At runtime it's there.
import * as AuthNS from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Use RN persistence so the anon user survives app restarts
const auth = (() => {
  try {
    return initializeAuth(app, {
      // TS workaround; function exists at runtime on Firebase v12+
      persistence: (AuthNS as any).getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // If already initialized elsewhere, fall back
    return getAuth(app);
  }
})();

const storage = getStorage(app);

export async function ensureAnonymous(): Promise<User> {
  if (!auth.currentUser) {
    const { user } = await signInAnonymously(auth);
    return user;
  }
  return auth.currentUser as User;
}

export { app, auth, storage };
