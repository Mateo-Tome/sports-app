// web/lib/getPlaybackUrlsWeb.ts

// NOTE:
// In Next (especially Turbopack), dynamic access like process.env[name]
// can behave inconsistently for client bundles.
// Read the env vars directly so Next can inline them at build time.

export type PlaybackUrls = {
  videoUrl: string;
  sidecarUrl?: string;
  expiresAt?: number;
};

function stripTrailingSlash(u: string) {
  return u.replace(/\/+$/, "");
}

function getEndpoint() {
  // Read directly (NOT via process.env[name])
  const full = (process.env.NEXT_PUBLIC_GET_PLAYBACK_URLS_URL ?? "").trim();
  const base = (process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ?? "").trim();

  // Debug: shows EXACTLY what the client bundle sees
  if (typeof window !== "undefined") {
    console.log("[getEndpoint] full=", JSON.stringify(full), "base=", JSON.stringify(base));
  }

  if (full && full.startsWith("http")) return stripTrailingSlash(full);
  if (base && base.startsWith("http")) return `${stripTrailingSlash(base)}/getPlaybackUrls`;

  return "";
}

export async function getPlaybackUrlsWeb(shareId: string): Promise<PlaybackUrls> {
  const endpoint = getEndpoint();

  if (!endpoint) {
    throw new Error(
      "Missing NEXT_PUBLIC_GET_PLAYBACK_URLS_URL (or NEXT_PUBLIC_FUNCTIONS_BASE_URL) in web/.env.local (restart dev server after editing env)"
    );
  }

  const url = `${endpoint}?shareId=${encodeURIComponent(shareId)}`;

  if (typeof window !== "undefined") {
    console.log("[getPlaybackUrlsWeb] endpoint =", endpoint);
    console.log("[getPlaybackUrlsWeb] GET", url);
  }

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`getPlaybackUrls failed (${res.status}): ${txt || res.statusText}`);
  }

  const json = (await res.json()) as any;
  const videoUrl = String(json?.videoUrl || "");
  if (!videoUrl) throw new Error("getPlaybackUrls returned no videoUrl");

  return {
    videoUrl,
    sidecarUrl: json?.sidecarUrl ? String(json.sidecarUrl) : undefined,
    expiresAt: typeof json?.expiresAt === "number" ? json.expiresAt : undefined,
  };
}
