// src/api/getPlaybackUrls.ts
export type PlaybackUrls = {
    videoUrl: string;
    sidecarUrl?: string;
    expiresAt?: number; // optional if your function returns it
  };
  
  function getBaseEndpoint() {
    // Preferred: set a full URL to the function in env:
    // EXPO_PUBLIC_GET_PLAYBACK_URLS_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net/getPlaybackUrls"
    const full = process.env.EXPO_PUBLIC_GET_PLAYBACK_URLS_URL;
    if (full && full.startsWith('http')) return full;
  
    // Fallback: base URL + /getPlaybackUrls
    // EXPO_PUBLIC_FUNCTIONS_BASE_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net"
    const base = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;
    if (base && base.startsWith('http')) return `${base.replace(/\/+$/, '')}/getPlaybackUrls`;
  
    return '';
  }
  
  export async function getPlaybackUrls(shareId: string, opts?: { signal?: AbortSignal }): Promise<PlaybackUrls> {
    const endpoint = getBaseEndpoint();
    if (!endpoint) {
      throw new Error(
        'Missing playback URL endpoint. Set EXPO_PUBLIC_GET_PLAYBACK_URLS_URL or EXPO_PUBLIC_FUNCTIONS_BASE_URL.',
      );
    }
  
    // Try POST JSON first (most reliable with CORS)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
        signal: opts?.signal,
      });
  
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`getPlaybackUrls failed (${res.status}): ${txt || res.statusText}`);
      }
  
      const json = (await res.json()) as any;
      const videoUrl = String(json?.videoUrl || '');
      if (!videoUrl) throw new Error('getPlaybackUrls returned no videoUrl');
      return { videoUrl, sidecarUrl: json?.sidecarUrl, expiresAt: json?.expiresAt };
    } catch (e) {
      // Fallback: GET ?shareId= (helps if your function only supports query params)
      const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}shareId=${encodeURIComponent(shareId)}`;
      const res = await fetch(url, { method: 'GET', signal: opts?.signal });
  
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`getPlaybackUrls failed (${res.status}): ${txt || res.statusText}`);
      }
  
      const json = (await res.json()) as any;
      const videoUrl = String(json?.videoUrl || '');
      if (!videoUrl) throw new Error('getPlaybackUrls returned no videoUrl');
      return { videoUrl, sidecarUrl: json?.sidecarUrl, expiresAt: json?.expiresAt };
    }
  }
  