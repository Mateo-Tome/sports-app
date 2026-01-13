"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type VideoDoc = {
  shareId?: string;
  athleteName?: string | null;
  athlete?: string | null;
  sport?: string | null;
  sportStyle?: string | null;
  result?: string | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  scoreText?: string | null;
};

type Sidecar = {
  events?: any[];
  finalScore?: { home: number; opponent: number };
};

function scoreLabel(doc: VideoDoc | null, sidecar: Sidecar | null) {
  if (!doc) return null;

  const st = (doc.scoreText ?? "").trim();
  if (st) return st;

  if (doc.result && doc.scoreFor != null && doc.scoreAgainst != null) {
    return `${String(doc.result).toUpperCase()} ${doc.scoreFor}–${doc.scoreAgainst}`;
  }

  if (sidecar?.finalScore) {
    return `${sidecar.finalScore.home}–${sidecar.finalScore.opponent}`;
  }

  return null;
}

export default function WebPlayback({
  videoUrl,
  sidecarUrl,
  doc,
}: {
  videoUrl: string | null;
  sidecarUrl: string | null;
  doc: VideoDoc | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [sidecar, setSidecar] = useState<Sidecar | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [sidecarErr, setSidecarErr] = useState<string | null>(null);

  const [now, setNow] = useState(0);

  // Load sidecar JSON (events, finalScore)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSidecar(null);
      setEvents([]);
      setSidecarErr(null);

      if (!sidecarUrl) return;

      try {
        const res = await fetch(sidecarUrl);
        if (!res.ok) throw new Error(`Sidecar fetch failed (${res.status})`);
        const json = (await res.json()) as any;

        if (cancelled) return;

        setSidecar(json);
        setEvents(Array.isArray(json?.events) ? json.events : []);
      } catch (e: any) {
        if (cancelled) return;
        setSidecarErr(String(e?.message ?? e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sidecarUrl]);

  // Track current playback time (for Live score + jump buttons)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => setNow(v.currentTime || 0);

    v.addEventListener("timeupdate", onTime);
    onTime();

    return () => {
      v.removeEventListener("timeupdate", onTime);
    };
  }, [videoUrl]);

  const topScore = useMemo(() => scoreLabel(doc, sidecar), [doc, sidecar]);

  const liveScore = useMemo(() => {
    if (!events.length) return null;

    let last: any = null;
    for (const e of events) {
      const t = Number(e?.t ?? 0);
      if (t <= now) last = e;
      else break;
    }

    const s = last?.scoreAfter;
    if (!s) return null;
    return `${s.home}–${s.opponent}`;
  }, [events, now]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="relative aspect-video w-full">
          {videoUrl ? (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full"
              controls
              playsInline
              src={videoUrl}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/50">
              Select a video to play
            </div>
          )}

          {videoUrl && (
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
              {topScore && (
                <div className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-extrabold text-white">
                  {topScore}
                </div>
              )}
              {liveScore && (
                <div className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-semibold text-white/85">
                  Live {liveScore}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event jump buttons (only if sidecar has events) */}
      {videoUrl && events.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {events.map((e: any, idx: number) => {
            const t = Number(e?.t ?? 0);
            const label = String(e?.meta?.label ?? e?.kind ?? "event");

            return (
              <button
                key={e?._id ?? idx}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.currentTime = t;
                  v.play?.();
                }}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                title={`${label} @ ${t.toFixed(2)}s`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Sidecar status line */}
      {videoUrl && (
        <div className="mt-2 text-xs text-white/45">
          {sidecarErr ? (
            <span className="text-red-200">Sidecar: {sidecarErr}</span>
          ) : sidecarUrl ? (
            <span>{sidecar ? `Sidecar loaded • ${events.length} events` : "Loading sidecar…"}</span>
          ) : (
            <span>No sidecarUrl for this clip</span>
          )}
        </div>
      )}
    </div>
  );
}
