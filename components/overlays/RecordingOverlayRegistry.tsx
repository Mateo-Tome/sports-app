// components/overlays/RecordingOverlayRegistry.tsx
import React from 'react';
import type { OverlayProps } from './types';

import BaseballHittingOverlay from './BaseballHittingOverlay';
import BaseballPitchingOverlay from './BaseballPitchingOverlay';

// ✅ Basketball
import BasketballOverlay from './basketball/BasketballOverlay';

// ✅ Volleyball (match your real path)
import VolleyballOverlay from './volleyball/VolleyballOverlay';

// ✅ Wrestling (match your real filenames)
import WrestlingFolkstyleOverlay from './WrestlingFolkstyleOverlay';
import WrestlingFreestyleOverlay from './wrestlingFreestyleOverlay';
import WrestlingGrecoOverlay from './wrestlingGrecoOverlay';

// ✅ BJJ (this is the piece you're missing)
import BJJOverlay from './bjj/BJJOverlay';

export function normalizeKey(sport?: string, style?: string) {
  let s = String(sport ?? '').trim().toLowerCase();
  let st = String(style ?? '').trim().toLowerCase();

  // sport aliases
  if (s === 'vb' || s === 'volley') s = 'volleyball';
  if (s === 'wrestle') s = 'wrestling';
  if (s === 'base') s = 'baseball';
  if (s === 'bball' || s === 'hoops') s = 'basketball';
  if (s === 'jiujitsu' || s === 'jiu-jitsu' || s === 'jj') s = 'bjj';

  // style aliases
  if (s === 'wrestling') {
    if (st === 'folk' || st === 'fs') st = 'folkstyle';
  }

  if (s === 'baseball') {
    if (st === 'pitch') st = 'pitching';
    if (st === 'hit') st = 'hitting';
  }

  // ✅ BJJ style aliases (important)
  if (s === 'bjj') {
    if (!st) st = 'gi'; // default to gi
    if (st === 'no-gi' || st === 'no gi' || st === 'nogii') st = 'nogi';
  }

  if (!st) st = 'default';
  return `${s}:${st}`;
}

type RecordingOverlayEntry = {
  Overlay: React.ComponentType<OverlayProps>;
  preRollSec: number;
};

export const DEFAULT_PREROLL_SEC = 3;

const Registry: Record<string, RecordingOverlayEntry> = {
  // Wrestling
  'wrestling:folkstyle': { Overlay: WrestlingFolkstyleOverlay, preRollSec: DEFAULT_PREROLL_SEC },
  'wrestling:freestyle': { Overlay: WrestlingFreestyleOverlay, preRollSec: DEFAULT_PREROLL_SEC },
  'wrestling:greco': { Overlay: WrestlingGrecoOverlay, preRollSec: DEFAULT_PREROLL_SEC },

  // Baseball
  'baseball:hitting': { Overlay: BaseballHittingOverlay, preRollSec: DEFAULT_PREROLL_SEC },
  'baseball:pitching': { Overlay: BaseballPitchingOverlay, preRollSec: DEFAULT_PREROLL_SEC },

  // Volleyball
  'volleyball:default': { Overlay: VolleyballOverlay, preRollSec: DEFAULT_PREROLL_SEC },

  // Basketball
  'basketball:default': { Overlay: BasketballOverlay, preRollSec: DEFAULT_PREROLL_SEC },

  // ✅ BJJ (map BOTH gi and nogi to the same overlay component)
  'bjj:gi': { Overlay: BJJOverlay, preRollSec: DEFAULT_PREROLL_SEC },
  'bjj:nogi': { Overlay: BJJOverlay, preRollSec: DEFAULT_PREROLL_SEC },
};

export function getRecordingOverlay(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);
  const entry = Registry[key];

  return {
    key,
    Overlay: entry?.Overlay ?? null,
    preRollSec: entry?.preRollSec ?? DEFAULT_PREROLL_SEC,
  };
}