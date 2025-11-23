// components/modules/types.ts
import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * Event coming from overlays / edit palettes while recording or in playback.
 * This is the "raw" event shape sports modules work with.
 */
export type OverlayEvent = {
  key: string;
  value?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  label?: string;
  meta?: any;
};

/**
 * Event row as used by playback modules & the event belt.
 * PlaybackScreen has its own EventRow type, but TS is structural so this matches it.
 */
export type PlaybackEventRow = {
  _id?: string;
  t: number;
  kind: string;
  points?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

/**
 * Props passed from PlaybackScreen → sport-specific playback modules
 * (WrestlingFolkstylePlaybackModule, BaseballHittingPlaybackModule, etc).
 */
export type PlaybackModuleProps = {
  // core playback state
  now: number;
  duration: number;
  events: PlaybackEventRow[];

  // who is "my athlete" & base color
  homeIsAthlete: boolean;
  homeColorIsGreen: boolean;

  // overlay visibility
  overlayOn: boolean;

  // safe-area for positioning UI
  insets: EdgeInsets;

  // transport controls
  onSeek: (sec: number) => void;
  onPlayPause: () => void;
  isPlaying: boolean;

  // editing
  enterAddMode: () => void;
  editMode: boolean;
  editSubmode: 'add' | 'replace' | null;

  // callback back into PlaybackScreen when module fires a scoring / penalty event
  onOverlayEvent?: (evt: OverlayEvent) => void;

  // long-press on a pill from inside the module (e.g. to quick-edit)
  onPillLongPress: (ev: PlaybackEventRow) => void;

  // score info
  liveScore: { home: number; opponent: number };
  finalScore?: { home: number; opponent: number } | undefined;

  // 👇 NEW (this is what fixes your TS errors)
  /**
   * Pretty name for the athlete, e.g. "Mateo" instead of just "Athlete".
   * Passed from PlaybackScreen → sport modules.
   */
  athleteName?: string;
};
