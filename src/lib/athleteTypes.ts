// src/lib/athleteTypes.ts

export type Athlete = {
    id: string;
    name: string;
  
    // legacy local-only field (old versions used this)
    photoUri?: string | null;
  
    // new fields
    photoLocalUri?: string | null; // device-only persistent copy
    photoUrl?: string | null;      // cross-device URL (Backblaze)
  };
  