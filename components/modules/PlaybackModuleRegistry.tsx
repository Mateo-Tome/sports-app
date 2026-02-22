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

export function normalizeKey(sport?: string, style?: string) {
  // ✅ IMPORTANT:
  // Your "sport" string sometimes looks like "volleyball:match" (or "wrestling:folkstyle", etc).
  // The registry expects "sport:style" (two segments).
  //
  // So we normalize as:
  //   sportBase = first segment before ":"   (e.g. "volleyball")
  //   inferredStyle = second segment if present (e.g. "match")
  //   finalStyle = explicit style param if provided, else inferredStyle, else "default"
  //
  // This makes ALL of these work:
  // - sport="volleyball", style="default"     => "volleyball:default"
  // - sport="volleyball:match", style=undef   => "volleyball:match"
  // - sport="volleyball:match", style="default" => "volleyball:default" (explicit style wins)
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
  // safe aliases if you ever store basketball as basketball:pickup etc
  // 'basketball:pickup': BasketballPlaybackModule,

  // Volleyball
  'volleyball:default': VolleyballPlaybackModule,
  'volleyball:match': VolleyballPlaybackModule, // ✅ if you store sport as volleyball:match

  // add new ones here later...
};

export function getPlaybackModule(sport?: string, style?: string) {
  const key = normalizeKey(sport, style);
  return { key, Module: Registry[key] ?? null };
}