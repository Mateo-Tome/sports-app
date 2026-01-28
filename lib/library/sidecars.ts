// lib/library/sidecars.ts
import * as FileSystem from 'expo-file-system';
import { computeSportColor } from '../sportColors/computeSportColor';

export type FinalScore = { home: number; opponent: number };
export type Outcome = 'W' | 'L' | 'T';

export type SidecarEvent = {
  t: number;
  points?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  key?: string;
  label?: string;
  kind?: string;
  meta?: Record<string, any>;
};

export type Sidecar = {
  athlete?: string;
  sport?: string; // can be "wrestling" OR "wrestling:freestyle" (legacy tolerated)
  style?: string; // "folkstyle" | "freestyle" | "greco" | etc
  events?: SidecarEvent[];
  finalScore?: FinalScore;
  homeIsAthlete?: boolean;

  outcome?: Outcome;
  winner?: 'home' | 'opponent' | null;
  endedBy?: 'pin' | 'decision' | 'submission' | null;
  athletePinned?: boolean;
  athleteWasPinned?: boolean;
  modifiedAt?: number;
};

export type OutcomeBits = {
  finalScore: FinalScore | null;
  homeIsAthlete: boolean;
  outcome: Outcome | null;
  myScore: number | null;
  oppScore: number | null;
  highlightGold: boolean;
  edgeColor: string | null;
};

/**
 * Normalizes sport/style into a single sportKey your stats registry uses.
 * Accepts both:
 * - sport="wrestling", style="freestyle"
 * - sport="wrestling:freestyle" (legacy)
 */
export function getSportKeyFromSidecar(sc: any): string {
  const rawSport = String(sc?.sport ?? '').trim();
  const rawStyle = String(sc?.style ?? '').trim();

  if (rawSport.includes(':')) {
    const [s, st] = rawSport
      .split(':')
      .map((x) => String(x ?? '').trim().toLowerCase());
    if (s && st) return `${s}:${st}`;
    if (s) return `${s}:default`;
  }

  const sport = rawSport.toLowerCase() || 'unknown';
  const style = rawStyle.toLowerCase() || 'default';
  return `${sport}:${style}`;
}

// Read the full sidecar JSON for a given video URI (for upload).
export async function readSidecarForUpload(videoUri: string): Promise<any | null> {
  try {
    const lastSlash = videoUri.lastIndexOf('/');
    const lastDot = videoUri.lastIndexOf('.');
    const base = lastDot > lastSlash ? videoUri.slice(0, lastDot) : videoUri;
    const guess = `${base}.json`;

    const tryRead = async (p: string): Promise<any | null> => {
      const info: any = await FileSystem.getInfoAsync(p);
      if (!info?.exists) return null;
      const txt = await FileSystem.readAsStringAsync(p);
      return txt ? JSON.parse(txt) : {};
    };

    let sc: any | null = await tryRead(guess);
    if (sc) return sc;

    const dir = videoUri.slice(0, lastSlash + 1);
    try {
      // @ts-ignore
      const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
      const baseName = base.slice(lastSlash + 1);
      const candidate = files.find(
        (f) => f.toLowerCase() === `${baseName.toLowerCase()}.json`,
      );
      if (candidate) {
        sc = await tryRead(dir + candidate);
        if (sc) return sc;
      }
    } catch {}

    return null;
  } catch (e) {
    console.log('readSidecarForUpload error', e);
    return null;
  }
}

// Main outcome reader: computes sport-specific edgeColor
export async function readOutcomeFor(videoUri: string): Promise<OutcomeBits> {
  try {
    const lastSlash = videoUri.lastIndexOf('/');
    const lastDot = videoUri.lastIndexOf('.');
    const base = lastDot > lastSlash ? videoUri.slice(0, lastDot) : videoUri;
    const guess = `${base}.json`;

    const tryRead = async (p: string): Promise<Sidecar | null> => {
      const info: any = await FileSystem.getInfoAsync(p);
      if (!info?.exists) return null;
      const txt = await FileSystem.readAsStringAsync(p);
      return JSON.parse(txt || '{}');
    };

    let sc: Sidecar | null = await tryRead(guess);
    if (!sc) {
      try {
        const dir = videoUri.slice(0, lastSlash + 1);
        // @ts-ignore
        const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
        const baseName = base.slice(lastSlash + 1);
        const candidate = files.find(
          (f) => f.toLowerCase() === `${baseName.toLowerCase()}.json`,
        );
        if (candidate) sc = await tryRead(dir + candidate);
      } catch {}
    }

    if (!sc || sc.sport === 'highlights') {
      return {
        finalScore: null,
        homeIsAthlete: true,
        outcome: null,
        myScore: null,
        oppScore: null,
        highlightGold: false,
        edgeColor: null,
      };
    }

    const sportKey = getSportKeyFromSidecar(sc);
    const [sportStr] = sportKey.split(':');
    const isWrestling = sportStr === 'wrestling';

    // 1) Score
    let finalScore: FinalScore | null = sc.finalScore ?? null;
    if (!finalScore) {
      let h = 0, o = 0;
      for (const e of sc.events ?? []) {
        const pts = typeof e.points === 'number' ? e.points : 0;
        if (pts > 0) {
          if (e.actor === 'home') h += pts;
          else if (e.actor === 'opponent') o += pts;
        }
      }
      finalScore = { home: h, opponent: o };
    }

    const homeIsAthlete = sc.homeIsAthlete !== false;
    const myScore = finalScore ? (homeIsAthlete ? finalScore.home : finalScore.opponent) : null;
    const oppScore = finalScore ? (homeIsAthlete ? finalScore.opponent : finalScore.home) : null;

    let outcome: Outcome | null = sc.outcome ?? null;
    let highlightGold = false;

    // 2) Wrestling pin logic
    if (isWrestling) {
      const ev = sc.events ?? [];
      const pinEv = ev.find((e: SidecarEvent) => {
        const key = String(e?.key ?? '').toLowerCase();
        const label = String(e?.label ?? '').toLowerCase();
        const kind = String(e?.kind ?? '').toLowerCase();
        const winBy = String(e?.meta?.winBy ?? '').toLowerCase();
        return (
          key === 'pin' ||
          kind === 'pin' ||
          label.includes('pin') ||
          winBy === 'pin' ||
          kind === 'fall' ||
          label.includes('fall')
        );
      });

      if (pinEv && (pinEv.actor === 'home' || pinEv.actor === 'opponent')) {
        const athletePinned =
          (homeIsAthlete && pinEv.actor === 'home') ||
          (!homeIsAthlete && pinEv.actor === 'opponent');
        highlightGold = !!athletePinned;
        outcome = athletePinned ? 'W' : 'L';
      } else if (!outcome && finalScore && myScore != null && oppScore != null) {
        outcome = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
      }
    } else {
      if (!outcome && finalScore && myScore != null && oppScore != null) {
        outcome = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
      }
    }

    // 3) Color (✅ do NOT add sportKey property to the object)
    const { edgeColor, highlightGold: finalGold } = computeSportColor(
      sc as any,      // typed as SidecarLike in your project; keep it compatible
      outcome,
      highlightGold,
      finalScore,
    );

    return {
      finalScore,
      homeIsAthlete,
      outcome,
      myScore,
      oppScore,
      highlightGold: finalGold,
      edgeColor,
    };
  } catch {
    return {
      finalScore: null,
      homeIsAthlete: true,
      outcome: null,
      myScore: null,
      oppScore: null,
      highlightGold: false,
      edgeColor: null,
    };
  }
}
