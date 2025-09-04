// components/overlays/index.ts
import { ComponentType } from 'react';
import { OverlayProps } from './types';

import WrestlingFolkstyleOverlay from './WrestlingFolkstyleOverlay';
import WrestlingFreestyleOverlay from './wrestlingFreestyleOverlay';
import WrestlingGrecoOverlay from './wrestlingGrecoOverlay';

type OverlayComp = ComponentType<OverlayProps>;

export const overlayRegistry: Record<string, OverlayComp> = {
  'wrestling:folkstyle': WrestlingFolkstyleOverlay,
  'wrestling:freestyle': WrestlingFreestyleOverlay,
  'wrestling:greco': WrestlingGrecoOverlay,
};

export function getOverlayFor(sport: string, style: string): OverlayComp | null {
  const key = `${sport}:${style}`;
  return overlayRegistry[key] ?? null;
}


