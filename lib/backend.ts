// lib/backend.ts
import { auth } from "./firebase";

const FUNCTION_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/getUploadUrl";

export async function testGetUploadUrl() {
  const user = auth.currentUser;
  if (!user) throw new Error("No Firebase user (call ensureAnonymous/sign in first).");

  const idToken = await user.getIdToken();

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

  console.log("[testGetUploadUrl] Response status:", res.status);
  console.log("[testGetUploadUrl] Response body:", data);

  if (!res.ok) {
    throw new Error(
      `getUploadUrl failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  // ✅ THIS is what your new test needs
  return data;
}
