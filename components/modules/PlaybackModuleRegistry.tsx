import React from 'react';
import type { PlaybackModuleProps } from './types';

import BaseballHittingPlaybackModule from './baseball/BaseballHittingPlaybackModule';
import BaseballPitchingPlaybackModule from './baseball/BaseballPitchingPlaybackModule';

import SoftballHittingPlaybackModule from './softball/SoftballHittingPlaybackModule';
import SoftballPitchingPlaybackModule from './softball/SoftballPitchingPlaybackModule';

import WrestlingFolkstylePlaybackModule from './wrestling/WrestlingFolkstylePlaybackModule';
import WrestlingFreestylePlaybackModule from './wrestling/WrestlingFreestylePlaybackModule';
import WrestlingGrecoPlaybackModule from './wrestling/WrestlingGrecoPlaybackModule';

import BasketballPlaybackModule from './basketball/BasketballPlaybackModule';
import BJJPlaybackModule from './bjj/BJJPlaybackModule';
import VolleyballPlaybackModule from './volleyball/VolleyballPlaybackModule';

import SwimmingPlaybackModule from './swimming/SwimmingPlaybackModule';

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

  // Softball
  'softball:hitting': SoftballHittingPlaybackModule,
  'softball:pitching': SoftballPitchingPlaybackModule,

  // Swimming
  'swimming:race': SwimmingPlaybackModule,
  'swimming:default': SwimmingPlaybackModule,

  // Basketball
  'basketball:default': BasketballPlaybackModule,

  // Volleyball
  'volleyball:default': VolleyballPlaybackModule,
  'volleyball:match': VolleyballPlaybackModule,

  // BJJ
  'bjj:default': BJJPlaybackModule,
  'bjj:gi': BJJPlaybackModule,
  'bjj:nogi': BJJPlaybackModule,

  // BJJ aliases
  'jiujitsu:default': BJJPlaybackModule,
  'jiu-jitsu:default': BJJPlaybackModule,
  'brazilianjiujitsu:default': BJJPlaybackModule,
};

export function getPlaybackModule(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);

  console.log('[PlaybackModuleRegistry] sport/style/key =', sport, style, '=>', key);

  return { key, Module: Registry[key] ?? null };
}