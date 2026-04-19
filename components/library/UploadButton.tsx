// components/library/UploadButton.tsx

import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { addDoc, collection, getFirestore } from "firebase/firestore";
import { app, auth, ensureAnonymous } from "../../lib/firebase";

import { testGetUploadUrl } from "../../lib/backend";
import {
  cancelActiveB2Upload,
  UploadCancelledError,
  uploadVideoToB2,
  type UploadProgress,
} from "../../lib/uploadVideoToB2";

import { computeSportColor } from "../../lib/sportColors/computeSportColor";

// -----------------------------
// Sidecar reader
// -----------------------------
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
    } catch {}

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
  } catch {}

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

// -----------------------------
// Props
// -----------------------------
type OldStyleProps = {
  row: {
    uri: string;
    athlete?: string;
    sport?: string;
    mtime?: number | null;
    assetId?: string | undefined;
  };
  mapKey?: string;
  uploaded?: boolean;
  onUploaded?: (cloudKey: string, url: string) => void;
  sidecar?: unknown;
};

export type UploadButtonProps = {
  localUri: string;
  sidecar?: unknown;
  uploaded?: boolean;
  onUploaded?: (cloudKey: string, url: string) => void;
};

type Props = UploadButtonProps | OldStyleProps;

type UploadState =
  | "idle"
  | "preparing"
  | "uploadingVideo"
  | "uploadingSidecar"
  | "savingMetadata"
  | "done"
  | "failed";

function randomShareId(length = 12): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function getCurrentOrAnonUser() {
  const current = auth.currentUser;
  if (current) return current;
  return await ensureAnonymous();
}

function isOldStyle(p: Props): p is OldStyleProps {
  return (p as any)?.row?.uri != null;
}

function safeString(v: any, fallback: string) {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length ? t : fallback;
}

function fileNameFromUri(uri: string) {
  const last = uri.split("/").pop();
  return last && last.length ? last : "video.mp4";
}

