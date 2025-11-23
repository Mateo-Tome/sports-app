// lib/firebase.ts
// LOCAL-ONLY SHIM
// -------------------------
// This replaces real Firebase usage so the app can run
// completely offline / local-only without auth warnings.
//
// Anything that imports `ensureAnonymous`, `auth`, or `storage`
// will still get something back, but no network calls happen.

export type LocalUser = {
  uid: string;
  isAnonymous: boolean;
};

// Fake "anonymous" user creator
export async function ensureAnonymous(): Promise<LocalUser> {
  console.log('[firebase] ensureAnonymous: Firebase disabled (local-only mode)');
  return {
    uid: 'local-only-user',
    isAnonymous: true,
  };
}

// Dummy exports so old imports don’t crash
// e.g. `import { auth } from "@/lib/firebase";`
export const app = null as any;
export const auth = null as any;
export const storage = null as any;
