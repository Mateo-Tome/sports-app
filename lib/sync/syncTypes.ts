// lib/sync/syncTypes.ts

export type SyncStatus =
  | {
      state: 'local_only';
      updatedAt: number; // when status last changed
    }
  | {
      state: 'queued';
      updatedAt: number;
    }
  | {
      state: 'uploading';
      updatedAt: number;
    }
  | {
      state: 'uploaded';
      shareId: string;
      storageKey: string;
      url: string;
      updatedAt: number;
    }
  | {
      state: 'error';
      message: string;
      updatedAt: number;
    };

// key = stable id for a local video:
// use assetId if present, otherwise use uri
export type SyncMap = Record<string, SyncStatus>;
