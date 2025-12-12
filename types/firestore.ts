// types/firestore.ts

export type PlanType = 'guest' | 'free' | 'pro' | 'team';

export interface VideoDoc {
  id: string;                // Firestore doc id
  ownerUid: string;
  athleteId?: string;
  sport?: string;
  style?: string;
  createdAt: number;
  updatedAt: number;
  storageKey: string;        // "videos/{uid}/{videoId}.mp4" (Firebase or B2)
  sidecarRef?: string;       // B2 key or Firestore path
  shareId: string;           // random string for public share links
  isPublic: boolean;         // later: 'unlisted' vs 'private'
}

export interface AthleteDoc {
  id: string;
  ownerUid: string;
  name: string;
  sport?: string;
  createdAt: number;
}
