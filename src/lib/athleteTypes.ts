// src/lib/athleteTypes.ts
export type Athlete = {
  id: string;
  name: string;

  // device-only
  photoLocalUri?: string | null; // file://... (documentDirectory)
  photoUri?: string | null;      // legacy local

  // cross-device
  photoKey?: string | null;      // ✅ stable forever
  photoUpdatedAt?: number | null;

  // legacy/optional
  photoUrl?: string | null;

  // queue flag (upload ONLY on Sync)
  photoNeedsUpload?: boolean | null;
};
