// components/overlays/types.ts

export type OverlayActor = 'home' | 'opponent' | 'neutral';

export type OverlayEvent = {
  actor?: OverlayActor;
  key?: string;
  kind?: string;
  value?: number;
  label?: string;
  winBy?: string;
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
