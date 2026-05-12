import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

export type AvReviewPlayerHandle = {
  seekByFrame: (direction: -1 | 1) => Promise<void>;
  seekTo: (sec: number) => Promise<void>;
  playPause: () => Promise<void>;
  pause: () => Promise<void>;
};

const FRAME_MS = 1000 / 30;

type Props = {
  uri: string;
  style: any;
  onTimeUpdate?: (sec: number, duration: number, isPlaying: boolean) => void;
};

const AvReviewPlayer = forwardRef<AvReviewPlayerHandle, Props>(
  ({ uri, style, onTimeUpdate }, ref) => {
    const videoRef = useRef<Video | null>(null);
    const positionMsRef = useRef(0);
    const durationMsRef = useRef(0);
    const isPlayingRef = useRef(false);

    const [loaded, setLoaded] = useState(false);

    const seekToMs = async (ms: number) => {
      const duration = durationMsRef.current || ms;
      const clamped = Math.max(0, Math.min(duration, ms));

      positionMsRef.current = clamped;

      await videoRef.current?.setPositionAsync(clamped, {
        toleranceMillisBefore: 0,
        toleranceMillisAfter: 0,
      });

      onTimeUpdate?.(clamped / 1000, durationMsRef.current / 1000, false);
    };

    useImperativeHandle(ref, () => ({
      seekByFrame: async (direction: -1 | 1) => {
        await videoRef.current?.pauseAsync();
        await seekToMs(positionMsRef.current + direction * FRAME_MS);
      },

      seekTo: async (sec: number) => {
        await videoRef.current?.pauseAsync();
        await seekToMs(sec * 1000);
      },

      playPause: async () => {
        if (isPlayingRef.current) {
          await videoRef.current?.pauseAsync();
        } else {
          await videoRef.current?.playAsync();
        }
      },

      pause: async () => {
        await videoRef.current?.pauseAsync();
      },
    }));

    return (
      <View style={style}>
        <Video
          ref={(r) => {
            videoRef.current = r;
          }}
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          useNativeControls={false}
          onReadyForDisplay={() => setLoaded(true)}
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;

            positionMsRef.current = status.positionMillis ?? 0;
            durationMsRef.current = status.durationMillis ?? 0;
            isPlayingRef.current = status.isPlaying ?? false;

            onTimeUpdate?.(
              positionMsRef.current / 1000,
              durationMsRef.current / 1000,
              isPlayingRef.current,
            );
          }}
        />
      </View>
    );
  },
);

export default AvReviewPlayer;