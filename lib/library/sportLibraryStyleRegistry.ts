export type SportLibraryBits = {
    edgeColor?: string | null;
    badgeText?: string | null;
    badgeColor?: string | null;
  
    // baseball labels (used by your cards)
    hittingLabel?: string | null;
    pitchingLabel?: string | null;
  
    highlightGold?: boolean | null;
  };
  
  type Builder = (args: {
    sport: string;
    // sidecar can include events, outcome, etc.
    sidecar: any | null;
  }) => SportLibraryBits;
  
  const builders: { test: (sport: string) => boolean; build: Builder }[] = [];
  
  export function registerSportLibraryBits(
    test: (sport: string) => boolean,
    build: Builder,
  ) {
    builders.push({ test, build });
  }
  
  export function buildSportLibraryBits(sport: string, sidecar: any | null): SportLibraryBits {
    const s = String(sport || '').toLowerCase();
    const found = builders.find((b) => b.test(s));
    if (!found) return {};
    return found.build({ sport, sidecar }) || {};
  }
  