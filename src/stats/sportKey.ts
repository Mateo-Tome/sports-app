// src/stats/sportKey.ts
import type { ClipSidecar } from './types';

/**
 * Canonical sportKey builder.
 * Supports BOTH:
 *  - sport="wrestling", style="freestyle"
 *  - sport="wrestling:freestyle" (legacy)
 */
export function sportKeyFromClip(clip: Pick<ClipSidecar, 'sport' | 'style'>): string {
  const rawSport = String(clip?.sport ?? '').trim();
  const rawStyle = String(clip?.style ?? '').trim();

  // Legacy: sport already includes style
  if (rawSport.includes(':')) {
    const [s, st] = rawSport
      .split(':')
      .map((x) => String(x ?? '').trim().toLowerCase())
      .filter(Boolean);

    if (s && st) return `${s}:${st}`;
    if (s) return `${s}:default`;
  }

  const sport = rawSport.toLowerCase() || 'unknown';
  const style = rawStyle.toLowerCase() || 'default';
  return `${sport}:${style}`;
}
