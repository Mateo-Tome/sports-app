// src/stats/fetchSidecarByKey.ts
import { getAuth } from 'firebase/auth';
import { ensureAnonymous } from '../../lib/firebase';
import type { ClipSidecar } from './types';

const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

/**
 * Fetch a sidecar JSON from B2 using a Cloud Function proxy.
 * We pass the B2 "key" (file path) like: videos/{uid}/{shareId}.json
 *
 * This does NOT download the video.
 */
export async function fetchClipSidecarByKey(b2SidecarKey: string): Promise<ClipSidecar> {
  const key = String(b2SidecarKey ?? '').trim();
  if (!key) throw new Error('missing b2SidecarKey');

  // Make sure we have a Firebase user (anon is fine)
  await ensureAnonymous();
  const user = getAuth().currentUser;
  const idToken = user ? await user.getIdToken() : null;

  // If you already use EXPO_PUBLIC_FUNCTIONS_BASE_URL elsewhere (like AthleteCard), keep it consistent.
  // Example: https://us-central1-sports-app-9efb3.cloudfunctions.net
  const base =
    (FUNCTIONS_BASE_URL && FUNCTIONS_BASE_URL.trim()) ||
    'https://us-central1-sports-app-9efb3.cloudfunctions.net';

  const url = `${base.replace(/\/+$/, '')}/getSidecarByKey?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`getSidecarByKey failed (${res.status}): ${txt || res.statusText}`);
  }

  const json = await res.json();

  // Sidecar can be either the full JSON, or wrapped; normalize:
  const meta = (json?.meta ?? json?.data?.meta ?? json) as any;
  const events = (json?.events ?? json?.data?.events ?? meta?.events ?? []) as any[];

  if (!Array.isArray(events)) throw new Error('sidecar JSON has no events array');

  const athlete = String(meta?.athlete ?? meta?.athleteName ?? json?.athlete ?? json?.athleteName ?? '').trim();

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
    sport: meta?.sport ?? json?.sport,
    style: meta?.style ?? json?.style,
    events,
    createdAt,
    finalScore,
    homeIsAthlete,
  } as any;
}
