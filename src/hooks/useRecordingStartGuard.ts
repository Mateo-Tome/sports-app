import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

export type RecordingOrientationKind = 'portrait' | 'landscape' | 'unknown';

function getWindowOrientation(): RecordingOrientationKind {
  const { width, height } = Dimensions.get('window');
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'unknown';
}

export function useRecordingStartGuard() {
  const [orientation, setOrientation] = useState<RecordingOrientationKind>(getWindowOrientation);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      if (window.width > window.height) setOrientation('landscape');
      else if (window.height > window.width) setOrientation('portrait');
      else setOrientation('unknown');
    });

    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, []);

  const isLandscapeReady = orientation === 'landscape';

  return {
    orientation,
    windowOrientation: orientation,
    expoOrientation: orientation,
    isLandscapeReady,
    showRotateHelper: !isLandscapeReady,
  };
}