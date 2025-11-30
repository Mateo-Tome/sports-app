// lib/sportColors/computeSportColor.ts

import {
    SportColorEvent,
    SportColorInput,
    SportColorResult,
    getBaseballSoftballHittingColor,
} from './baseballSoftballHittingColors';
  
  import { getBaseballSoftballPitchingColor } from './baseballSoftballPitchingColors';
  
  // Keep types local here so LibraryScreen doesn't have to export them.
  type Outcome = 'W' | 'L' | 'T';
  
  type FinalScore = { home: number; opponent: number };
  
  type SidecarLike = {
    sport?: string;
    events?: SportColorEvent[];
    homeIsAthlete?: boolean;
  };
  
  // Base colors (keep these consistent with overlays)
  const COLOR_GREEN = '#16a34a'; // W / good
  const COLOR_RED = '#dc2626';   // L / bad
  const COLOR_YELLOW = '#eab308'; // tie / neutral
  
  // Sports that can just piggy-back on W/L/T coloring
  const WL_SPORT_KEYWORDS = [
    'volleyball',
    'pickleball',
    'fencing',
    'muay',
    'boxing',
    'kickboxing',
    'karate',
    'taekwondo',
  ];
  
  // tiny helper: walk events from end to front
  function findLastEvent(
    events: SportColorEvent[] | undefined,
    pred: (e: SportColorEvent) => boolean,
  ): SportColorEvent | null {
    if (!events?.length) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (pred(ev)) return ev;
    }
    return null;
  }
  
  /**
   * Given a sidecar + basic outcome, decide:
   * - edgeColor: border color for Library card
   * - highlightGold: whether to show gold gradient
   *
   * This is the ONLY place you touch when adding new sports.
   * For a new sport you either:
   * - Add new sport-specific helpers & call them here
   * - Or just append a keyword to WL_SPORT_KEYWORDS if W/L/T is enough.
   */
  export function computeSportColor(
    sc: SidecarLike,
    baseOutcome: Outcome | null,
    baseHighlightGold: boolean,
    finalScore: FinalScore | null,
  ): { edgeColor: string | null; highlightGold: boolean } {
    const sportStr = String(sc.sport ?? '').toLowerCase();
    const events = (sc.events ?? []) as SportColorEvent[];
    const homeIsAthlete = sc.homeIsAthlete !== false;
  
    let edgeColor: string | null = null;
    let highlightGold = baseHighlightGold;
  
    // ===== 1) Try baseball/softball HITTING helper ===========================
    {
      const input: SportColorInput = {
        sport: sc.sport,
        events,
        homeIsAthlete,
        baseOutcome,
        baseHighlightGold,
        finalScore,
      };
  
      const result: SportColorResult | null =
        getBaseballSoftballHittingColor(input);
  
      if (result) {
        return result; // hitting decided everything
      }
    }
  
    // ===== 2) Try baseball/softball PITCHING helper ==========================
    {
      const input: SportColorInput = {
        sport: sc.sport,
        events,
        homeIsAthlete,
        baseOutcome,
        baseHighlightGold,
        finalScore,
      };
  
      const result: SportColorResult | null =
        getBaseballSoftballPitchingColor(input);
  
      if (result) {
        return result; // pitching decided everything
      }
    }
  
    // ===== 3) BJJ / Grappling ================================================
    const isBjj =
      sportStr.includes('bjj') ||
      sportStr.includes('jiu-jitsu') ||
      sportStr.includes('jiujitsu');
  
    const isWrestling = sportStr.startsWith('wrestling');
  
    const isWLSport =
      WL_SPORT_KEYWORDS.some((k) => sportStr.includes(k)) || isBjj || isWrestling;
  
    if (isBjj) {
      const last = findLastEvent(
        events,
        (e) => !!e.key || !!e.kind || !!e.label,
      );
      const key = String(last?.key ?? '').toLowerCase();
      const kind = String(last?.kind ?? '').toLowerCase();
      const label = String(last?.label ?? '').toLowerCase();
      const winBy = String(last?.meta?.winBy ?? '').toLowerCase();
  
      const actor = last?.actor; // home / opponent
  
      const isSub =
        key.includes('sub') ||
        kind.includes('sub') ||
        label.includes('sub') ||
        winBy.includes('sub') ||
        winBy.includes('submission');
  
      if (isSub && (actor === 'home' || actor === 'opponent')) {
        const athleteWonBySub =
          (homeIsAthlete && actor === 'home') ||
          (!homeIsAthlete && actor === 'opponent');
        if (athleteWonBySub) {
          edgeColor = COLOR_GREEN;
          highlightGold = true; // submission win = gold glow
        } else {
          edgeColor = COLOR_RED;
        }
      }
  
      // fallback to W/L/T if no sub-specific event
      if (!edgeColor && baseOutcome) {
        edgeColor =
          baseOutcome === 'W'
            ? COLOR_GREEN
            : baseOutcome === 'L'
            ? COLOR_RED
            : COLOR_YELLOW;
      }
  
      return { edgeColor, highlightGold };
    }
  
    // ===== 4) Generic W/L/T sports (volleyball, pickleball, muay thai, fencing...) ====
    if (isWLSport && baseOutcome) {
      edgeColor =
        baseOutcome === 'W'
          ? COLOR_GREEN
          : baseOutcome === 'L'
          ? COLOR_RED
          : COLOR_YELLOW;
      return { edgeColor, highlightGold };
    }
  
    // ===== 5) Default: no special color, caller will fall back to W/L/T mapping ====
    return { edgeColor, highlightGold };
  }
  