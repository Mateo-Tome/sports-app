import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

type Insets = { top: number; right: number; bottom: number; left: number };

const fmt = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function TopScrubberWeb({
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
  const TOP = insets.top + 96;

  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastValRef = useRef<number>(0);

  const max = Math.max(0, Number(duration || 0));

  const effective = useMemo(() => {
    const v = dragValue ?? current ?? 0;
    return Number.isFinite(v) ? v : 0;
  }, [current, dragValue]);

  if (!visible) return null;

  const commit = () => {
    onSeek(lastValRef.current);
    setDragValue(null);
    onInteracting?.(false);
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: Math.max(12, insets.left + 12),
        right: Math.max(12, insets.right + 12),
        top: TOP,
        zIndex: 50,
      }}
      pointerEvents="auto"
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{fmt(effective)}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{fmt(max)}</Text>
      </View>

      {/* @ts-ignore RN-web supports native input */}
      <input
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={Math.max(0, Math.min(max, effective))}
        onMouseDown={() => onInteracting?.(true)}
        onTouchStart={() => onInteracting?.(true)}
        onChange={(e: any) => {
          const v = Number(e.target.value);
          lastValRef.current = v;
          setDragValue(v);
        }}
        onMouseUp={commit}
        onTouchEnd={commit}
        style={{ width: '100%' }}
      />
    </View>
  );
}
