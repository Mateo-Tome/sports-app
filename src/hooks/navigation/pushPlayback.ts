import type { Router } from 'expo-router';

type LocalPlaybackParams = {
  kind: 'local';
  videoPath: string;
  athlete?: string;
  sport?: string;
  displayName?: string;
};

type CloudPlaybackParams = {
  kind: 'cloud';
  shareId: string;
  athlete?: string;
  sport?: string;
  displayName?: string;
};

export type PushPlaybackParams = LocalPlaybackParams | CloudPlaybackParams;

export function pushPlayback(router: Router, p: PushPlaybackParams) {
  router.push({
    pathname: '/screens/PlaybackScreen',
    params:
      p.kind === 'local'
        ? {
            videoPath: p.videoPath,
            athlete: p.athlete,
            sport: p.sport,
            displayName: p.displayName,
          }
        : {
            shareId: p.shareId,
            athlete: p.athlete,
            sport: p.sport,
            displayName: p.displayName,
          },
  });
}
