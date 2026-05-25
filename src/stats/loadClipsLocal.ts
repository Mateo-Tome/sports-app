// src/stats/loadClipsLocal.ts

import { readIndex } from '../../lib/library/indexStore';
import { readSidecarForUpload } from '../../lib/library/sidecars';
import type { ClipSidecar } from './types';

type Outcome = 'W' | 'L' | 'T';

function clean(v: any): string {
  return typeof v === 'string' ? v.trim() : '';
}

function cleanOrNull(v: any): string | null {
  const s = clean(v);
  return s.length ? s : null;
}

function computeOutcome(sc: any): Outcome | null {
  const existing = String(sc?.outcome ?? '').trim().toUpperCase();

  if (existing === 'W' || existing === 'L' || existing === 'T') {
    return existing as Outcome;
  }

  const homeIsAthlete = sc?.homeIsAthlete !== false;

  let finalScore = sc?.finalScore ?? null;

  if (!finalScore) {
    let home = 0;
    let opponent = 0;

    for (const e of sc?.events ?? []) {
      const pts =
        typeof e?.points === 'number'
          ? e.points
          : typeof e?.value === 'number'
            ? e.value
            : 0;

      if (pts > 0) {
        if (e?.actor === 'home') home += pts;
        if (e?.actor === 'opponent') opponent += pts;
      }
    }

    finalScore = { home, opponent };
  }

  const myScore = homeIsAthlete ? finalScore.home : finalScore.opponent;
  const oppScore = homeIsAthlete ? finalScore.opponent : finalScore.home;

  if (myScore > oppScore) return 'W';
  if (myScore < oppScore) return 'L';
  return 'T';
}

/**
 * Local clips = on THIS device
 * New clips match by athleteId first.
 * Old clips fallback to athlete name.
 */
export async function loadClipsForAthleteFromLocal(
  athleteName: string,
  athleteId?: string | null,
): Promise<ClipSidecar[]> {
  const athlete = clean(athleteName) || 'Unassigned';
  const wantedAthleteId = cleanOrNull(athleteId);

  const index = await readIndex();
  const sorted = [...index].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  const out: ClipSidecar[] = [];

  for (const meta of sorted) {
    const uri = clean(meta?.uri);
    if (!uri) continue;
    if (uri.startsWith('cloud:')) continue;

    const sc: any = await readSidecarForUpload(uri);
    if (!sc) continue;

    const clipAthleteId =
      cleanOrNull(sc?.athleteId) ?? cleanOrNull((meta as any)?.athleteId);

    const clipAthleteName =
      clean(sc?.athleteName) ||
      clean(sc?.athlete) ||
      clean((meta as any)?.athleteName) ||
      clean((meta as any)?.athlete) ||
      'Unassigned';

    const matches =
      wantedAthleteId && clipAthleteId
        ? clipAthleteId === wantedAthleteId
        : clipAthleteName.toLowerCase() === athlete.toLowerCase();

    if (!matches) continue;

    const homeIsAthlete =
      typeof sc?.homeIsAthlete === 'boolean' ? sc.homeIsAthlete : true;

    const outcome = computeOutcome({
      ...sc,
      homeIsAthlete,
    });

    out.push({
      athlete: clipAthleteName,
      athleteName: clipAthleteName,
      athleteId: clipAthleteId,

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
      homeIsAthlete,

      outcome,
      result: outcome,
      winner: sc?.winner ?? null,
      endedBy: sc?.endedBy ?? null,
      athletePinned: !!sc?.athletePinned,
      athleteWasPinned: !!sc?.athleteWasPinned,
    } as any);
  }

  return out;
}