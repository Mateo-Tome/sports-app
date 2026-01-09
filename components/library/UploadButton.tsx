// components/library/UploadButton.tsx

import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { addDoc, collection, getFirestore } from "firebase/firestore";
import { app, auth, ensureAnonymous } from "../../lib/firebase";

import { testGetUploadUrl } from "../../lib/backend";
import { uploadVideoToB2 } from "../../lib/uploadVideoToB2";

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

    // 1) Try same-name sidecar first
    let sc: any | null = await tryRead(guess);
    if (sc) return sc;

    // 2) Fallback: look in same directory for a matching .json
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

// -----------------------------
// Props: support BOTH styles
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

// random shareId
function randomShareId(length = 12): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Ensure we have a user
async function getCurrentOrAnonUser() {
  const current = auth.currentUser;
  if (current) return current;
  return await ensureAnonymous();
}

function isOldStyle(p: Props): p is OldStyleProps {
  return (p as any)?.row?.uri != null;
}

// small helpers
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

    const scoreText = `${result} ${scoreFor}\u2013${scoreAgainst}`; // en-dash

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

  const [state, setState] = useState<"idle" | "uploading" | "done">(
    uploaded ? "done" : "idle"
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setState(uploaded ? "done" : "idle");
  }, [uploaded]);

  if (state === "done") {
    return <Text style={{ fontWeight: "600", color: "white" }}>✅ Uploaded</Text>;
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        onPress={async (e: any) => {
          e?.stopPropagation?.();

          setError(undefined);
          setState("uploading");

          const current = auth.currentUser;
          console.log("[UploadButton] starting B2 upload for user:", {
            uid: current?.uid,
            email: current?.email,
            isAnonymous: current?.isAnonymous,
            localUri,
          });

          try {
            const user = await getCurrentOrAnonUser();
            const now = Date.now();
            const shareId = randomShareId();

            // -----------------------------
            // 1) Upload VIDEO to B2
            // -----------------------------
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
              localFileUri: localUri,
              originalFileName: `${shareId}.mp4`,
              mimeType: "video/mp4",
            });

            const b2VideoKey: string | null = videoUpload?.fileName ?? null;
            const b2VideoFileId: string | null = videoUpload?.fileId ?? null;

            // -----------------------------
            // 2) Load + upload SIDECAR JSON (optional)
            // -----------------------------
            let b2SidecarKey: string | null = null;
            let b2SidecarFileId: string | null = null;

            let fullSidecar = await readSidecarForUpload(localUri);
            if (!fullSidecar && sidecar && typeof sidecar === "object") {
              fullSidecar = sidecar as any;
            }

            if (fullSidecar) {
              const jsonPath = FileSystem.cacheDirectory + `sidecar-${shareId}.json`;

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

              await FileSystem.writeAsStringAsync(jsonPath, JSON.stringify(payload), {
                encoding: FileSystem.EncodingType.UTF8,
              });

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
              });

              b2SidecarKey = sidecarUpload?.fileName ?? null;
              b2SidecarFileId = sidecarUpload?.fileId ?? null;
            }

            // -----------------------------
            // 3) Write Firestore metadata
            // -----------------------------
            try {
              const db = getFirestore(app);

              const localName = fileNameFromUri(localUri);
              const fallbackTitle = stripExt(localName);

              const athleteName = safeString(fullSidecar?.athlete, "Unassigned");
              const sport = safeString(fullSidecar?.sport, "unknown");
              const style = safeString(fullSidecar?.style, "");
              const sportStyle =
                style && style !== "unknown" ? `${sport}-${style}` : sport;

              // Prefer sidecar-provided title/displayName if present
              let title = safeString(
                fullSidecar?.displayName ?? fullSidecar?.title,
                ""
              );

              // If missing, generate a pretty title (so it doesn't fall back to filename)
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

              // Final fallback (rare)
              if (!title.trim()) title = fallbackTitle;

              // ✅ derive score + result from sidecar
              const scoreBits = computeScoreBits(fullSidecar);

              const docData: any = {
                ownerUid: user.uid,

                // display fields
                title,
                athleteName,
                sport,
                style: style || null,
                sportStyle: sportStyle || null,
                originalFileName: localName,

                // timestamps
                createdAt: now,
                updatedAt: now,

                // storage
                storageProvider: "b2",
                b2Bucket: creds1.bucketName ?? "quickclip-videos",
                b2VideoKey,
                b2VideoFileId,
                b2SidecarKey,
                b2SidecarFileId,

                shareId,
                isPublic: true,

                // ✅ fields web can use for the score pill
                result: scoreBits.result,
                scoreFor: scoreBits.scoreFor,
                scoreAgainst: scoreBits.scoreAgainst,
                scoreText: scoreBits.scoreText,

                // optional: keep raw score info
                homeIsAthlete: scoreBits.homeIsAthlete,
                finalScore: scoreBits.finalScore,
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
            onUploaded?.(b2VideoKey ?? shareId, "b2://quickclip-videos");
          } catch (err: any) {
            console.log("UploadButton(B2) error", err);
            setError(err?.message ?? "Upload failed");
            setState("idle");
            Alert.alert(
              "Upload failed",
              err?.message ?? "Please try again while online."
            );
          }
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "white",
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {state === "uploading" ? "Uploading…" : "Upload"}
        </Text>
      </Pressable>

      {state === "uploading" && <ActivityIndicator />}
      {!!error && <Text style={{ color: "tomato" }}>{error}</Text>}
    </View>
  );
}

export default UploadButton;
