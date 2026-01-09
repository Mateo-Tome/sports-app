"use client";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";

// =====================
// THEME (edit in 1 place)
// =====================
const THEME = {
  accent: "lime" as "lime" | "cyan" | "violet" | "amber",

  page: "min-h-screen bg-black text-white",
  topbar: "sticky top-0 z-10 border-b border-white/10 bg-black/70 backdrop-blur",
  container: "mx-auto max-w-6xl px-6",

  card: "rounded-3xl border border-white/10 bg-white/5",
  cardSoft: "rounded-2xl border border-white/10 bg-black/20",
  input: "h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/25",
  select: "h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/25",
  buttonPrimary: "rounded-xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-white/90",
  pill: "text-xs rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-white/70",
};

function accentClasses(accent: typeof THEME.accent) {
  switch (accent) {
    case "cyan":
      return { bar: "bg-cyan-400/80", ring: "ring-cyan-400/30", glow: "shadow-cyan-500/20", chip: "border-cyan-400/20 text-cyan-200" };
    case "violet":
      return { bar: "bg-violet-400/80", ring: "ring-violet-400/30", glow: "shadow-violet-500/20", chip: "border-violet-400/20 text-violet-200" };
    case "amber":
      return { bar: "bg-amber-300/80", ring: "ring-amber-300/30", glow: "shadow-amber-400/20", chip: "border-amber-300/20 text-amber-100" };
    case "lime":
    default:
      return { bar: "bg-lime-400/80", ring: "ring-lime-400/30", glow: "shadow-lime-500/20", chip: "border-lime-400/20 text-lime-200" };
  }
}

// =====================
// Types
// =====================
type VideoDoc = {
  shareId?: string;
  ownerUid?: string;
  createdAt?: Timestamp | { seconds: number } | number | string | null;
  updatedAt?: any;

  sport?: string | null;
  style?: string | null;
  sportStyle?: string | null;

  athleteId?: string | null;
  athleteName?: string | null;
  athlete?: string | null;

  // Score/result fields
  result?: "W" | "L" | "T" | string | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  scoreText?: string | null;

  isPublic?: boolean;

  // B2
  b2VideoKey?: string;
  b2SidecarKey?: string;
  b2Bucket?: string;

  // Other eras
  storageKey?: string;
  sidecarRef?: string;

  // Firebase Storage era
  url?: string;
  storagePath?: string;
  bytes?: number;

  title?: string;
  originalFileName?: string;
};

// =====================
// Helpers
// =====================
function formatCreatedAt(createdAt: VideoDoc["createdAt"]) {
  try {
    if (!createdAt) return "—";
    if (createdAt instanceof Timestamp) return createdAt.toDate().toLocaleString();
    if (typeof createdAt === "object" && createdAt && "seconds" in createdAt) return new Date((createdAt as any).seconds * 1000).toLocaleString();
    if (typeof createdAt === "number") return new Date(createdAt).toLocaleString();
    if (typeof createdAt === "string") return new Date(createdAt).toLocaleString();
    return "—";
  } catch {
    return "—";
  }
}

