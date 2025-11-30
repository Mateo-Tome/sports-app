// lib/sportColors/baseballSoftballHittingColors.ts

export type SportColorEvent = {
    t: number;
    points?: number;
    actor?: 'home' | 'opponent' | 'neutral';
    key?: string;
    label?: string;
    kind?: string;
    meta?: Record<string, any>;
  };
  
  export type SportColorInput = {
    sport?: string;
    events?: SportColorEvent[];
    homeIsAthlete?: boolean;
    finalScore?: {
      home: number;
      opponent: number;
    } | null;
  
    // These come from the generic W/L/T logic in readOutcomeFor
    baseOutcome: 'W' | 'L' | 'T' | null;
    baseHighlightGold: boolean;
  };
  
  export type SportColorResult = {
    edgeColor: string | null;
    highlightGold: boolean;
  };
  
  // Base colors (keep these matching your overlays)
  const COLOR_GREEN = '#16a34a'; // good outcome
  const COLOR_RED = '#dc2626';   // bad outcome
  const COLOR_YELLOW = '#eab308'; // neutral (walk)
  const COLOR_GOLD = '#facc15';   // special (HR)
  
  // helper: last event that has any "descriptor" (key/kind/label)
  function findLastDescribedEvent(
    events: SportColorEvent[] | undefined,
  ): SportColorEvent | null {
    if (!events?.length) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.key || e.kind || e.label) return e;
    }
    return null;
  }
  
  /**
   * Decide border color + gold highlight for Baseball / Softball HITTING.
   *
   * Returns:
   *   - { edgeColor, highlightGold } if this is baseball/softball (non-pitching)
   *   - null          if this clip is NOT baseball/softball, or no events
   */
  export function getBaseballSoftballHittingColor(
    input: SportColorInput,
  ): SportColorResult | null {
    const sportStr = String(input.sport ?? '').toLowerCase();
  
    // Only care about baseball / softball at all
    const isBaseballLike =
      sportStr.includes('baseball') || sportStr.includes('softball');
    if (!isBaseballLike) return null;
  
    // If it explicitly looks like pitching, bail out so the pitching helper can run
    const isPitching =
      sportStr.includes('pitch') || sportStr.includes('pitching');
    if (isPitching) {
      return null;
    }
  
    // ✅ KEY FIX:
    // Any baseball/softball clip that is NOT pitching will be treated as HITTING.
  
    const events = input.events ?? [];
    if (!events.length) return null;
  
    // --- Find the "last described" event (key/kind/label), then normalize ----
    const last = findLastDescribedEvent(events);
    if (!last) return null;
  
    const raw =
      String(last.key ?? last.kind ?? last.label ?? '')
        .toLowerCase()
        .replace(/\s+/g, '_'); // "Home Run" -> "home_run"
  
    let highlightGold = input.baseHighlightGold;
    let edgeColor: string | null = null;
  
    // ----- HOME RUN = GOLD + glow --------------------------------------------
    if (
      raw === 'hr' ||
      raw === 'homerun' ||
      raw === 'home_run' ||
      raw.includes('home_run') ||
      raw.includes('homerun') ||
      raw.includes('home-run')
    ) {
      edgeColor = COLOR_GOLD;
      highlightGold = true;
    }
    // ----- Strikeout = RED ----------------------------------------------------
    else if (
      raw === 'strikeout' ||
      raw === 'k' ||
      raw.includes('strikeout') ||
      raw.includes('struck_out') ||
      (raw.includes('strike') && !raw.includes('walk'))
    ) {
      edgeColor = COLOR_RED;
    }
    // ----- Walk / BB = YELLOW -------------------------------------------------
    else if (
      raw === 'walk' ||
      raw === 'bb' ||
      raw.includes('walk')
    ) {
      edgeColor = COLOR_YELLOW;
    }
    // ----- Good hits = GREEN --------------------------------------------------
    else if (
      raw === 'hit' ||
      raw.includes('single') ||
      raw.includes('double') ||
      raw.includes('triple') ||
      raw.includes('bunt') ||
      raw.includes('in_play') ||
      raw.includes('in-play')
    ) {
      edgeColor = COLOR_GREEN;
    } else {
      // ✅ DEFAULT for any "unknown" baseball hitting event:
      // If we got *some* descriptor, assume it's a "good contact" clip.
      edgeColor = COLOR_GREEN;
    }
  
    // At this point we ALWAYS have a color for baseball hitting clips.
    return { edgeColor, highlightGold };
  }
  