import * as FileSystem from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import { addDoc, collection, getFirestore } from "firebase/firestore";

import { testGetUploadUrl } from "../backend";
import { app, auth, ensureAnonymous } from "../firebase";
import { computeSportColor } from "../sportColors/computeSportColor";
import {
  UploadCancelledError,
  uploadVideoToB2,
  type UploadProgress,
} from "../uploadVideoToB2";

export type UploadClipPhase =
  | "preparing"
  | "uploadingVideo"
  | "uploadingThumbnail"
  | "uploadingSidecar"
  | "savingMetadata";

export type UploadClipProgressEvent = {
  phase: UploadClipPhase;
  progress?: UploadProgress | null;
  message?: string;
};

export type UploadClipToCloudParams = {
  localUri: string;
  sidecar?: unknown;
  onProgress?: (event: UploadClipProgressEvent) => void;
  isCancelRequested?: () => boolean;
};

export type UploadClipToCloudResult = {
  shareId: string;
  b2VideoKey: string | null;
  b2VideoFileId: string | null;
  b2SidecarKey: string | null;
  b2SidecarFileId: string | null;
  b2ThumbnailKey: string | null;
  b2ThumbnailFileId: string | null;
  thumbnailUrl: string | null;
  cloudKey: string;
  url: string;
};

async function getCurrentOrAnonUser() {
  const current = auth.currentUser;
  if (current) return current;
  return await ensureAnonymous();
}

function randomShareId(length = 12): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function fileNameFromUri(uri: string) {
  const last = uri.split("/").pop();
  return last && last.length ? last : "video.mp4";
}

