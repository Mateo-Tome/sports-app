import React from 'react';
import type { OverlayProps } from './types';

import BaseballHittingOverlay from './BaseballHittingOverlay';
import WrestlingFolkstyleOverlay from './WrestlingFolkstyleOverlay';

// ✅ These match YOUR actual filenames shown in the sidebar:
import WrestlingFreestyleOverlay from './wrestlingFreestyleOverlay';
import WrestlingGrecoOverlay from './wrestlingGrecoOverlay';

// ✅ NEW: Volleyball overlay (adjust the path to match where you create the file)
import VolleyballOverlay from './vollyball/VollyballOverlay';

export function normalizeKey(sport?: string, style?: string) {
  const s = String(sport ?? '').trim().toLowerCase();
  const st = String(style ?? 'default').trim().toLowerCase();
  return `${s}:${st}`;
}

const Registry: Record<string, React.ComponentType<OverlayProps>> = {
  // Wrestling
  'wrestling:folkstyle': WrestlingFolkstyleOverlay,
  'wrestling:freestyle': WrestlingFreestyleOverlay,
  'wrestling:greco': WrestlingGrecoOverlay,

  // Baseball
  'baseball:hitting': BaseballHittingOverlay,

  // ✅ Volleyball
  'volleyball:default': VolleyballOverlay,
};

export function getRecordingOverlay(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);
  return { key, Overlay: Registry[key] ?? null };
}
