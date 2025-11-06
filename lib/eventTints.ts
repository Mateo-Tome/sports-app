// lib/eventTints.ts
export const palette = {
    gold:   '#d4a017',
    green:  '#22c55e',
    yellow: '#facc15',
    red:    '#ef4444',
  } as const;
  
  type EventLike = {
    key?: string;
    kind?: string;
    label?: string;
    actor?: 'home' | 'opponent' | 'neutral';
    meta?: Record<string, any>;
  };
  
  // normalize an event into one lowercase string to keyword match against
  const textOf = (e: EventLike) =>
    `${String(e.key ?? '')}|${String(e.kind ?? '')}|${String(e.label ?? '')}|${String(e.meta?.winBy ?? '')}`
      .toLowerCase();
  
  // decisive “hero” moments = GOLD (independent of win/loss)
  const GOLD_KEYS = [
    'pin', 'fall',                 // wrestling
    'submission', 'sub',           // bjj
    'home run', 'homerun', 'hr',   // baseball/softball
  ];
  
  // positive / neutral-advance / negative
  const POSITIVE_KEYS = [
    'hit', 'single', 'double', 'triple',
    'goal', 'assist',
    'takedown', 'reversal', 'nf', 'nearfall',
    'kill', 'block',
    'steal safe', 'bunt safe',
  ];
  const YELLOW_KEYS = ['walk', 'hit by pitch', 'hbp', 'advantage', 'caution'];
  const RED_KEYS    = ['strikeout', ' k', '|k|', ' out', 'ground out', 'fly out', 'turnover', 'foul', 'error', 'stall'];
  
  const containsAny = (t: string, words: string[]) => words.some(w => t.includes(w));
  
  function goldKindFor(t: string): 'PIN' | 'SUB' | 'HR' | 'GOLD' {
    if (t.includes('pin') || t.includes('fall')) return 'PIN';
    if (t.includes('submission') || t.includes('sub')) return 'SUB';
    if (t.includes('home run') || t.includes('homerun') || t.includes('hr')) return 'HR';
    return 'GOLD';
  }
  
  /**
   * Given a list of sidecar events, return:
   * - highlightGold: true if the clip contains a decisive "hero" moment (pin/sub/HR)
   * - goldKind: optional short label for the gold badge
   * - tint: green/yellow/red hex for the **last** meaningful non-gold event, else null
   */
  export function getEventTint(
    events: EventLike[] = []
  ): { highlightGold: boolean; goldKind?: 'PIN' | 'SUB' | 'HR' | 'GOLD'; tint: string | null } {
    // GOLD check (scan from end so latest decisive moment wins)
    for (let i = events.length - 1; i >= 0; i--) {
      const t = textOf(events[i]);
      if (containsAny(t, GOLD_KEYS)) {
        return { highlightGold: true, goldKind: goldKindFor(t), tint: null };
      }
    }
  
    // Otherwise classify the **last** meaningful event for border tint
    for (let i = events.length - 1; i >= 0; i--) {
      const t = textOf(events[i]);
      if (containsAny(t, RED_KEYS))    return { highlightGold: false, tint: palette.red };
      if (containsAny(t, YELLOW_KEYS)) return { highlightGold: false, tint: palette.yellow };
      if (containsAny(t, POSITIVE_KEYS)) return { highlightGold: false, tint: palette.green };
    }
    return { highlightGold: false, tint: null };
  }
  