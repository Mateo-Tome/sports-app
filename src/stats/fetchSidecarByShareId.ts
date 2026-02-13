// src/stats/fetchSidecarByShareId.ts
import type { ClipSidecar } from './types';

/**
 * Fetch sidecar JSON by shareId through Firebase Function proxy.
 * This does NOT download the video.
 */
export async function fetchClipSidecarByShareId(shareId: string): Promise<ClipSidecar> {
  if (!shareId?.trim()) throw new Error('missing shareId');

  const proxyUrl = `https://us-central1-sports-app-9efb3.cloudfunctions.net/getSidecar?shareId=${encodeURIComponent(
    shareId
  )}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`getSidecar failed (${res.status}): ${txt || res.statusText}`);
  }

  const json = await res.json();

  // meta can be top-level, json.meta, or json.data.meta
  const meta = (json?.meta ?? json?.data?.meta ?? json) as any;

  const athlete = String(meta?.athlete ?? meta?.athleteName ?? json?.athlete ?? json?.athleteName ?? '').trim();
  const sport = meta?.sport ?? json?.sport;
  const style = meta?.style ?? json?.style;

  // events can be in json.events or json.data.events
  const events = (json?.events ?? json?.data?.events ?? []) as any[];
  if (!Array.isArray(events)) throw new Error('sidecar JSON has no events array');

  const createdAt =
    typeof meta?.createdAt === 'number'
      ? meta.createdAt
      : typeof json?.createdAt === 'number'
      ? json.createdAt
      : Date.now();

  const finalScore = meta?.finalScore ?? json?.finalScore;
  const homeIsAthlete =
    typeof meta?.homeIsAthlete === 'boolean'
      ? meta.homeIsAthlete
      : typeof json?.homeIsAthlete === 'boolean'
      ? json.homeIsAthlete
      : true;

  return {
    athlete: athlete || 'Unassigned',
    sport,
    style,
    events,
    createdAt,
    finalScore,
    homeIsAthlete,
  } as any;
}
