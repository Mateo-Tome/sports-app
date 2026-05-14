// components/overlays/types.ts

export type OverlayActor = 'home' | 'opponent' | 'neutral';

export type OverlayEvent = {
  actor?: OverlayActor;
  key?: string;
  kind?: string;
  value?: number;
  label?: string;
  winBy?: string;
  meta?: Record<string, any>;
  [k: string]: any;
};

export type OverlayScore = {
  home: number;
  opponent: number;
};

export type OverlayProps = {
  isRecording: boolean;
  sport: string;
  style: string;
  score?: OverlayScore;
  getCurrentTSec: () => number;
  onEvent: (evt: OverlayEvent) => void;

  /**
   * Name of the athlete being recorded for.
   */
  athleteName?: string;

  /**
   * Swimming-only route params.
   * Optional so other sports ignore them safely.
   */
  stroke?: string;
  distance?: string;
  raceLabel?: string;
};