function stripExt(name: string) {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function clampNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

function getStatusLabel(state: UploadState) {
  switch (state) {
    case "preparing":
      return "Preparing clip…";
    case "uploadingVideo":
      return "Uploading video…";
    case "uploadingSidecar":
      return "Uploading stats…";
    case "savingMetadata":
      return "Saving clip…";
    case "done":
      return "Uploaded";
    case "failed":
      return "Upload failed";
    case "idle":
    default:
      return "Ready to upload";
  }
}

function isCancelledUploadError(err: any) {
  return (
    err instanceof UploadCancelledError ||
    err?.code === "UPLOAD_CANCELLED" ||
    err?.name === "UploadCancelledError" ||
    err?.message === "B2 upload cancelled"
  );
}

export function UploadButton(props: Props) {
  const normalized = useMemo(() => {
    if (isOldStyle(props)) {
      return {
        localUri: props.row.uri,
        sidecar: props.sidecar,
        uploaded: props.uploaded,
        onUploaded: props.onUploaded,
      };
    }
    return {
      localUri: (props as UploadButtonProps).localUri,
      sidecar: (props as UploadButtonProps).sidecar,
      uploaded: (props as UploadButtonProps).uploaded,
      onUploaded: (props as UploadButtonProps).onUploaded,
    };
  }, [props]);

  const { localUri, sidecar, uploaded, onUploaded } = normalized;

  const [state, setState] = useState<UploadState>(uploaded ? "done" : "idle");
  const [error, setError] = useState<string | undefined>();
  const [statusText, setStatusText] = useState<string>(
    getStatusLabel(uploaded ? "done" : "idle")
  );
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);
  const [sidecarProgress, setSidecarProgress] = useState<UploadProgress | null>(
    null
  );
  const [isCancelling, setIsCancelling] = useState(false);

  const inFlightRef = useRef(false);
  const cancelRequestedRef = useRef(false);

  useEffect(() => {
    const nextState: UploadState = uploaded ? "done" : "idle";
    setState(nextState);
    setStatusText(getStatusLabel(nextState));
    if (uploaded) {
      setError(undefined);
      setVideoProgress(null);
      setSidecarProgress(null);
      setIsCancelling(false);
      cancelRequestedRef.current = false;
      inFlightRef.current = false;
    }
  }, [uploaded]);

  const isBusy =
    state === "preparing" ||
    state === "uploadingVideo" ||
    state === "uploadingSidecar" ||
    state === "savingMetadata";

  const currentProgress =
    state === "uploadingSidecar" ? sidecarProgress : videoProgress;

  const showProgressBar =
    (state === "uploadingVideo" || state === "uploadingSidecar") &&
    !!currentProgress &&
    currentProgress.totalBytesExpectedToSend > 0;

  const canCancel =
    state === "uploadingVideo" || state === "uploadingSidecar";

  if (state === "done") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontWeight: "700", color: "white" }}>✅ Uploaded</Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "flex-start", gap: 6, minWidth: 180 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          disabled={isBusy}
          onPress={async (e: any) => {
            e?.stopPropagation?.();

            if (inFlightRef.current) return;

            inFlightRef.current = true;
            cancelRequestedRef.current = false;
            setError(undefined);
            setVideoProgress(null);
            setSidecarProgress(null);
            setIsCancelling(false);
            setState("preparing");
            setStatusText(getStatusLabel("preparing"));

            const current = auth.currentUser;
            console.log("[UploadButton] starting B2 upload for user:", {
              uid: current?.uid,
              email: current?.email,
              isAnonymous: current?.isAnonymous,
              localUri,
            });

            let tempVideoUri: string | null = null;

            try {
              const user = await getCurrentOrAnonUser();
              const now = Date.now();
              const shareId = randomShareId();

              setState("uploadingVideo");
              setStatusText(getStatusLabel("uploadingVideo"));

              tempVideoUri = await makeFreshTempUploadCopy(localUri, shareId, "mp4");

              const creds1: any = await testGetUploadUrl();
              if (!creds1?.uploadUrl || !creds1?.uploadAuthToken) {
                throw new Error(
                  `testGetUploadUrl missing creds1: ${JSON.stringify(creds1)}`
                );
              }

              const videoUpload = await uploadVideoToB2({
                uploadUrl: creds1.uploadUrl,
                uploadAuthToken: creds1.uploadAuthToken,
                uid: user.uid,
                localFileUri: tempVideoUri,
                originalFileName: `${shareId}.mp4`,
                mimeType: "video/mp4",
                onProgress: (p) => {
                  setVideoProgress(p);
                  setStatusText(`Uploading video… ${formatPercent(p.progress)}`);
                },
              });

              if (cancelRequestedRef.current) {
                throw new UploadCancelledError();
              }

              const b2VideoKey: string | null = videoUpload?.fileName ?? null;
              const b2VideoFileId: string | null = videoUpload?.fileId ?? null;

              let b2SidecarKey: string | null = null;
              let b2SidecarFileId: string | null = null;

              let fullSidecar = await readSidecarForUpload(localUri);
              if (!fullSidecar && sidecar && typeof sidecar === "object") {
                fullSidecar = sidecar as any;
              }

              if (fullSidecar) {
                setState("uploadingSidecar");
                setStatusText(getStatusLabel("uploadingSidecar"));
                setSidecarProgress(null);

                const jsonPath =
                  FileSystem.cacheDirectory + `sidecar-${shareId}.json`;

                const payload = {
                  ...fullSidecar,
                  uploadMeta: {
                    uploadedAt: now,
                    shareId,
                    b2VideoKey,
                    b2VideoFileId,
                    bucket: creds1.bucketName,
                  },
                };

                await FileSystem.writeAsStringAsync(
                  jsonPath,
                  JSON.stringify(payload),
                  {
                    encoding: FileSystem.EncodingType.UTF8,
                  }
                );

                const creds2: any = await testGetUploadUrl();
                if (!creds2?.uploadUrl || !creds2?.uploadAuthToken) {
                  throw new Error(
                    `testGetUploadUrl missing creds2: ${JSON.stringify(creds2)}`
                  );
                }

                const sidecarUpload = await uploadVideoToB2({
                  uploadUrl: creds2.uploadUrl,
                  uploadAuthToken: creds2.uploadAuthToken,
                  uid: user.uid,
                  localFileUri: jsonPath,
                  originalFileName: `${shareId}.json`,
                  mimeType: "application/json",
                  onProgress: (p) => {
                    setSidecarProgress(p);
                    setStatusText(`Uploading stats… ${formatPercent(p.progress)}`);
                  },
                });

                if (cancelRequestedRef.current) {
                  throw new UploadCancelledError();
                }

                b2SidecarKey = sidecarUpload?.fileName ?? null;
                b2SidecarFileId = sidecarUpload?.fileId ?? null;
              }

              if (cancelRequestedRef.current) {
                throw new UploadCancelledError();
              }

              setState("savingMetadata");
              setStatusText(getStatusLabel("savingMetadata"));

              try {
                const db = getFirestore(app);

                const localName = fileNameFromUri(localUri);
                const fallbackTitle = stripExt(localName);

                const athleteName = safeString(
                  fullSidecar?.athlete,
                  "Unassigned"
                );
                const sport = safeString(fullSidecar?.sport, "unknown");
                const style = safeString(fullSidecar?.style, "");
                const sportStyle =
                  style && style !== "unknown" ? `${sport}-${style}` : sport;

                let title = safeString(
                  fullSidecar?.displayName ?? fullSidecar?.title,
                  ""
                );

                if (!title) {
                  const createdMs =
                    typeof fullSidecar?.createdAt === "number"
                      ? fullSidecar.createdAt
                      : now;

                  const d = new Date(createdMs);
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

                const libraryStyle =
                  colorRes?.edgeColor ? { edgeColor: colorRes.edgeColor } : null;

                const docData: any = {
                  ownerUid: user.uid,

                  title,
                  athleteName,
                  sport,
                  style: style || null,
                  sportStyle: sportStyle || null,
                  originalFileName: localName,

                  createdAt: now,
                  updatedAt: now,

                  storageProvider: "b2",
                  b2Bucket: creds1.bucketName ?? "quickclip-videos",
                  b2VideoKey,
                  b2VideoFileId,
                  b2SidecarKey,
                  b2SidecarFileId,

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
                console.log("[UploadButton] created VideoDoc:", ref.id, docData);
              } catch (metaErr) {
                console.warn(
                  "[UploadButton] upload succeeded but metadata write failed:",
                  metaErr
                );
              }

              setState("done");
              setStatusText(getStatusLabel("done"));
              setVideoProgress(null);
              setSidecarProgress(null);
              setIsCancelling(false);
              cancelRequestedRef.current = false;
              inFlightRef.current = false;
              onUploaded?.(b2VideoKey ?? shareId, "b2://quickclip-videos");
            } catch (err: any) {
              console.log("[UploadButton(B2) error]", err);

              if (isCancelledUploadError(err) || cancelRequestedRef.current) {
                setError(undefined);
                setState("idle");
                setStatusText(getStatusLabel("idle"));
                setVideoProgress(null);
                setSidecarProgress(null);
                setIsCancelling(false);
                cancelRequestedRef.current = false;
                inFlightRef.current = false;
                return;
              }

              const msg = err?.message ?? "Upload failed";

              setError(msg);
              setState("failed");
              setStatusText(getStatusLabel("failed"));
              setIsCancelling(false);
              cancelRequestedRef.current = false;
              inFlightRef.current = false;

              Alert.alert(
                "Upload failed",
                msg || "Please try again while online."
              );
            } finally {
              if (tempVideoUri) {
                try {
                  await FileSystem.deleteAsync(tempVideoUri, {
                    idempotent: true,
                  });
                } catch {}
              }
            }
          }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor:
              state === "failed"
                ? "tomato"
                : isBusy
                ? "rgba(255,255,255,0.45)"
                : "white",
            backgroundColor:
              state === "failed"
                ? "rgba(255,99,71,0.12)"
                : isBusy
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.12)",
            opacity: isBusy ? 0.9 : 1,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            {isBusy
              ? "Uploading…"
              : state === "failed"
              ? "Retry Upload"
              : "Upload"}
          </Text>
        </Pressable>

        {isBusy && <ActivityIndicator color="white" size="small" />}

        {canCancel && (
          <Pressable
            onPress={(e: any) => {
              e?.stopPropagation?.();
              cancelRequestedRef.current = true;
              setIsCancelling(true);
              setStatusText("Cancelling…");
              cancelActiveB2Upload();
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              backgroundColor: "rgba(255,255,255,0.08)",
              opacity: isCancelling ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              {isCancelling ? "Cancelling…" : "Cancel"}
            </Text>
          </Pressable>
        )}
      </View>

      {(isBusy || state === "failed") && (
        <Text
          style={{
            color: state === "failed" ? "tomato" : "rgba(255,255,255,0.75)",
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {state === "failed" ? error || statusText : statusText}
        </Text>
      )}

      {showProgressBar && currentProgress && (
        <View style={{ width: 180, gap: 4 }}>
          <View
            style={{
              width: "100%",
              height: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.14)",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.max(
                  2,
                  Math.min(100, currentProgress.progress * 100)
                )}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: "white",
              }}
            />
          </View>

          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            {formatPercent(currentProgress.progress)} •{" "}
            {formatBytes(currentProgress.totalBytesSent)} /{" "}
            {formatBytes(currentProgress.totalBytesExpectedToSend)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default UploadButton;