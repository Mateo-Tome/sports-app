// app/components/overlays/index.ts
import React from 'react';
import type { OverlayProps } from './types';
import WrestlingFolkstyleOverlay from './WrestlingFolkstyleOverlay';

export type OverlayComponent = React.ComponentType<OverlayProps>;

export function getOverlayFor(sport: string, style: string): OverlayComponent | null {
  const s = (sport ?? '').trim().toLowerCase();
  const st = (style ?? '').trim().toLowerCase();

  if (s === 'wrestling') {
    if (st === 'folkstyle' || st === 'folk' || st === 'fs') {
      return WrestlingFolkstyleOverlay;
    }
    // you can add more styles here:
    // if (st === 'freestyle') return WrestlingFreestyleOverlay;
    // if (st === 'greco') return WrestlingGrecoOverlay;
  }

  return null;
}

export default getOverlayFor;