function toDateMaybe(createdAt: VideoDoc["createdAt"]): Date | null {
  try {
    if (!createdAt) return null;
    if (createdAt instanceof Timestamp) return createdAt.toDate();
    if (typeof createdAt === "object" && createdAt && "seconds" in createdAt) return new Date((createdAt as any).seconds * 1000);
    if (typeof createdAt === "number") return new Date(createdAt);
    if (typeof createdAt === "string") {
      const d = new Date(createdAt);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function prettySport(s?: string | null) {
  if (!s) return "—";
  const t = s.trim();
  if (!t) return "—";
  if (t.startsWith("wrestling:")) return t.replace("wrestling:", "Wrestling • ");
  if (t === "wrestling") return "Wrestling";
  return t;
}

function getAthleteLabel(v: VideoDoc) {
  return (v.athleteName ?? v.athlete ?? "Unassigned") || "Unassigned";
}

function looksLikeFilenameTitle(t: string) {
  const s = t.trim().toLowerCase();
  // examples: "match_20260108_211125", "match_20260108_195215.mp4"
  if (s.startsWith("match_")) return true;
  // also treat raw file names as "bad titles"
  if (s.endsWith(".mp4") || s.endsWith(".mov") || s.endsWith(".m4v")) return true;
  return false;
}

function makePrettyTitle(v: VideoDoc, fallbackId: string) {
  const athlete = getAthleteLabel(v);
  const sportStyle = (v.sportStyle ?? v.sport ?? "unknown").toString().trim() || "unknown";

  const d = toDateMaybe(v.createdAt);
  if (!d) return `${athlete} • ${sportStyle} • ${fallbackId}`;

  const datePart = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return `${athlete} • ${sportStyle} • ${datePart} at ${timePart}`;
}

function getTitleLabel(v: VideoDoc, fallbackId: string) {
  const t = (v.title ?? "").trim();
  // ✅ If title exists and looks good, use it.
  if (t && !looksLikeFilenameTitle(t)) return t;

  // ✅ If title is missing or looks like a filename, generate a pretty one.
  const generated = makePrettyTitle(v, fallbackId);
  if (generated.trim()) return generated;

  // fallback: originalFileName without extension
  const of = v.originalFileName ? String(v.originalFileName) : "";
  const of2 = of.replace(/\.[^.]+$/, "");
  if (of2.trim()) return of2.trim();

  return (v.shareId ?? fallbackId) || fallbackId;
}

function getPlayableLabel(v: VideoDoc) {
  const key = v.b2VideoKey || v.storageKey || v.url || v.storagePath || "—";
  return String(key);
}

function hasPlayablePointer(v: VideoDoc) {
  return Boolean(v.url || v.b2VideoKey || v.storageKey);
}

function isMissingFromB2(playErr: string | null) {
  if (!playErr) return false;
  const s = playErr.toLowerCase();
  return s.includes("missing from backblaze") || s.includes("not found") || s.includes("404");
}

// Score pill helpers
function getScoreDisplay(v: VideoDoc): { text: string; tone: "win" | "loss" | "tie" } | null {
  const scoreText = (v.scoreText ?? "").trim();
  const resultRaw = (v.result ?? "").toString().trim().toUpperCase();

  if (scoreText) {
    const tone: "win" | "loss" | "tie" =
      scoreText.toUpperCase().startsWith("W") ? "win" : scoreText.toUpperCase().startsWith("L") ? "loss" : "tie";
    return { text: scoreText, tone };
  }

  if (resultRaw && v.scoreFor != null && v.scoreAgainst != null) {
    const tone: "win" | "loss" | "tie" = resultRaw === "W" ? "win" : resultRaw === "L" ? "loss" : "tie";
    return { text: `${resultRaw} ${v.scoreFor}–${v.scoreAgainst}`, tone };
  }

  return null;
}

function scorePillClasses(tone: "win" | "loss" | "tie") {
  switch (tone) {
    case "win":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
    case "loss":
      return "border-red-500/35 bg-red-500/10 text-red-200";
    case "tie":
    default:
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
}

// =====================
// Page
// =====================
export default function Page() {
  const A = accentClasses(THEME.accent);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [videos, setVideos] = useState<Array<{ id: string; data: VideoDoc }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<VideoDoc | null>(null);

  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [playErr, setPlayErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [athleteFilter, setAthleteFilter] = useState<string>("all");
  const [showMissing, setShowMissing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authReady && !user) router.replace("/login");
  }, [authReady, user, router]);

  useEffect(() => {
    if (!user) {
      setVideos([]);
      setSelectedId(null);
      setSelectedDoc(null);
      setSelectedUrl(null);
      return;
    }

    const q = query(collection(db, "videos"), where("ownerUid", "==", user.uid), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, data: d.data() as VideoDoc }));
        setVideos(next);

        if (!selectedId && next.length > 0) {
          const firstPlayable = next.find((x) => hasPlayablePointer(x.data)) ?? next[0];
          setSelectedId(firstPlayable.id);
          setSelectedDoc(firstPlayable.data);
        }
      },
      (err) => {
        console.error("videos onSnapshot error", err);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sportOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) {
      const s = (v.data.sport ?? "").trim();
      if (s) set.add(s);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [videos]);

  const athleteOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) {
      const a = (getAthleteLabel(v.data) ?? "").trim();
      if (a) set.add(a);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase();

    return videos.filter(({ id, data }) => {
      const sport = (data.sport ?? "").trim();
      const shareId = data.shareId ?? id;
      const athlete = getAthleteLabel(data).trim();

      const matchesSport = sportFilter === "all" ? true : sport === sportFilter;
      const matchesAthlete = athleteFilter === "all" ? true : athlete === athleteFilter;
      const matchesMissing = showMissing ? true : hasPlayablePointer(data);

      const hay = `${shareId} ${sport} ${data.style ?? ""} ${data.sportStyle ?? ""} ${athlete} ${getPlayableLabel(data)}`.toLowerCase();
      const matchesSearch = q.length === 0 ? true : hay.includes(q);

      return matchesSport && matchesAthlete && matchesMissing && matchesSearch;
    });
  }, [videos, search, sportFilter, athleteFilter, showMissing]);

  async function playVideo(doc: VideoDoc, idForSelection?: string) {
    setPlayErr(null);
    setLoadingPlay(true);
    setSelectedUrl(null);

    try {
      if (doc.url) {
        if (idForSelection) setSelectedId(idForSelection);
        setSelectedDoc(doc);
        setSelectedUrl(doc.url);

        setTimeout(() => {
          try {
            videoRef.current?.play?.();
          } catch {}
        }, 50);

        return;
      }

      const key = doc.b2VideoKey || doc.storageKey;
      if (!key) {
        setPlayErr("This clip record has no playable pointer (url / b2VideoKey / storageKey).");
        return;
      }

      const res = await fetch(`/api/b2-play-url?fileName=${encodeURIComponent(key)}`);
      const data = await res.json();

      if (!res.ok) {
        const detailStr = typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail ?? "");
        const combined = `${data?.error ?? "Failed to get play URL"}${detailStr ? `: ${detailStr}` : ""}`;

        const lower = combined.toLowerCase();
        if (lower.includes("not found") || lower.includes("404")) {
          setPlayErr("This clip record exists, but the video file is missing from Backblaze.");
        } else if (lower.includes("expired_auth_token") || lower.includes("401")) {
          setPlayErr("Backblaze auth token expired. Click Play again to generate a fresh URL.");
        } else {
          setPlayErr(combined);
        }
        return;
      }

      if (!data?.url) {
        setPlayErr("No url returned from /api/b2-play-url");
        return;
      }

      if (idForSelection) setSelectedId(idForSelection);
      setSelectedDoc(doc);
      setSelectedUrl(data.url);

      setTimeout(() => {
        try {
          videoRef.current?.play?.();
        } catch {}
      }, 50);
    } catch (e: any) {
      setPlayErr(String(e?.message ?? e));
    } finally {
      setLoadingPlay(false);
    }
  }

  function onVideoError() {
    setPlayErr(
      "This clip can’t be played in this browser (codec not supported) OR the file couldn’t be loaded. If only one clip fails, it’s likely that specific file is missing or encoded differently."
    );
  }

  if (!authReady) {
    return (
      <main className={THEME.page + " p-8"}>
        <h1 className="text-3xl font-bold">QuickClip</h1>
        <p className="mt-2 text-white/70">Loading session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={THEME.page + " p-8"}>
        <h1 className="text-3xl font-bold">QuickClip</h1>
        <p className="mt-2 text-white/70">Redirecting to login…</p>
      </main>
    );
  }

  return (
    <main className={THEME.page}>
      <div className={THEME.topbar}>
        <div className={THEME.container + " py-5 flex items-start justify-between"}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">QuickClip</h1>
            <div className="mt-1 text-white/70 text-sm">Signed in as {user.email}</div>
            <div className="mt-1 text-white/40 text-xs">uid: {user.uid}</div>
          </div>

          <button className={THEME.buttonPrimary} onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </div>

      <div className={THEME.container + " py-8"}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:sticky lg:top-28">
            <div className={THEME.card + " p-6"}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Player</h2>
                  <p className="mt-1 text-white/60 text-sm">Select a clip from your library to watch.</p>
                </div>

                {selectedDoc ? (
                  <div className="text-right">
                    <div className="text-xs text-white/50">Athlete</div>
                    <div className="text-sm font-semibold">{getAthleteLabel(selectedDoc)}</div>
                    <div className="text-xs text-white/50 mt-1">{prettySport(selectedDoc.sport)}</div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black">
                <div className="relative aspect-video w-full">
                  {selectedUrl ? (
                    <video
                      ref={videoRef}
                      className="absolute inset-0 h-full w-full"
                      controls
                      playsInline
                      src={selectedUrl}
                      onError={onVideoError}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/50">
                      {videos.length === 0 ? "No videos yet" : "Select a video to play"}
                    </div>
                  )}

                  {loadingPlay && (
                    <div className="absolute inset-0 grid place-items-center bg-black/60 text-white">
                      <div className={"rounded-2xl px-4 py-2 bg-black/60 border border-white/10 ring-1 " + A.ring}>
                        Loading…
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className={THEME.cardSoft + " p-3"}>
                  <div className="text-white/50 text-xs">Share ID</div>
                  <div className="mt-1 font-semibold truncate">{selectedDoc?.shareId ?? selectedId ?? "—"}</div>
                </div>
                <div className={THEME.cardSoft + " p-3"}>
                  <div className="text-white/50 text-xs">Created</div>
                  <div className="mt-1 font-semibold truncate">{selectedDoc ? formatCreatedAt(selectedDoc.createdAt) : "—"}</div>
                </div>
              </div>

              {playErr && (
                <div
                  className={[
                    "mt-4 rounded-xl border p-3 text-sm",
                    isMissingFromB2(playErr) ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-red-500/40 bg-red-500/10 text-red-200",
                  ].join(" ")}
                >
                  {playErr}
                </div>
              )}

              <div className="mt-4 text-xs text-white/45">
                Next: load the clip’s sidecar/events and render the QuickClip overlay + event belt.
              </div>
            </div>
          </div>

          <div className={THEME.card + " p-6"}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Library</h2>
                <p className="mt-1 text-white/60 text-sm">
                  {videos.length} total • {filteredVideos.length} shown
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col">
                  <label className="text-xs text-white/50 mb-1">Search</label>
                  <input
                    className={THEME.input + " w-52"}
                    placeholder="shareId, athlete, sport…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-white/50 mb-1">Sport</label>
                  <select className={THEME.select} value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
                    {sportOptions.map((s) => (
                      <option key={s} value={s}>
                        {s === "all" ? "All" : prettySport(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-white/50 mb-1">Athlete</label>
                  <select className={THEME.select} value={athleteFilter} onChange={(e) => setAthleteFilter(e.target.value)}>
                    {athleteOptions.map((a) => (
                      <option key={a} value={a}>
                        {a === "all" ? "All" : a}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs text-white/60 mt-6 sm:mt-auto select-none">
                  <input type="checkbox" checked={showMissing} onChange={(e) => setShowMissing(e.target.checked)} />
                  Show missing clips
                </label>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {filteredVideos.map(({ id, data }) => {
                const isSelected = selectedId === id;
                const missingPointer = !hasPlayablePointer(data);
                const score = getScoreDisplay(data);

                return (
                  <button
                    key={id}
                    onClick={() => playVideo(data, id)}
                    className={[
                      "group relative w-full text-left rounded-2xl border p-4 transition",
                      "focus:outline-none focus:ring-2 " + A.ring,
                      isSelected
                        ? ["border-white/20 bg-white/10 ring-1", A.ring, "shadow-lg", A.glow].join(" ")
                        : "border-white/10 bg-black/20 hover:bg-black/30 hover:border-white/15",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "absolute left-0 top-0 h-full w-1 rounded-l-2xl transition-opacity",
                        A.bar,
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                      ].join(" ")}
                    />

                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold truncate">{getTitleLabel(data, id)}</div>

                          <div className={THEME.pill}>{prettySport(data.sport)}</div>
                          <div className={THEME.pill}>{getAthleteLabel(data)}</div>

                          {score && (
                            <div className={["text-xs rounded-full border px-2 py-0.5 font-extrabold", scorePillClasses(score.tone)].join(" ")}>
                              {score.text}
                            </div>
                          )}

                          {missingPointer && (
                            <div className="text-xs rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-200">
                              Missing pointer
                            </div>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-white/50">shareId: {data.shareId ?? id}</div>
                        <div className="mt-1 text-sm text-white/60">{formatCreatedAt(data.createdAt)}</div>
                        <div className="mt-2 text-xs text-white/40 break-all">{getPlayableLabel(data)}</div>
                      </div>

                      <div className="shrink-0">
                        <div className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold">Play</div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {videos.length === 0 && (
                <div className={THEME.cardSoft + " p-5 text-white/60 text-sm"}>No videos found for this user yet.</div>
              )}

              {videos.length > 0 && filteredVideos.length === 0 && (
                <div className={THEME.cardSoft + " p-5 text-white/60 text-sm"}>
                  No results. Try clearing search / filters, or enable “Show missing clips”.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
