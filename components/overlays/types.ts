// components/overlays/types.ts

export type OverlayActor = 'home' | 'opponent' | 'neutral';

export type OverlayEvent = {
  actor?: OverlayActor;

  // event type (takedown, strike, kill, etc.)
  key?: string;

  // optional alias (legacy)
  kind?: string;

  // points or numeric payload
  value?: number;

  // display label (T3, E1, NF3, etc.)
  label?: string;

  // win condition sometimes used (pin, decision)
  winBy?: string;

  // ✅ explicit metadata container (you already use this in wrestling overlay)
  meta?: Record<string, any>;

  // keep for backwards-compat
  [k: string]: any;
};

export type OverlayScore = {
  home: number;
  opponent: number;
};

/**
 * Props used by recording overlays (e.g. WrestlingFolkstyleOverlay)
 * while the camera is actively recording.
 */
export type OverlayProps = {
  /** Is the camera actively recording right now? */
  isRecording: boolean;

  /** Sport key, e.g. "wrestling", "baseball" */
  sport: string;

  /** Style/variant key, e.g. "folkstyle", "hitting" */
  style: string;

  /** Optional live score while recording (if that sport uses it) */
  score?: OverlayScore;

  /** Get current time (in seconds) from the recording screen */
  getCurrentTSec: () => number;

  /** Called whenever the overlay fires an event (takedown, pin, hit, etc.) */
  onEvent: (evt: OverlayEvent) => void;
};
