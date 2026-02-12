// components/modules/PlaybackModuleRegistry.ts
import React from 'react';
import type { PlaybackModuleProps } from './types';

import BaseballHittingPlaybackModule from './baseball/BaseballHittingPlaybackModule';
import BaseballPitchingPlaybackModule from './baseball/BaseballPitchingPlaybackModule';

import WrestlingFolkstylePlaybackModule from './wrestling/WrestlingFolkstylePlaybackModule';
import WrestlingFreestylePlaybackModule from './wrestling/WrestlingFreestylePlaybackModule';
import WrestlingGrecoPlaybackModule from './wrestling/WrestlingGrecoPlaybackModule';

export function normalizeKey(sport?: string, style?: string) {
  const s = String(sport ?? '').trim().toLowerCase();
  const st = String(style ?? 'default').trim().toLowerCase();
  return `${s}:${st}`;
}

const Registry: Record<string, React.ComponentType<PlaybackModuleProps>> = {
  // Wrestling
  'wrestling:folkstyle': WrestlingFolkstylePlaybackModule,
  'wrestling:freestyle': WrestlingFreestylePlaybackModule,
  'wrestling:greco': WrestlingGrecoPlaybackModule,

  // Baseball
  'baseball:hitting': BaseballHittingPlaybackModule,
  'baseball:pitching': BaseballPitchingPlaybackModule, // ✅ ADD THIS

  // add new ones here later...
};

export function getPlaybackModule(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);
  return { key, Module: Registry[key] ?? null };
}