function stripExt(name: string) {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function safeString(v: any, fallback: string) {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length ? t : fallback;
}

function clampNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function throwIfCancelled(isCancelRequested?: () => boolean) {
  if (isCancelRequested?.()) {
    throw new UploadCancelledError();
  }
}

function b2FriendlyUrl(bucketName: string | null | undefined, key: string | null | undefined) {
  const bucket = String(bucketName ?? "quickclip-videos").trim();
  const fileKey = String(key ?? "").trim();
  if (!bucket || !fileKey) return null;

  return `https://f005.backblazeb2.com/file/${encodeURIComponent(bucket)}/${fileKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function readSidecarForUpload(videoUri: string): Promise<any | null> {
  try {
    const lastSlash = videoUri.lastIndexOf("/");
    const lastDot = videoUri.lastIndexOf(".");
    const base = lastDot > lastSlash ? videoUri.slice(0, lastDot) : videoUri;
    const guess = `${base}.json`;

    const tryRead = async (p: string): Promise<any | null> => {
      const info: any = await FileSystem.getInfoAsync(p);
      if (!info?.exists) return null;
      const txt = await FileSystem.readAsStringAsync(p);
      return txt ? JSON.parse(txt) : {};
    };

    let sc: any | null = await tryRead(guess);
    if (sc) return sc;

    const dir = videoUri.slice(0, lastSlash + 1);
    try {
      // @ts-ignore
      const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
      const baseName = base.slice(lastSlash + 1);
      const candidate = files.find(
        (f) => f.toLowerCase() === `${baseName.toLowerCase()}.json`
      );
      if (candidate) {
        sc = await tryRead(dir + candidate);
        if (sc) return sc;
      }
    } catch { }

    return null;
  } catch (e) {
    console.log("readSidecarForUpload error", e);
    return null;
  }
}

async function makeFreshTempUploadCopy(
  sourceUri: string,
  shareId: string,
  extension = "mp4"
): Promise<string> {
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("No writable cache/document directory available");
  }

  const tempUri = `${baseDir}upload-${shareId}.${extension}`;

  try {
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
  } catch { }

  await FileSystem.copyAsync({
    from: sourceUri,
    to: tempUri,
  });

  const info: any = await FileSystem.getInfoAsync(tempUri);
  if (!info?.exists) {
    throw new Error("Failed to prepare temp upload copy");
  }

  return tempUri;
}

async function makeUploadThumbnail(videoUri: string, shareId: string): Promise<string | null> {
  try {
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) return null;

    let generated: { uri: string } | null = null;

    try {
      generated = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 900,
        quality: 0.7,
      });
    } catch {
      generated = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0,
        quality: 0.7,
      });
    }

    if (!generated?.uri) return null;

    const dest = `${baseDir}thumb-${shareId}.jpg`;

    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch { }

    await FileSystem.copyAsync({ from: generated.uri, to: dest });

    const info: any = await FileSystem.getInfoAsync(dest);
    return info?.exists ? dest : null;
  } catch (e) {
    console.log("[uploadClipToCloud] thumbnail generation failed", e);
    return null;
  }
}

function computeScoreBits(fullSidecar: any | null): {
  scoreFor: number | null;
  scoreAgainst: number | null;
  result: "W" | "L" | "T" | null;
  scoreText: string | null;
  homeIsAthlete: boolean | null;
  finalScore: { home: number; opponent: number } | null;
} {
  try {
    if (!fullSidecar) {
      return {
        scoreFor: null,
        scoreAgainst: null,
        result: null,
        scoreText: null,
        homeIsAthlete: null,
        finalScore: null,
      };
    }

    const homeIsAthlete =
      typeof fullSidecar.homeIsAthlete === "boolean"
        ? fullSidecar.homeIsAthlete
        : null;

    const fs = fullSidecar.finalScore;
    const home = clampNum(fs?.home);
    const opp = clampNum(fs?.opponent);

    if (home == null || opp == null || homeIsAthlete == null) {
      return {
        scoreFor: null,
        scoreAgainst: null,
        result: null,
        scoreText: null,
        homeIsAthlete,
        finalScore:
          home != null && opp != null ? { home, opponent: opp } : null,
      };
    }

    const scoreFor = homeIsAthlete ? home : opp;
    const scoreAgainst = homeIsAthlete ? opp : home;

    const result: "W" | "L" | "T" =
      scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "T";

    const scoreText = `${result} ${scoreFor}\u2013${scoreAgainst}`;

    return {
      scoreFor,
      scoreAgainst,
      result,
      scoreText,
      homeIsAthlete,
      finalScore: { home, opponent: opp },
    };
  } catch {
    return {
      scoreFor: null,
      scoreAgainst: null,
      result: null,
      scoreText: null,
      homeIsAthlete: null,
      finalScore: null,
    };
  }
}

export async function uploadClipToCloud({
  localUri,
  sidecar,
  onProgress,
  isCancelRequested,
}: UploadClipToCloudParams): Promise<UploadClipToCloudResult> {
  let tempVideoUri: string | null = null;
  let tempThumbUri: string | null = null;
  let tempJsonPath: string | null = null;

  try {
    onProgress?.({ phase: "preparing", message: "Preparing clip…" });

    const user = await getCurrentOrAnonUser();
    const now = Date.now();
    const shareId = randomShareId();

    throwIfCancelled(isCancelRequested);

    tempThumbUri = await makeUploadThumbnail(localUri, shareId);

    onProgress?.({ phase: "uploadingVideo", message: "Uploading video…" });

    tempVideoUri = await makeFreshTempUploadCopy(localUri, shareId, "mp4");

    const tempVideoInfo: any = await FileSystem.getInfoAsync(tempVideoUri);
    const fileSizeBytes =
      typeof tempVideoInfo?.size === "number" && Number.isFinite(tempVideoInfo.size)
        ? tempVideoInfo.size
        : null;

    const creds1: any = await testGetUploadUrl();
    if (!creds1?.uploadUrl || !creds1?.uploadAuthToken) {
      throw new Error(`testGetUploadUrl missing creds1: ${JSON.stringify(creds1)}`);
    }

    const videoUpload = await uploadVideoToB2({
      uploadUrl: creds1.uploadUrl,
      uploadAuthToken: creds1.uploadAuthToken,
      uid: user.uid,
      localFileUri: tempVideoUri,
      originalFileName: `${shareId}.mp4`,
      mimeType: "video/mp4",
      onProgress: (p) => {
        onProgress?.({
          phase: "uploadingVideo",
          progress: p,
          message: "Uploading video…",
        });
      },
    });

    throwIfCancelled(isCancelRequested);

    const b2VideoKey: string | null = videoUpload?.fileName ?? null;
    const b2VideoFileId: string | null = videoUpload?.fileId ?? null;

    let b2ThumbnailKey: string | null = null;
    let b2ThumbnailFileId: string | null = null;
    let thumbnailUrl: string | null = null;

    if (tempThumbUri) {
      onProgress?.({ phase: "uploadingThumbnail", message: "Uploading thumbnail…" });

      try {
        const credsThumb: any = await testGetUploadUrl();
        if (!credsThumb?.uploadUrl || !credsThumb?.uploadAuthToken) {
          throw new Error(`testGetUploadUrl missing thumbnail creds: ${JSON.stringify(credsThumb)}`);
        }

        const thumbUpload = await uploadVideoToB2({
          uploadUrl: credsThumb.uploadUrl,
          uploadAuthToken: credsThumb.uploadAuthToken,
          uid: user.uid,
          localFileUri: tempThumbUri,
          originalFileName: `${shareId}.jpg`,
          mimeType: "image/jpeg",
        });

        b2ThumbnailKey = thumbUpload?.fileName ?? null;
        b2ThumbnailFileId = thumbUpload?.fileId ?? null;
        thumbnailUrl = b2FriendlyUrl(credsThumb.bucketName ?? creds1.bucketName, b2ThumbnailKey);
      } catch (thumbErr) {
        console.warn("[uploadClipToCloud] thumbnail upload failed; continuing without thumbnail", thumbErr);
      }
    }

    let b2SidecarKey: string | null = null;
    let b2SidecarFileId: string | null = null;

    let fullSidecar = await readSidecarForUpload(localUri);
    if (!fullSidecar && sidecar && typeof sidecar === "object") {
      fullSidecar = sidecar as any;
    }

    if (fullSidecar) {
      onProgress?.({ phase: "uploadingSidecar", message: "Uploading stats…" });

      const jsonPath = FileSystem.cacheDirectory + `sidecar-${shareId}.json`;
      tempJsonPath = jsonPath;

      const payload = {
        ...fullSidecar,
        uploadMeta: {
          uploadedAt: now,
          shareId,
          b2VideoKey,
          b2VideoFileId,
          b2ThumbnailKey,
          b2ThumbnailFileId,
          thumbnailUrl,
          bucket: creds1.bucketName,
        },
      };

      await FileSystem.writeAsStringAsync(jsonPath, JSON.stringify(payload), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const creds2: any = await testGetUploadUrl();
      if (!creds2?.uploadUrl || !creds2?.uploadAuthToken) {
        throw new Error(`testGetUploadUrl missing creds2: ${JSON.stringify(creds2)}`);
      }

      const sidecarUpload = await uploadVideoToB2({
        uploadUrl: creds2.uploadUrl,
        uploadAuthToken: creds2.uploadAuthToken,
        uid: user.uid,
        localFileUri: jsonPath,
        originalFileName: `${shareId}.json`,
        mimeType: "application/json",
        onProgress: (p) => {
          onProgress?.({
            phase: "uploadingSidecar",
            progress: p,
            message: "Uploading stats…",
          });
        },
      });

      throwIfCancelled(isCancelRequested);

      b2SidecarKey = sidecarUpload?.fileName ?? null;
      b2SidecarFileId = sidecarUpload?.fileId ?? null;
    }

    throwIfCancelled(isCancelRequested);

    onProgress?.({ phase: "savingMetadata", message: "Saving clip…" });

    try {
      const db = getFirestore(app);

      const localName = fileNameFromUri(localUri);
      const fallbackTitle = stripExt(localName);

      const athleteName = safeString(fullSidecar?.athlete, "Unassigned");
      const sport = safeString(fullSidecar?.sport, "unknown");
      const style = safeString(fullSidecar?.style, "");
      const sportStyle =
        style && style !== "unknown" ? `${sport}-${style}` : sport;

      const recordedAt =
        typeof fullSidecar?.createdAt === "number" &&
          Number.isFinite(fullSidecar.createdAt)
          ? fullSidecar.createdAt
          : now;

      let title = safeString(fullSidecar?.displayName ?? fullSidecar?.title, "");

      if (!title) {
        const d = new Date(recordedAt);
        const datePart = d.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
        const timePart = d.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });

        title = `${athleteName} • ${sportStyle} • ${datePart} at ${timePart}`;
      }

      if (!title.trim()) title = fallbackTitle;

      const scoreBits = computeScoreBits(fullSidecar);

      const scSport = String(fullSidecar?.sport ?? sport ?? "");
      const scEvents = Array.isArray(fullSidecar?.events)
        ? fullSidecar.events
        : [];
      const scHomeIsAthlete =
        typeof fullSidecar?.homeIsAthlete === "boolean"
          ? fullSidecar.homeIsAthlete
          : true;

      const colorRes = computeSportColor(
        {
          sport: scSport,
          events: scEvents,
          homeIsAthlete: scHomeIsAthlete,
        },
        scoreBits.result ?? null,
        false,
        scoreBits.finalScore
      );

      const libraryStyle = colorRes?.edgeColor
        ? { edgeColor: colorRes.edgeColor }
        : null;

      const docData: any = {
        ownerUid: user.uid,

        title,
        athleteName,
        sport,
        style: style || null,
        sportStyle: sportStyle || null,
        originalFileName: localName,

        createdAt: recordedAt,
        uploadedAt: now,
        updatedAt: now,

        storageProvider: "b2",
        b2Bucket: creds1.bucketName ?? "quickclip-videos",
        videoSizeBytes: fileSizeBytes,
        sizeBytes: fileSizeBytes,
        b2VideoKey,
        b2VideoFileId,
        b2SidecarKey,
        b2SidecarFileId,

        b2ThumbnailKey,
        b2ThumbnailFileId,
        thumbnailUrl,
        thumbUri: thumbnailUrl,

        shareId,
        isPublic: true,

        result: scoreBits.result,
        scoreFor: scoreBits.scoreFor,
        scoreAgainst: scoreBits.scoreAgainst,
        scoreText: scoreBits.scoreText,
        homeIsAthlete: scoreBits.homeIsAthlete,
        finalScore: scoreBits.finalScore,

        libraryStyle,

        edgeColor: colorRes?.edgeColor ?? null,
        highlightGold: !!colorRes?.highlightGold,
      };

      const ref = await addDoc(collection(db, "videos"), docData);
      console.log("[uploadClipToCloud] created VideoDoc:", ref.id, docData);
    } catch (metaErr) {
      console.warn(
        "[uploadClipToCloud] upload succeeded but metadata write failed:",
        metaErr
      );
    }

    return {
      shareId,
      b2VideoKey,
      b2VideoFileId,
      b2SidecarKey,
      b2SidecarFileId,
      b2ThumbnailKey,
      b2ThumbnailFileId,
      thumbnailUrl,
      cloudKey: b2VideoKey ?? shareId,
      url: "b2://quickclip-videos",
    };
  } finally {
    if (tempVideoUri) {
      try {
        await FileSystem.deleteAsync(tempVideoUri, {
          idempotent: true,
        });
      } catch { }
    }

    if (tempThumbUri) {
      try {
        await FileSystem.deleteAsync(tempThumbUri, {
          idempotent: true,
        });
      } catch { }
    }

    if (tempJsonPath) {
      try {
        await FileSystem.deleteAsync(tempJsonPath, {
          idempotent: true,
        });
      } catch { }
    }
  }
}