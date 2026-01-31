// src/types/athlete.ts

export type Athlete = {
    id: string;
    name: string;
  
    // legacy (older local-only field)
    photoUri?: string | null;
  
    // new fields
    photoLocalUri?: string | null; // device-only persistent copy
    photoUrl?: string | null;      // cross-device URL (Backblaze)
  };
  