import {
  collection,
  limit as firestoreLimit,
  getDocs,
  getFirestore,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { app, auth, authReady } from './firebase';

export type LibraryStyle = {
  edgeColor?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  highlight?: boolean | null;
};

export type VideoRow = {
  id: string;
  shareId: string;
  createdAt: any;

  athleteName?: string | null;
  athlete?: string | null;
  sport?: string | null;
  sportStyle?: string | null;
  title?: string | null;
  originalFileName?: string | null;

  result?: 'W' | 'L' | 'T' | string | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  scoreText?: string | null;

  libraryStyle?: LibraryStyle | null;
  edgeColor?: string | null;
  highlightGold?: boolean | null;

  hittingLabel?: string | null;
  pitchingLabel?: string | null;

  b2VideoKey?: string | null;
  b2SidecarKey?: string | null;
  b2ThumbnailKey?: string | null;
  b2ThumbnailFileId?: string | null;
  thumbnailUrl?: string | null;
  thumbUri?: string | null;

  storageKey?: string | null;
  sidecarRef?: string | null;
  url?: string | null;
  storagePath?: string | null;

  bytes?: number | null;
  sizeBytes?: number | null;
  videoSizeBytes?: number | null;
};

export type VideoPageCursor = QueryDocumentSnapshot<DocumentData> | null;

export type FetchMyVideosPageResult = {
  rows: VideoRow[];
  cursor: VideoPageCursor;
  hasMore: boolean;
};

function cleanNumber(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function docToVideoRow(d: QueryDocumentSnapshot<DocumentData>): VideoRow {
  const data = d.data() as any;

  const bytes =
    cleanNumber(data.bytes) ??
    cleanNumber(data.sizeBytes) ??
    cleanNumber(data.videoSizeBytes);

  return {
    id: d.id,
    shareId: data.shareId ?? d.id,

    createdAt: data.createdAt ?? null,

    athleteName: data.athleteName ?? null,
    athlete: data.athlete ?? null,
    sport: data.sport ?? null,
    sportStyle: data.sportStyle ?? data.style ?? null,
    title: data.title ?? null,
    originalFileName: data.originalFileName ?? null,

    result: data.result ?? null,
    scoreFor: data.scoreFor ?? null,
    scoreAgainst: data.scoreAgainst ?? null,
    scoreText: data.scoreText ?? null,

    libraryStyle: (data.libraryStyle ?? null) as any,

    edgeColor: data.edgeColor ?? null,
    highlightGold:
      typeof data.highlightGold === 'boolean' ? data.highlightGold : null,

    hittingLabel: data.hittingLabel ?? null,
    pitchingLabel: data.pitchingLabel ?? data.pitchtingLabel ?? null,

    b2VideoKey: data.b2VideoKey ?? null,
    b2SidecarKey: data.b2SidecarKey ?? null,

    b2ThumbnailKey: data.b2ThumbnailKey ?? null,
    b2ThumbnailFileId: data.b2ThumbnailFileId ?? null,
    thumbnailUrl: data.thumbnailUrl ?? data.thumbUrl ?? null,
    thumbUri: data.thumbUri ?? data.thumbnailUrl ?? data.thumbUrl ?? null,

    storageKey: data.storageKey ?? null,
    sidecarRef: data.sidecarRef ?? null,
    url: data.url ?? null,
    storagePath: data.storagePath ?? null,

    bytes,
    sizeBytes: cleanNumber(data.sizeBytes),
    videoSizeBytes: cleanNumber(data.videoSizeBytes),
  };
}

export async function fetchMyVideosPage(params?: {
  pageSize?: number;
  cursor?: VideoPageCursor;
}): Promise<FetchMyVideosPageResult> {
  const user = auth.currentUser ?? (await authReady());

  if (!user || user.isAnonymous) {
    throw new Error('Sign in required.');
  }

  const db = getFirestore(app);

  const pageSize = Math.max(1, params?.pageSize ?? 20);
  const cursor = params?.cursor ?? null;

  const baseParts = [
    collection(db, 'videos'),
    where('ownerUid', '==', user.uid),
    orderBy('createdAt', 'desc'),
  ] as const;

  const q = cursor
    ? query(...baseParts, startAfter(cursor), firestoreLimit(pageSize + 1))
    : query(...baseParts, firestoreLimit(pageSize + 1));

  const snap = await getDocs(q);

  const docs = snap.docs;
  const pageDocs = docs.slice(0, pageSize);
  const hasMore = docs.length > pageSize;
  const nextCursor = pageDocs.length ? pageDocs[pageDocs.length - 1] : cursor;

  return {
    rows: pageDocs.map(docToVideoRow),
    cursor: nextCursor,
    hasMore,
  };
}

export async function fetchMyVideos(): Promise<VideoRow[]> {
  const out: VideoRow[] = [];
  let cursor: VideoPageCursor = null;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchMyVideosPage({
      pageSize: 50,
      cursor,
    });

    out.push(...page.rows);
    cursor = page.cursor;
    hasMore = page.hasMore;
  }

  return out;
}