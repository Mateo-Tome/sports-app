// src/lib/uploadVideoToB2.ts

import * as FileSystem from "expo-file-system";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export type UploadProgress = {
  totalBytesSent: number;
  totalBytesExpectedToSend: number;
  progress: number; // 0..1
};

type UploadToB2Params = {
  uploadUrl: string;
  uploadAuthToken: string;
  uid: string;
  localFileUri: string; // file:///...
  originalFileName?: string;
  mimeType?: string; // default video/mp4
  onProgress?: (progress: UploadProgress) => void;
};

type UploadVideoToB2Result = {
  fileId?: string | null;
  fileName?: string | null;
  contentLength?: number | null;
  raw: any;
};

export class UploadCancelledError extends Error {
  code: string;

  constructor(message = "B2 upload cancelled") {
    super(message);
    this.name = "UploadCancelledError";
    this.code = "UPLOAD_CANCELLED";
  }
}

export function cancelActiveB2Upload() {
  // uploadAsync does not give us a reliable cancel handle here.
  // Keep this as a no-op so the UI can safely call it without crashing.
  console.log("[uploadVideoToB2] cancelActiveB2Upload not supported in current transport");
}

export async function uploadVideoToB2({
  uploadUrl,
  uploadAuthToken,
  uid,
  localFileUri,
  originalFileName,
  mimeType = "video/mp4",
  onProgress,
}: UploadToB2Params): Promise<UploadVideoToB2Result> {
  const fileName = sanitizeFileName(
    originalFileName ?? `clip-${Date.now()}.mp4`
  );

  const b2FileName = `videos/${uid}/${fileName}`;

  const headers: Record<string, string> = {
    Authorization: uploadAuthToken,
    "X-Bz-File-Name": encodeURIComponent(b2FileName),
    "Content-Type": mimeType,
    "X-Bz-Content-Sha1": "do_not_verify",
  };

  const result = await FileSystem.uploadAsync(uploadUrl, localFileUri, {
    httpMethod: "POST",
    headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  let json: any = null;
  try {
    json = JSON.parse(result.body || "{}");
  } catch {
    json = { raw: result.body };
  }

  if (typeof onProgress === "function") {
    // We do not get true streaming progress from uploadAsync here.
    // Fire a final completed state so UI does not break.
    onProgress({
      totalBytesSent: 1,
      totalBytesExpectedToSend: 1,
      progress: 1,
    });
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `B2 upload failed (${result.status}): ${result.body || JSON.stringify(json)}`
    );
  }

  return {
    fileId: json?.fileId ?? null,
    fileName: json?.fileName ?? null,
    contentLength: json?.contentLength ?? null,
    raw: json,
  };
}