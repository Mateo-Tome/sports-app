export type Actor = 'home' | 'opponent' | 'neutral';

export type OverlayEvent = {
  key: string;        // e.g., "takedown2", "three", "block"
  label: string;      // text shown on the button
  actor: Actor;       // who the event is for
  value?: number;     // optional numeric value (e.g., +2)
};

export type OverlayProps = {
  isRecording: boolean;
  onEvent: (evt: OverlayEvent) => void; // overlay calls this on button press
  getCurrentTSec: () => number;         // camera gives you the current T (with -3s handled)
  sport: string;
  style: string;
};


