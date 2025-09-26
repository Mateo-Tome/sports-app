// Shared overlay types

export type Actor = 'home' | 'opponent' | 'neutral';

export type OverlayEvent = {
  key: string;                 // normalized action key (e.g., 'takedown', 'nearfall')
  label?: string;              // display label (e.g., 'T3', 'NF')
  value?: number;              // points (2/3/4 etc). Omit for non-scoring like stalling
  actor?: Actor;               // who the action belongs to
  [k: string]: any;            // any extra metadata
};

export type OverlayProps = {
  isRecording: boolean;
  onEvent: (evt: OverlayEvent) => void;
  getCurrentTSec: () => number;
  sport: string;
  style: string;
  isPaused?: boolean;
  // NEW: live running score (from camera)
  score?: { home: number; opponent: number };
};



