import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PlaybackDockProps = {
  isPlaying: boolean;
  current: number;
  duration: number;
  markers?: number[];
  onTogglePlay?: () => void;
  onSeek?: (sec: number) => void;
  rightAccessory?: React.ReactNode; // optional sport-specific chip (score, clock, etc.)
};

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaybackDock({
  isPlaying,
  current,
  duration,
  markers = [],
  onTogglePlay,
  onSeek,
  rightAccessory,
}: PlaybackDockProps) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const barWidthRef = useRef(0);
  const [barWidth, setBarWidth] = useState(0);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(1, Math.max(0, current / duration));
  }, [current, duration]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }, []);

  const handleBarLayout = useCallback((e: any) => {
    const w = e.nativeEvent.layout.width;
    barWidthRef.current = w;
    setBarWidth(w);
  }, []);

  const seekTo = useCallback(
    (x: number) => {
      if (!onSeek || !duration || barWidthRef.current <= 0) return;
      const pct = Math.min(1, Math.max(0, x / barWidthRef.current));
      onSeek(duration * pct);
    },
    [onSeek, duration]
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => seekTo(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => seekTo(evt.nativeEvent.locationX),
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12 + Math.max(insets.bottom, 8),
      }}
    >
      <View
        style={{
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: expanded ? 12 : 8,
        }}
      >
        {/* Handle */}
        <Pressable onPress={toggleExpanded} style={{ alignItems: 'center', paddingBottom: expanded ? 8 : 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        </Pressable>

        {/* Row: Play + Time + Accessory */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={onTogglePlay}
            style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>
              {isPlaying ? '❚❚' : '▶︎'}
            </Text>
          </Pressable>

          <Text style={{ color: '#fff' }}>
            {formatTime(current)} / {formatTime(duration)}
          </Text>

          <View style={{ flex: 1 }} />

          {rightAccessory /* optional chip */}

          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            {expanded ? 'Less' : 'More'}
          </Text>
        </View>

        {/* Progress + markers */}
        <View
          onLayout={handleBarLayout}
          {...pan.panHandlers}
          style={{ marginTop: 10, height: expanded ? 18 : 12, justifyContent: 'center' }}
        >
          <View style={{ height: expanded ? 6 : 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: 'white' }} />
          </View>

          {!!duration && barWidth > 0 &&
            markers.map((m, i) => {
              const leftPx = (m / duration) * barWidth;
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: leftPx,
                    transform: [{ translateX: -1 }],
                    width: 2,
                    height: expanded ? 14 : 10,
                    borderRadius: 1,
                    backgroundColor: 'rgba(255,255,255,0.8)',
                  }}
                />
              );
            })}
        </View>
      </View>
    </View>
  );
}



