// src/stats/loadClipsLocal.ts
import { readIndex } from '../../lib/library/indexStore';
import { readSidecarForUpload } from '../../lib/library/sidecars';
import type { ClipSidecar } from './types';

/**
 * Local clips = on THIS device
 * - list from documentDirectory/videos/index.json
 * - sidecar JSON next to each mp4
 */
export async function loadClipsForAthleteFromLocal(
  athleteName: string,
): Promise<ClipSidecar[]> {
  const athlete = String(athleteName || '').trim() || 'Unassigned';

  const index = await readIndex();
  const sorted = [...index].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  const out: ClipSidecar[] = [];

  for (const meta of sorted) {
    const uri = String(meta?.uri ?? '');
    if (!uri) continue;
    if (uri.startsWith('cloud:')) continue; // safety

    const sc: any = await readSidecarForUpload(uri);
    if (!sc) continue;

    const scAthlete = String(sc?.athlete ?? meta?.athlete ?? '')
      .trim()
      || 'Unassigned';

    // ✅ name match should be case-insensitive
    if (scAthlete.toLowerCase() !== athlete.toLowerCase()) continue;

    out.push({
      athlete: scAthlete,
      sport: sc?.sport ?? meta?.sport ?? 'unknown',
      style: sc?.style ?? null,
      events: Array.isArray(sc?.events) ? sc.events : [],
      createdAt:
        typeof sc?.createdAt === 'number'
          ? sc.createdAt
          : typeof meta?.createdAt === 'number'
            ? meta.createdAt
            : Date.now(),
      finalScore: sc?.finalScore ?? null,
      homeIsAthlete: typeof sc?.homeIsAthlete === 'boolean' ? sc.homeIsAthlete : true,
    } as any);
  }

  return out;
}
