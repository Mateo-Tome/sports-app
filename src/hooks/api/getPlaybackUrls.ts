// src/hooks/api/getPlaybackUrls.ts  (or wherever your import points)
export type PlaybackUrls = {
  videoUrl: string;
  sidecarUrl?: string;
  expiresAt?: number;
};

function requireEnv(name: string) {
  const v = (process.env as any)?.[name];
  return typeof v === 'string' ? v.trim() : '';
}

function getEndpoint() {
  const full = requireEnv('EXPO_PUBLIC_GET_PLAYBACK_URLS_URL');
  if (full && full.startsWith('http')) return full;

  const base = requireEnv('EXPO_PUBLIC_FUNCTIONS_BASE_URL');
  if (base && base.startsWith('http')) return `${base.replace(/\/+$/, '')}/getPlaybackUrls`;

  return '';
}

export async function getPlaybackUrls(
  shareId: string,
  opts?: { signal?: AbortSignal },
): Promise<PlaybackUrls> {
  const endpoint = getEndpoint();
  if (!endpoint) {
    throw new Error('Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL (or EXPO_PUBLIC_GET_PLAYBACK_URLS_URL)');
  }

  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}shareId=${encodeURIComponent(shareId)}`;

  // ✅ super explicit debug
  if (typeof window !== 'undefined') {
    console.log('[getPlaybackUrls] env base =', requireEnv('EXPO_PUBLIC_FUNCTIONS_BASE_URL'));
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
