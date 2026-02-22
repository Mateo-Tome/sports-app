// components/modules/PlaybackModuleRegistry.ts
import React from 'react';
import type { PlaybackModuleProps } from './types';

import BaseballHittingPlaybackModule from './baseball/BaseballHittingPlaybackModule';
import BaseballPitchingPlaybackModule from './baseball/BaseballPitchingPlaybackModule';

import WrestlingFolkstylePlaybackModule from './wrestling/WrestlingFolkstylePlaybackModule';
import WrestlingFreestylePlaybackModule from './wrestling/WrestlingFreestylePlaybackModule';
import WrestlingGrecoPlaybackModule from './wrestling/WrestlingGrecoPlaybackModule';

// ✅ Basketball
import BasketballPlaybackModule from './basketball/BasketballPlaybackModule';

// ✅ Volleyball
import VolleyballPlaybackModule from './volleyball/VolleyballPlaybackModule';

// ✅ BJJ (make sure this file name EXACTLY matches)
import BJJPlaybackModule from './bjj/BJJPlaybackModule';

export function normalizeKey(sport?: string, style?: string) {
  const rawSport = String(sport ?? '').trim().toLowerCase();
  const parts = rawSport.split(':').filter(Boolean);

  const sportBase = parts[0] || '';
  const inferredStyle = parts[1] || '';

  const stRaw = String(style ?? '').trim().toLowerCase();
  const finalStyle = stRaw || inferredStyle || 'default';

  return `${sportBase}:${finalStyle}`;
}

const Registry: Record<string, React.ComponentType<PlaybackModuleProps>> = {
  // Wrestling
  'wrestling:folkstyle': WrestlingFolkstylePlaybackModule,
  'wrestling:freestyle': WrestlingFreestylePlaybackModule,
  'wrestling:greco': WrestlingGrecoPlaybackModule,

  // Baseball
  'baseball:hitting': BaseballHittingPlaybackModule,
  'baseball:pitching': BaseballPitchingPlaybackModule,

  // Basketball
  'basketball:default': BasketballPlaybackModule,

  // Volleyball
  'volleyball:default': VolleyballPlaybackModule,
  'volleyball:match': VolleyballPlaybackModule,

  // ✅ BJJ
  // Register multiple keys so it always shows even if style varies
  'bjj:default': BJJPlaybackModule,
  'bjj:gi': BJJPlaybackModule,
  'bjj:nogi': BJJPlaybackModule,

  // optional aliases (only keep if you actually store these)
  'jiujitsu:default': BJJPlaybackModule,
  'jiu-jitsu:default': BJJPlaybackModule,
  'brazilianjiujitsu:default': BJJPlaybackModule,
};

export function getPlaybackModule(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);

  // ✅ TEMP DEBUG (leave for now, remove after it works)
  console.log('[PlaybackModuleRegistry] sport/style/key =', sport, style, '=>', key);

  return { key, Module: Registry[key] ?? null };
}