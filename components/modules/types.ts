// components/modules/types.ts
export type Actor = 'home' | 'opponent' | 'neutral';

export type EventRow = {
  _id?: string;
  t: number;
  kind: string;
  points?: number;
  actor?: Actor;
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

export type OverlayEvent = {
  actor?: Actor;
  key?: string;
  kind?: string;
  value?: number;
  label?: string;
  winBy?: string;
  [k: string]: any;
};

export type PlaybackModuleProps = {
  // readonly player state
  now: number;
  duration: number;
  events: EventRow[];

  // from sidecar
  homeIsAthlete: boolean;
  homeColorIsGreen?: boolean; // optional

  // optional score if a sport uses it
  finalScore?: { home: number; opponent: number };

  // shared chrome state
  overlayOn: boolean;
  insets: { top: number; right: number; bottom: number; left: number };

  // actions
  onSeek: (sec: number) => void;
  onPlayPause: () => void;
  isPlaying: boolean;

  // editing hooks (modules can use or ignore)
  enterAddMode: () => void;
  onOverlayEvent?: (evt: OverlayEvent) => void;

  // belt long-press -> quick edit
  onPillLongPress: (ev: EventRow) => void;

  // live score if applicable
  liveScore?: { home: number; opponent: number };

  // NEW: editing state visible to sport modules
  editMode?: boolean;
  editSubmode?: 'add' | 'replace' | null;
};
