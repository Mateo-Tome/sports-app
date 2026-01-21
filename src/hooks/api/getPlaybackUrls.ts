// src/hooks/api/getPlaybackUrls.ts

export type PlaybackUrls = {
  videoUrl: string;
  sidecarUrl?: string;
  expiresAt?: number;
};

const FUNCTIONS_BASE_URL = (process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL || '').trim();
const GET_PLAYBACK_URLS_URL = (process.env.EXPO_PUBLIC_GET_PLAYBACK_URLS_URL || '').trim();

function getEndpoint() {
  if (GET_PLAYBACK_URLS_URL && GET_PLAYBACK_URLS_URL.startsWith('http')) return GET_PLAYBACK_URLS_URL;

  if (FUNCTIONS_BASE_URL && FUNCTIONS_BASE_URL.startsWith('http')) {
    return `${FUNCTIONS_BASE_URL.replace(/\/+$/, '')}/getPlaybackUrls`;
  }

  return '';
}

export async function getPlaybackUrls(
  shareId: string,
  opts?: { signal?: AbortSignal },
): Promise<PlaybackUrls> {
  const endpoint = getEndpoint();
  if (!endpoint) {
    throw new Error(
      'Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL (or EXPO_PUBLIC_GET_PLAYBACK_URLS_URL)',
    );
  }

  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}shareId=${encodeURIComponent(shareId)}`;

  if (typeof window !== 'undefined') {
    console.log('[getPlaybackUrls] EXPO_PUBLIC_FUNCTIONS_BASE_URL =', FUNCTIONS_BASE_URL);
    console.log('[getPlaybackUrls] EXPO_PUBLIC_GET_PLAYBACK_URLS_URL =', GET_PLAYBACK_URLS_URL);
    console.log('[getPlaybackUrls] endpoint =', endpoint);
    console.log('[getPlaybackUrls] GET', url);
  }

  const res = await fetch(url, { method: 'GET', signal: opts?.signal });

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
