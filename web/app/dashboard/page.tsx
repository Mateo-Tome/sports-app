"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    where
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { auth, db } from "../../lib/firebase";

type VideoDoc = {
  ownerUid: string;
  createdAt?: number;
  updatedAt?: number;

  shareId?: string;
  sport?: string | null;
  style?: string | null;
  athleteId?: string | null;

  b2VideoKey?: string | null;     // e.g. videos/<uid>/<shareId>.mp4
  b2SidecarKey?: string | null;

  isPublic?: boolean;
};

function formatDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Array<{ id: string; data: VideoDoc }>>([]);
  const [loading, setLoading] = useState(true);

  // Keep user state here too (so dashboard can be opened directly)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Live query videos for this user
  useEffect(() => {
    if (!user?.uid) {
      setVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "videos"),
      where("ownerUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as VideoDoc,
        }));
        setVideos(next);
        setLoading(false);
      },
      (err) => {
        console.log("videos onSnapshot error", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  const email = user?.email ?? "(no email)";
  const uid = user?.uid ?? "";

  const hasVideos = videos.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold">QuickClip Web</div>
            <div className="mt-2 text-white/60">
              Logged in as <span className="text-white">{email}</span>
            </div>
            <div className="mt-1 text-xs text-white/40 break-all">uid: {uid}</div>
          </div>

          <button
            className="rounded-xl bg-white text-black font-bold px-4 py-2"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-bold">Your uploaded videos</div>
          <div className="mt-1 text-sm text-white/60">
            This list comes from Firestore (collection: <span className="text-white">videos</span>)
          </div>

          {loading ? (
            <div className="mt-6 text-white/70">Loading…</div>
          ) : !hasVideos ? (
            <div className="mt-6 text-white/70">
              No uploaded videos found for this user yet.
              <div className="mt-2 text-white/40 text-sm">
                Tip: upload a video from the mobile app while logged in with the SAME account,
                or make sure your mobile upload writes <code className="text-white">ownerUid</code> correctly.
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4">
              {videos.map(({ id, data }) => (
                <div
                  key={id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-bold">
                        {data.shareId ? `shareId: ${data.shareId}` : `doc: ${id}`}
                      </div>
                      <div className="mt-1 text-sm text-white/60">
                        created: {formatDate(data.createdAt)}
                      </div>
                      <div className="mt-2 text-sm text-white/70">
                        <span className="text-white/50">sport:</span>{" "}
                        {data.sport ?? "—"}{" "}
                        <span className="mx-2 text-white/30">•</span>
                        <span className="text-white/50">style:</span>{" "}
                        {data.style ?? "—"}
                      </div>
                      <div className="mt-2 text-xs text-white/40 break-all">
                        b2VideoKey: {data.b2VideoKey ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-white/40">
                    Next step: add playback by generating a signed URL (B2) or proxy endpoint.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-white/40">
          If videos don’t show up: open Firebase Console → Firestore → videos and confirm docs exist
          and have <span className="text-white">ownerUid = {uid}</span>.
        </div>
      </div>
    </div>
  );
}
