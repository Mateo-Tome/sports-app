import { useMemo } from 'react';

export function useRecordingStartGuard() {
  const showRotateHelper = useMemo(() => true, []);

  return {
    orientation: null,
    isLandscapeReady: false,
    showRotateHelper,
  };
}