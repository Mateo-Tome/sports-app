// src/stats/types.ts

export type SportKey = string; // e.g. "wrestling:folkstyle", "baseball:hitting"

export type Score = {
  home: number;
  opponent: number;
};

export type RecordedEvent = {
  eventId?: string;
  t: number;                 // seconds
  kind?: string;
  key: string;               // canonical key (ex: "takedown", "strike")
  label?: string;            // UI label (ex: "T3", "Strike")
  actor?: 'home' | 'opponent' | 'neutral';
  points?: number;           // optional points
  value?: number;            // optional numeric value
  meta?: Record<string, any>;
  scoreAfter?: Score;
};

export type ClipSidecar = {
  athlete: string;
  sport: string;             // "wrestling", "baseball", ...
  style?: string;            // "folkstyle", "hitting", ...
  createdAt: number;
  homeIsAthlete?: boolean;
  events: RecordedEvent[];
  finalScore?: Score;
};

export type AthleteStatsSummary = {
  athlete: string;
  updatedAt: number;

  totals: {
    videos: number;
    events: number;
  };

  // sportKey -> stats object (per sport reducer)
  bySport: Record<SportKey, any>;
}; 
