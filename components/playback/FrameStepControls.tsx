import { Pressable, View } from 'react-native';

type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Props = {
  visible: boolean;
  current: number;
  duration: number;
  insets: Insets;
  bottomOffset: number;
  fps?: number;
  onSeek: (sec: number) => void;
  onShowChrome?: () => void;
};

function clamp(sec: number, duration: number) {
  const low = Math.max(0, sec);
  if (Number.isFinite(duration) && duration > 0) return Math.min(duration, low);
  return low;
}

function FrameIcon({ direction }: { direction: 'back' | 'forward' }) {
  const flip = direction === 'back';

  return (
    <View
      style={{
        width: 26,
        height: 18,
        transform: [{ scaleX: flip ? -1 : 1 }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 3,
          width: 2,
          height: 18,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      />

      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: 5,
          borderTopWidth: 9,
          borderBottomWidth: 9,
          borderLeftWidth: 14,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'rgba(255,255,255,0.9)',
        }}
      />
    </View>
  );
}

export default function FrameStepControls({
  visible,
  current,
  duration,
  insets,
  bottomOffset,
  fps = 30,
  onSeek,
  onShowChrome,
}: Props) {
  if (!visible) return null;

  const frameStep = 1 / fps;

  const step = (direction: -1 | 1) => {
    const next = clamp((current || 0) + frameStep * direction, duration || 0);
    onSeek(next);
    onShowChrome?.();
  };

  const buttonStyle = {
    width: 74,
    height: 42,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: insets.left + 74,
        right: insets.right + 74,
        bottom: bottomOffset,
        zIndex: 12,
        elevation: 12,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 24,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.18)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
        }}
      >
        <Pressable
          onPress={() => step(-1)}
          style={({ pressed }) => [
            buttonStyle,
            {
              opacity: pressed ? 0.55 : 1,
              backgroundColor: pressed
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(255,255,255,0.10)',
            },
          ]}
        >
          <FrameIcon direction="back" />
        </Pressable>

        <Pressable
          onPress={() => step(1)}
          style={({ pressed }) => [
            buttonStyle,
            {
              opacity: pressed ? 0.55 : 1,
              backgroundColor: pressed
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(255,255,255,0.10)',
            },
          ]}
        >
          <FrameIcon direction="forward" />
        </Pressable>
      </View>
    </View>
  );
}