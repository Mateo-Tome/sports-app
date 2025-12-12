// src/lib/uploadVideoToB2.ts
import * as FileSystem from "expo-file-system";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type UploadToB2Params = {
  uploadUrl: string;
  uploadAuthToken: string;
  uid: string;
  localFileUri: string;        // file:///...
  originalFileName?: string;   // optional
  mimeType?: string;           // optional (default video/mp4)
};

export async function uploadVideoToB2({
  uploadUrl,
  uploadAuthToken,
  uid,
  localFileUri,
  originalFileName,
  mimeType = "video/mp4",
}: UploadToB2Params) {
  const fileName = sanitizeFileName(
    originalFileName ?? `clip-${Date.now()}.mp4`
  );

  // Backblaze expects a *path-like* file name. No scheme, no leading slash.
  const b2FileName = `videos/${uid}/${fileName}`;

  // uploadAsync wants plain header strings (no objects/arrays)
  const headers: Record<string, string> = {
    Authorization: uploadAuthToken,
    "X-Bz-File-Name": encodeURIComponent(b2FileName),
    "Content-Type": mimeType,
    // Easiest for now; later you can compute SHA1 or use large-file flow
    "X-Bz-Content-Sha1": "do_not_verify",
  };

  const result = await FileSystem.uploadAsync(uploadUrl, localFileUri, {
    httpMethod: "POST",
    headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  // Backblaze returns JSON on success
  let json: any = null;
  try {
    json = JSON.parse(result.body || "{}");
  } catch {}

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `B2 upload failed (${result.status}): ${result.body || JSON.stringify(json)}`
    );
  }

  return json; // contains fileId, fileName, contentLength, etc.
}
