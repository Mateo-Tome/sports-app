// lib/sportColors/baseballSoftballPitchingColors.ts

import {
    SportColorEvent,
    SportColorInput,
    SportColorResult,
} from './baseballSoftballHittingColors';
  
  // Reuse same palette so the app feels consistent
  const COLOR_GREEN = '#16a34a'; // good outcome for the PITCHER
  const COLOR_RED = '#dc2626';   // bad outcome for the PITCHER
  const COLOR_YELLOW = '#eab308'; // (kept for future use)
  
  /**
   * Decide border color + gold highlight for Baseball / Softball PITCHING.
   *
   * Returns:
   *   - { edgeColor, highlightGold } if we recognize a pitching outcome
   *   - null          if this clip is NOT baseball/softball pitching,
   *                   or we don't have enough info to decide
   */
  export function getBaseballSoftballPitchingColor(
    input: SportColorInput,
  ): SportColorResult | null {
    const sportStr = String(input.sport ?? '').toLowerCase();
  
    const isBaseballLike =
      sportStr.includes('baseball') || sportStr.includes('softball');
  
    if (!isBaseballLike) return null;
  
    const isPitching =
      sportStr.includes('pitch') || sportStr.includes('pitching');
    const isHitting =
      sportStr.includes('hitting') ||
      sportStr.includes('batting') ||
      sportStr.includes('at-bat') ||
      sportStr.includes('at bat');
  
    // This helper is ONLY for pitching.
    if (!isPitching || isHitting) {
      return null;
    }
  
    const events = input.events ?? [];
    if (!events.length) return null;
  
    // Last event with a key/kind/label (from end to front)
    let lastWithDescriptor: SportColorEvent | undefined;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.key || e.kind || e.label) {
        lastWithDescriptor = e;
        break;
      }
    }
  
    const raw =
      String(
        lastWithDescriptor?.key ??
          lastWithDescriptor?.kind ??
          lastWithDescriptor?.label ??
          '',
      )
        .toLowerCase()
        .replace(/\s+/g, '_');
  
    let highlightGold = input.baseHighlightGold;
    let edgeColor: string | null = null;
  
    // For pitching, we flip the meaning:
    //  - strikeout = GOOD (green)
    //  - walk issued = BAD (red)
    //  - hit allowed = BAD (red)
    if (
      raw === 'strikeout' ||
      raw === 'k' ||
      raw.includes('strikeout') ||
      (raw.includes('strike') && !raw.includes('walk'))
    ) {
      edgeColor = COLOR_GREEN;
    } else if (
      raw === 'walk' ||
      raw === 'bb' ||
      raw.includes('walk')
    ) {
      edgeColor = COLOR_RED;
    } else if (
      raw.includes('homerun_allowed') ||
      raw.includes('hr_allowed') ||
      raw.includes('hit_allowed') ||
      raw.includes('single_allowed') ||
      raw.includes('double_allowed') ||
      raw.includes('triple_allowed')
    ) {
      edgeColor = COLOR_RED;
    }
  
    if (!edgeColor) {
      // Unknown key -> let default W/L/T logic handle it
      return null;
    }
  
    return { edgeColor, highlightGold };
  }
  