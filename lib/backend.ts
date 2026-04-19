// lib/backend.ts
import { auth } from "./firebase";

// Existing deployed simple upload URL (keep for fallback / transition)
const UPLOAD_FUNCTION_URL = "https://getuploadurl-2e3yl7gxaq-uc.a.run.app";

// Existing delete function
const DELETE_VIDEO_FUNCTION_URL =
  "https://deletevideo-2e3yl7gxaq-uc.a.run.app";

// New large-upload endpoints
const START_LARGE_VIDEO_UPLOAD_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/startLargeVideoUpload";

const GET_LARGE_VIDEO_UPLOAD_PART_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/getLargeVideoUploadPartUrl";

const FINISH_LARGE_VIDEO_UPLOAD_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/finishLargeVideoUpload";

const LIST_LARGE_VIDEO_PARTS_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/listLargeVideoParts";

const CANCEL_LARGE_VIDEO_UPLOAD_URL =
  "https://us-central1-sports-app-9efb3.cloudfunctions.net/cancelLargeVideoUpload";

async function getFreshIdToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No Firebase user (sign in or call ensureAnonymous first).");
  }
  return await user.getIdToken(true);
}

async function authedJsonFetch(url: string, body: unknown) {
  const idToken = await getFreshIdToken();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { res, data };
}

export async function testGetUploadUrl() {
  const { res, data } = await authedJsonFetch(UPLOAD_FUNCTION_URL, {});

  console.log("[testGetUploadUrl] URL:", UPLOAD_FUNCTION_URL);
  console.log("[testGetUploadUrl] status:", res.status);
  console.log("[testGetUploadUrl] body:", data);

  if (!res.ok) {
    throw new Error(`getUploadUrl failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

export async function startLargeVideoUpload(params: {
  originalFileName: string;
  mimeType?: string;
}) {
  const cleanName = String(params.originalFileName ?? "").trim();
  const mimeType = String(params.mimeType ?? "video/mp4").trim() || "video/mp4";

  if (!cleanName) {
    throw new Error("Missing originalFileName");
  }

  const { res, data } = await authedJsonFetch(START_LARGE_VIDEO_UPLOAD_URL, {
    originalFileName: cleanName,
    mimeType,
  });

  console.log("[startLargeVideoUpload] URL:", START_LARGE_VIDEO_UPLOAD_URL);
  console.log("[startLargeVideoUpload] status:", res.status);
  console.log("[startLargeVideoUpload] body:", data);

  if (!res.ok) {
    throw new Error(
      `startLargeVideoUpload failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as {
    ok: true;
    fileId: string;
    fileName: string;
    recommendedPartSize?: number;
    absoluteMinimumPartSize?: number;
  };
}

export async function getLargeVideoUploadPartUrl(fileId: string) {
  const cleanFileId = String(fileId ?? "").trim();
  if (!cleanFileId) {
    throw new Error("Missing fileId");
  }

  const { res, data } = await authedJsonFetch(GET_LARGE_VIDEO_UPLOAD_PART_URL, {
    fileId: cleanFileId,
  });

  console.log("[getLargeVideoUploadPartUrl] URL:", GET_LARGE_VIDEO_UPLOAD_PART_URL);
  console.log("[getLargeVideoUploadPartUrl] status:", res.status);
  console.log("[getLargeVideoUploadPartUrl] body:", data);

  if (!res.ok) {
    throw new Error(
      `getLargeVideoUploadPartUrl failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as {
    ok: true;
    uploadUrl: string;
    uploadAuthToken: string;
  };
}

export async function finishLargeVideoUpload(params: {
  fileId: string;
  partSha1Array: string[];
}) {
  const cleanFileId = String(params.fileId ?? "").trim();
  const partSha1Array = Array.isArray(params.partSha1Array)
    ? params.partSha1Array.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  if (!cleanFileId) {
    throw new Error("Missing fileId");
  }
  if (!partSha1Array.length) {
    throw new Error("Missing partSha1Array");
  }

  const { res, data } = await authedJsonFetch(FINISH_LARGE_VIDEO_UPLOAD_URL, {
    fileId: cleanFileId,
    partSha1Array,
  });

  console.log("[finishLargeVideoUpload] URL:", FINISH_LARGE_VIDEO_UPLOAD_URL);
  console.log("[finishLargeVideoUpload] status:", res.status);
  console.log("[finishLargeVideoUpload] body:", data);

  if (!res.ok) {
    throw new Error(
      `finishLargeVideoUpload failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as {
    ok: true;
    fileId: string;
    fileName: string;
    contentLength?: number | null;
    contentSha1?: string | null;
  };
}

export async function listLargeVideoParts(fileId: string) {
  const cleanFileId = String(fileId ?? "").trim();
  if (!cleanFileId) {
    throw new Error("Missing fileId");
  }

  const { res, data } = await authedJsonFetch(LIST_LARGE_VIDEO_PARTS_URL, {
    fileId: cleanFileId,
  });

  console.log("[listLargeVideoParts] URL:", LIST_LARGE_VIDEO_PARTS_URL);
  console.log("[listLargeVideoParts] status:", res.status);
  console.log("[listLargeVideoParts] body:", data);

  if (!res.ok) {
    throw new Error(
      `listLargeVideoParts failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as {
    ok: true;
    parts: Array<{
      partNumber: number;
      contentLength?: number;
      contentSha1?: string;
    }>;
    nextPartNumber?: number | null;
  };
}

export async function cancelLargeVideoUpload(fileId: string) {
  const cleanFileId = String(fileId ?? "").trim();
  if (!cleanFileId) {
    throw new Error("Missing fileId");
  }

  const { res, data } = await authedJsonFetch(CANCEL_LARGE_VIDEO_UPLOAD_URL, {
    fileId: cleanFileId,
  });

  console.log("[cancelLargeVideoUpload] URL:", CANCEL_LARGE_VIDEO_UPLOAD_URL);
  console.log("[cancelLargeVideoUpload] status:", res.status);
  console.log("[cancelLargeVideoUpload] body:", data);

  if (!res.ok) {
    throw new Error(
      `cancelLargeVideoUpload failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data as {
    ok: true;
    fileId: string;
    fileName?: string | null;
  };
}

export async function deleteCloudVideo(videoId: string) {
  const cleanVideoId = String(videoId ?? "").trim();
  if (!cleanVideoId) {
    throw new Error("Missing videoId");
  }

  const { res, data } = await authedJsonFetch(DELETE_VIDEO_FUNCTION_URL, {
    videoId: cleanVideoId,
  });

  console.log("[deleteCloudVideo] URL:", DELETE_VIDEO_FUNCTION_URL);
  console.log("[deleteCloudVideo] status:", res.status);
  console.log("[deleteCloudVideo] body:", data);

  if (!res.ok) {
    throw new Error(`deleteVideo failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}