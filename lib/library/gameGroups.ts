import * as FileSystem from 'expo-file-system';

import {
    readIndex,
    writeIndexAtomic,
    type IndexMeta,
} from './indexStore';
import { readSidecarForUpload } from './sidecars';

export type GameGroupOption = {
  gameId: string;
  gameTitle: string;
  clipCount: number;
};

function clean(v: any): string {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

export function sidecarPathForVideoUri(videoUri: string) {
  return videoUri.replace(/\.[^/.]+$/, '') + '.json';
}

export function gameIdFromTitle(title: string) {
  return `game_${title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}_${Date.now()}`;
}

export async function assignClipToGame(params: {
  uri: string;
  gameTitle: string;
  existingGameId?: string | null;
}) {
  const uri = clean(params.uri);
  const gameTitle = clean(params.gameTitle);

  if (!uri) throw new Error('Missing clip uri.');
  if (!gameTitle) throw new Error('Missing game title.');

  const gameId = clean(params.existingGameId) || gameIdFromTitle(gameTitle);

  const sidecarPath = sidecarPathForVideoUri(uri);
  const existing = (await readSidecarForUpload(uri)) ?? {};

  await FileSystem.writeAsStringAsync(
    sidecarPath,
    JSON.stringify(
      {
        ...existing,
        gameId,
        gameTitle,
        modifiedAt: Date.now(),
      },
      null,
      2,
    ),
  );

  const list = await readIndex();

  const updated: IndexMeta[] = list.map((e) =>
    e.uri === uri
      ? {
          ...e,
          gameId,
          gameTitle,
        }
      : e,
  );

  await writeIndexAtomic(updated);

  return {
    gameId,
    gameTitle,
  };
}

/**
 * Simple UX version:
 * show the last 10 games globally, no athlete/sport filter.
 * Later we can add search, pinning, hiding, archiving, or athlete filters.
 */
export function getRecentGamesForClip(params: {
  rows: any[];
  athleteId?: string | null;
  athlete?: string | null;
  sport?: string | null;
  limit?: number;
}): GameGroupOption[] {
  const rows = Array.isArray(params.rows) ? params.rows : [];
  const limit = typeof params.limit === 'number' ? params.limit : 10;

  const byId = new Map<string, GameGroupOption & { lastAt: number }>();

  for (const row of rows) {
    const gameId = clean(row?.gameId);
    const gameTitle = clean(row?.gameTitle);

    if (!gameId || !gameTitle) continue;

    const lastAt =
      typeof row?.mtime === 'number'
        ? row.mtime
        : typeof row?.createdAt === 'number'
          ? row.createdAt
          : 0;

    const existing = byId.get(gameId);

    if (existing) {
      existing.clipCount += 1;
      existing.lastAt = Math.max(existing.lastAt, lastAt);
    } else {
      byId.set(gameId, {
        gameId,
        gameTitle,
        clipCount: 1,
        lastAt,
      });
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, limit)
    .map(({ gameId, gameTitle, clipCount }) => ({
      gameId,
      gameTitle,
      clipCount,
    }));
}
export async function removeClipFromGame(params: {
    uri: string;
  }) {
    const uri = clean(params.uri);
  
    if (!uri) throw new Error('Missing clip uri.');
  
    const sidecarPath = sidecarPathForVideoUri(uri);
    const existing = (await readSidecarForUpload(uri)) ?? {};
  
    await FileSystem.writeAsStringAsync(
      sidecarPath,
      JSON.stringify(
        {
          ...existing,
          gameId: null,
          gameTitle: null,
          modifiedAt: Date.now(),
        },
        null,
        2,
      ),
    );
  
    const list = await readIndex();
  
    const updated: IndexMeta[] = list.map((e) =>
      e.uri === uri
        ? {
            ...e,
            gameId: null,
            gameTitle: null,
          }
        : e,
    );
  
    await writeIndexAtomic(updated);
  
    return true;
  }