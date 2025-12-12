// components/library/UploadButton.tsx
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { addDoc, collection, getFirestore } from "firebase/firestore";
import { app, auth, ensureAnonymous } from "../../lib/firebase";

import { testGetUploadUrl } from "../../lib/backend";
import { uploadVideoToB2 } from "../../lib/uploadVideoToB2";

// Small helper: read the full sidecar JSON for a given video URI (for upload).
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

export type UploadButtonProps = {
  localUri: string;
  sidecar?: unknown;
  uploaded?: boolean;
  onUploaded?: (cloudKey: string, url: string) => void; // compatibility
};

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

export function UploadButton({
  localUri,
  sidecar,
  uploaded,
  onUploaded,
}: UploadButtonProps) {
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
        onPress={async () => {
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
              originalFileName: `${shareId}.mp4`, // will land at videos/<uid>/<shareId>.mp4
              mimeType: "video/mp4",
            });

            const b2VideoKey: string | null = videoUpload?.fileName ?? null; // videos/<uid>/<shareId>.mp4
            const b2VideoFileId: string | null = videoUpload?.fileId ?? null;

            // -----------------------------
            // 2) Upload SIDECAR JSON (optional) to B2
            // NOTE: Your uploadVideoToB2 currently uploads under videos/<uid>/...
            // So we pass a .json filename and it will be stored under videos/<uid>/<shareId>.json
            // If you want sidecars/<uid>/..., we’ll adjust the helper next.
            // -----------------------------
            let b2SidecarKey: string | null = null;
            let b2SidecarFileId: string | null = null;

            let fullSidecar = await readSidecarForUpload(localUri);
            if (!fullSidecar && sidecar && typeof sidecar === "object") {
              fullSidecar = sidecar as any;
            }

            if (fullSidecar) {
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
                { encoding: FileSystem.EncodingType.UTF8 }
              );

              // Fresh upload url/token for json (upload urls are single-use/short-lived)
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
                originalFileName: `${shareId}.json`, // will land at videos/<uid>/<shareId>.json (for now)
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

              const docData = {
                ownerUid: user.uid,
                athleteId: null as string | null,
                sport: null as string | null,
                style: null as string | null,
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
          } catch (e: any) {
            console.log("UploadButton(B2) error", e);
            setError(e?.message ?? "Upload failed");
            setState("idle");
            Alert.alert(
              "Upload failed",
              e?.message ?? "Please try again while online."
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
