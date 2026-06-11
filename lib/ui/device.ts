import { Platform } from 'react-native';

export function isTabletSize(width: number, height: number) {
  const shortestSide = Math.min(width, height);
  return Platform.OS === 'ios' && shortestSide >= 768;
}

export function overlayScale(width: number, height: number) {
  return isTabletSize(width, height) ? 1.18 : 1;
}

export function overlayGap(width: number, height: number) {
  return isTabletSize(width, height) ? 14 : 10;
}

export function overlayEdge(width: number, height: number) {
  return isTabletSize(width, height) ? 22 : 10;
}