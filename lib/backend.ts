// lib/backend.ts
import { auth } from "./firebase";

// ✅ Gen 2 (Cloud Run) URL from Firebase Console:
const FUNCTION_URL = "https://getuploadurl-2e3yl7gxaq-uc.a.run.app";

export async function testGetUploadUrl() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No Firebase user (sign in or call ensureAnonymous first).");
  }

  // Force refresh so you don’t get a stale token
  const idToken = await user.getIdToken(true);

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("[testGetUploadUrl] URL:", FUNCTION_URL);
  console.log("[testGetUploadUrl] status:", res.status);
  console.log("[testGetUploadUrl] body:", data);

  if (!res.ok) {
    throw new Error(`getUploadUrl failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}
