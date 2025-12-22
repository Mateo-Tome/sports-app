// src/api/getPlaybackUrls.ts

export type PlaybackUrls = {
  videoUrl: string;
  sidecarUrl?: string;
  expiresAt?: number;
};

function getBaseEndpoint() {
  // Preferred: full function URL
  // EXPO_PUBLIC_GET_PLAYBACK_URLS_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net/getPlaybackUrls"
  const full = process.env.EXPO_PUBLIC_GET_PLAYBACK_URLS_URL;
  if (full && full.startsWith('http')) return full;

  // Fallback: base URL + /getPlaybackUrls
  // EXPO_PUBLIC_FUNCTIONS_BASE_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net"
  const base = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;
  if (base && base.startsWith('http')) return `${base.replace(/\/+$/, '')}/getPlaybackUrls`;

  return '';
}

export async function getPlaybackUrls(
  shareId: string,
  opts?: { signal?: AbortSignal },
): Promise<PlaybackUrls> {
  const endpoint = getBaseEndpoint();
  if (!endpoint) {
    throw new Error(
      'Missing playback URL endpoint. Set EXPO_PUBLIC_GET_PLAYBACK_URLS_URL or EXPO_PUBLIC_FUNCTIONS_BASE_URL.',
    );
  }

  // ✅ Force GET only (fixes 405 Method Not Allowed on POST)
  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}shareId=${encodeURIComponent(shareId)}`;

  // Debug (web only) so we can confirm the exact URL
  if (typeof window !== 'undefined') {
    console.log('[getPlaybackUrls] GET', url);
  }

  const res = await fetch(url, {
    method: 'GET',
    signal: opts?.signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`getPlaybackUrls failed (${res.status}): ${txt || res.statusText}`);
  }

  const json = (await res.json()) as any;
  const videoUrl = String(json?.videoUrl || '');
  if (!videoUrl) throw new Error('getPlaybackUrls returned no videoUrl');

  return {
    videoUrl,
    sidecarUrl: json?.sidecarUrl ? String(json.sidecarUrl) : undefined,
    expiresAt: typeof json?.expiresAt === 'number' ? json.expiresAt : undefined,
  };
}
