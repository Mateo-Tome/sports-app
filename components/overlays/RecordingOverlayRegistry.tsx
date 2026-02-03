// components/overlays/RecordingOverlayRegistry.tsx
import React from 'react';
import type { OverlayProps } from './types';

import BaseballHittingOverlay from './BaseballHittingOverlay';

// IMPORTANT: match your existing actual path (misspelled)
import VolleyballOverlay from './vollyball/VollyballOverlay';

// IMPORTANT: match your existing actual filenames (lowercase)
import WrestlingFolkstyleOverlay from './WrestlingFolkstyleOverlay';
import WrestlingFreestyleOverlay from './wrestlingFreestyleOverlay';
import WrestlingGrecoOverlay from './wrestlingGrecoOverlay';

export function normalizeKey(sport?: string, style?: string) {
  let s = String(sport ?? '').trim().toLowerCase();
  let st = String(style ?? 'default').trim().toLowerCase();

  // sport aliases (optional)
  if (s === 'vb' || s === 'volley') s = 'volleyball';
  if (s === 'wrestle') s = 'wrestling';
  if (s === 'base') s = 'baseball';

  // style aliases
  if (s === 'wrestling') {
    if (st === 'folk' || st === 'fs') st = 'folkstyle';
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

  // Volleyball
  'volleyball:default': { Overlay: VolleyballOverlay, preRollSec: DEFAULT_PREROLL_SEC },
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
