// components/modules/types.ts

import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * Lightweight copy of OverlayEvent for playback modules.
 * (Structurally compatible with components/overlays/types.ts,
 * but kept separate to avoid circular imports.)
 */
export type OverlayEvent = {
  actor?: 'home' | 'opponent' | 'neutral';
  key?: string;
  kind?: string;
  value?: number;
  label?: string;
  winBy?: string;
  [k: string]: any;
};

/**
 * Props passed from PlaybackScreen into each sport-specific playback module.
 *
 * Used by:
 * - WrestlingFolkstylePlaybackModule
 * - BaseballHittingPlaybackModule
 * - Any future sport modules
 */
export type PlaybackModuleProps = {
  /**
   * Current playback time in seconds.
   */
  now: number;

  /**
   * Total duration in seconds (may be 0 while video is still loading).
   */
  duration: number;

  /**
   * Ordered list of scoring / meta events for this match/game.
   */
  events: any[];

  /**
   * Whether the overlay UI (scoreboard, pills, etc.) should be visible.
   */
  overlayOn: boolean;

  /**
   * Safe area insets for laying out UI around notches / home bar.
   */
  insets: EdgeInsets;

  /**
   * Callback to seek the video.
   */
  onSeek?: (sec: number) => void;

  /**
   * Callback to toggle play/pause.
   */
  onPlayPause?: () => void;

  /**
   * Whether the video is currently playing.
   */
  isPlaying?: boolean;

  /**
   * Whether the "home" side is the athlete's side.
   */
  homeIsAthlete: boolean;

  /**
   * Global color mapping: when true, home side uses GREEN and opponent uses RED.
   */
  homeColorIsGreen: boolean;

  /**
   * Live score as of "now".
   */
  liveScore?: {
    home: number;
    opponent: number;
  };

  /**
   * Final score from the sidecar / derived outcome.
   */
  finalScore?: {
    home: number;
    opponent: number;
  };

  /**
   * Whether we are currently in edit mode (adding/replacing events).
   */
  editMode?: boolean;

  /**
   * If in edit mode, whether the module should add or replace an event.
   */
  editSubmode?: 'add' | 'replace' | null;

  /**
   * Hook into PlaybackScreen's "enter add mode" helper,
   * if a module wants to trigger it.
   */
  enterAddMode?: () => void;

  /**
   * Fired when the module wants to append/replace an event.
   *
   * PlaybackScreen translates this OverlayEvent into an EventRow
   * and updates the sidecar.
   */
  onOverlayEvent?: (evt: OverlayEvent) => void;

  /**
   * Optional handler for long-pressing an event pill (if the
   * module wants to leverage it).
   */
  onPillLongPress?: (evt: any) => void;

  /**
   * Display name for the primary athlete ("my kid").
   *
   * This is what WrestlingFolkstylePlaybackModule and PlaybackScreen
   * both rely on.
   */
  athleteName?: string;

  /**
   * Allow extra sport-specific props without breaking type checking.
   */
  [key: string]: any;
};
