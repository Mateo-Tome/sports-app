import { useCallback, useRef, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';

type Insets = { top: number; right: number; bottom: number; left: number };

const fmt = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function TopScrubberNative({
  current,
  duration,
  onSeek,
  insets,
  visible,
  onInteracting,
}: {
  current: number;
  duration: number;
  onSeek: (sec: number) => void;
  insets: Insets;
  visible: boolean;
  onInteracting?: (active: boolean) => void;
}) {
  const screenW = Dimensions.get('window').width;
  const H_MARG = Math.max(12, Math.min(24, screenW * 0.04));
  const MAX_W = 520;
  const width = Math.min(MAX_W, screenW - insets.left - insets.right - H_MARG * 2);

  const TOP = insets.top + 96;
  const TRACK_H = 8;
  const THUMB_D = 28;

  const [localSec, setLocalSec] = useState<number | null>(null);
  const [bubble, setBubble] = useState<{ x: number; t: number } | null>(null);

  const layoutWRef = useRef(0);
  const getW = () => (layoutWRef.current > 0 ? layoutWRef.current : width);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const secToX = useCallback(
    (sec: number) => {
      const w = getW();
      const p = duration ? sec / duration : 0;
      return p * w;
    },
    [duration],
  );
  const xToSec = useCallback(
    (x: number) => {
      const w = getW();
      const p = clamp(x, 0, getW()) / w;
      return (duration || 0) * p;
    },
    [duration],
  );

  const pendingSecRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const flushSeek = useCallback(() => {
    if (pendingSecRef.current == null) {
      rafRef.current = null;
      return;
    }
    const t = pendingSecRef.current;
    pendingSecRef.current = null;
    onSeek(t);
    rafRef.current = null;
  }, [onSeek]);
  const scheduleSeek = useCallback(
    (t: number) => {
      pendingSecRef.current = t;
      if (rafRef.current == null) {
        // @ts-ignore
        rafRef.current = requestAnimationFrame(flushSeek);
      }
    },
    [flushSeek],
  );

  const begin = () => onInteracting?.(true);
  const end = () => {
    onInteracting?.(false);
    setTimeout(() => setBubble(null), 300);
    if (rafRef.current == null && pendingSecRef.current != null) flushSeek();
    setTimeout(() => setLocalSec(null), 60);
  };

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    if (!(duration > 0)) return;
    const x = clamp(e.nativeEvent.x, 0, getW());
    const sec = xToSec(x);
    setLocalSec(sec);
    setBubble({ x, t: sec });
    scheduleSeek(sec);
  };

  const onStateChange = (e: any) => {
    const s = e.nativeEvent.state;
    if (s === State.BEGAN || s === State.ACTIVE) begin();
    if (s === State.END || s === State.CANCELLED || s === State.FAILED) end();
  };

  const effectiveSec = localSec ?? current;
  const thumbX = secToX(effectiveSec);

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: Math.max(H_MARG, insets.left + 12),
        right: Math.max(H_MARG, insets.right + 12),
        top: TOP,
        opacity: visible ? 1 : 0.04,
        zIndex: 50,
        elevation: 3,
      }}
    >
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onStateChange}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        activeOffsetX={[-3, 3]}
      >
        <View
          onLayout={(ev) => {
            const w = ev.nativeEvent.layout.width ?? 0;
            layoutWRef.current = Math.max(1, w);
          }}
          style={{ height: 48, justifyContent: 'center' }}
        >
          <View style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: Math.max(0, getW() - thumbX),
              height: TRACK_H,
              borderRadius: TRACK_H / 2,
              backgroundColor: 'rgba(255,255,255,0.9)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(getW() - THUMB_D, thumbX - THUMB_D / 2)),
              width: THUMB_D,
              height: THUMB_D,
              borderRadius: THUMB_D / 2,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>↔︎</Text>
          </View>

          {bubble && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: Math.max(0, Math.min(getW() - 56, bubble.x - 28)),
                bottom: THUMB_D + 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>{fmt(bubble.t)}</Text>
            </View>
          )}
        </View>
      </PanGestureHandler>
    </View>
  );
}
