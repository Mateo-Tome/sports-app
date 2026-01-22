import React from 'react';
import type { PlaybackModuleProps } from './types';

import BaseballHittingPlaybackModule from './baseball/BaseballHittingPlaybackModule';
import WrestlingFolkstylePlaybackModule from './wrestling/WrestlingFolkstylePlaybackModule';

export function normalizeKey(sport?: string, style?: string) {
  const s = String(sport ?? '').trim().toLowerCase();
  const st = String(style ?? 'default').trim().toLowerCase();
  return `${s}:${st}`;
}

const Registry: Record<string, React.ComponentType<PlaybackModuleProps>> = {
  'wrestling:folkstyle': WrestlingFolkstylePlaybackModule,
  'baseball:hitting': BaseballHittingPlaybackModule,

  // add new ones here later:
  // 'bjj:gi': BjjGiPlaybackModule,
  // 'volleyball:default': VolleyballPlaybackModule,
};

export function getPlaybackModule(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);
  return { key, Module: Registry[key] ?? null };
}

// ✅ Optional: default export makes imports more resilient (doesn't change behavior)
export default { getPlaybackModule, normalizeKey };
