// lib/sync/syncTypes.ts

export type SyncStatus =
  | { state: 'local_only' }
  | { state: 'uploaded'; shareId: string; storageKey: string; uploadedAt: number }
  | { state: 'error'; message: string; lastTryAt: number };

// key = stable id for a local video:
// use assetId if present, otherwise use uri
export type SyncMap = Record<string, SyncStatus>;
