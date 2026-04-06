// lib/backend.ts
import { auth } from "./firebase";

// Existing deployed upload URL
const UPLOAD_FUNCTION_URL = "https://getuploadurl-2e3yl7gxaq-uc.a.run.app";

// New delete function you just deployed
const DELETE_VIDEO_FUNCTION_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/deleteVideo";

async function getFreshIdToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No Firebase user (sign in or call ensureAnonymous first).");
  }
  return await user.getIdToken(true);
}

export async function testGetUploadUrl() {
  const idToken = await getFreshIdToken();

  const res = await fetch(UPLOAD_FUNCTION_URL, {
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

  console.log("[testGetUploadUrl] URL:", UPLOAD_FUNCTION_URL);
  console.log("[testGetUploadUrl] status:", res.status);
  console.log("[testGetUploadUrl] body:", data);

  if (!res.ok) {
    throw new Error(`getUploadUrl failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

export async function deleteCloudVideo(videoId: string) {
  const cleanVideoId = String(videoId ?? "").trim();
  if (!cleanVideoId) {
    throw new Error("Missing videoId");
  }

  const idToken = await getFreshIdToken();

  const res = await fetch(DELETE_VIDEO_FUNCTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ videoId: cleanVideoId }),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("[deleteCloudVideo] URL:", DELETE_VIDEO_FUNCTION_URL);
  console.log("[deleteCloudVideo] status:", res.status);
  console.log("[deleteCloudVideo] body:", data);

  if (!res.ok) {
    throw new Error(`deleteVideo failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}