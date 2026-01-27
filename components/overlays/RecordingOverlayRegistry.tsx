import React from 'react';
import type { OverlayProps } from './types';

import BaseballHittingOverlay from './BaseballHittingOverlay';
import VolleyballOverlay from './vollyball/VollyballOverlay';
import WrestlingFolkstyleOverlay from './WrestlingFolkstyleOverlay';
import WrestlingFreestyleOverlay from './wrestlingFreestyleOverlay';
import WrestlingGrecoOverlay from './wrestlingGrecoOverlay';

export function normalizeKey(sport?: string, style?: string) {
  const s = String(sport ?? '').trim().toLowerCase();
  const st = String(style ?? 'default').trim().toLowerCase();
  return `${s}:${st}`;
}

type RecordingOverlayEntry = {
  Overlay: React.ComponentType<OverlayProps>;
  // How early pills/highlights should show relative to tap time
  preRollSec: number;
};

/**
 * ✅ Change this ONE number later to tune everything at once.
 * For now: 3 seconds for all sports.
 */
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
