import { ResizeMode, Video } from 'expo-av';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const FRAME_MS = 1000 / 30;

export default function AvFrameTest() {
  const router = useRouter();
  const videoRef = useRef<Video | null>(null);

  const params = useLocalSearchParams<{ videoPath?: string }>();
  const videoPath =
    typeof params.videoPath === 'string'
      ? params.videoPath
      : Array.isArray(params.videoPath)
        ? params.videoPath[0]
        : '';

  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const seekTo = async (nextMs: number) => {
    const clamped = Math.max(0, Math.min(durationMs || nextMs, nextMs));
    setPositionMs(clamped);

    await videoRef.current?.setPositionAsync(clamped, {
      toleranceMillisBefore: 0,
      toleranceMillisAfter: 0,
    });
  };

  const step = async (dir: -1 | 1) => {
    await videoRef.current?.pauseAsync();
    await seekTo(positionMs + dir * FRAME_MS);
  };

  if (!videoPath) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
          Missing videoPath
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <Video
        ref={(ref) => {
          videoRef.current = ref;
        }}
        source={{ uri: videoPath }}
        style={{ flex: 1 }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        useNativeControls={false}
        onPlaybackStatusUpdate={(status) => {
          if (!status.isLoaded) return;
          setPositionMs(status.positionMillis ?? 0);
          setDurationMs(status.durationMillis ?? 0);
        }}
      />

      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 50,
          flexDirection: 'row',
          gap: 12,
          justifyContent: 'center',
        }}
      >
        <Pressable
          onPress={() => step(-1)}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.16)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>◀ Frame</Text>
        </Pressable>

        <Pressable
          onPress={() => step(1)}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.16)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>Frame ▶</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: 60,
          left: 20,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>Back</Text>
      </Pressable>
    </View>
  );
}