import { useEffect, useRef } from 'react';
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

  // Tap = small precise nudge
  onNudge: (direction: -1 | 1) => void;

  // Hold forward = slow-motion jog
  onJogForwardStart: () => void;
  onJogStop: () => void;

  onShowChrome?: () => void;
  onFrameStepStart?: () => void;
};

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
  insets,
  bottomOffset,
  onNudge,
  onJogForwardStart,
  onJogStop,
  onShowChrome,
  onFrameStepStart,
}: Props) {
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (backIntervalRef.current) clearInterval(backIntervalRef.current);
    };
  }, []);

  if (!visible) return null;

  const beginFrameMode = () => {
    onFrameStepStart?.();
    onShowChrome?.();
  };

  const onPressIn = (direction: -1 | 1) => {
    holdingRef.current = false;

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (backIntervalRef.current) clearInterval(backIntervalRef.current);

    holdTimeoutRef.current = setTimeout(() => {
      holdingRef.current = true;
      beginFrameMode();

      if (direction === 1) {
        onJogForwardStart();
      } else {
        backIntervalRef.current = setInterval(() => {
          onNudge(-1);
        }, 140);
      }
    }, 300);
  };

  const onPressOut = (direction: -1 | 1) => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (backIntervalRef.current) {
      clearInterval(backIntervalRef.current);
      backIntervalRef.current = null;
    }

    if (holdingRef.current) {
      onJogStop();
    } else {
      beginFrameMode();
      onNudge(direction);
    }

    holdingRef.current = false;
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
        zIndex: 80,
        elevation: 80,
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
          backgroundColor: 'rgba(0,0,0,0.28)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
        }}
      >
        <Pressable
          onPressIn={() => onPressIn(-1)}
          onPressOut={() => onPressOut(-1)}
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
          onPressIn={() => onPressIn(1)}
          onPressOut={() => onPressOut(1)}
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