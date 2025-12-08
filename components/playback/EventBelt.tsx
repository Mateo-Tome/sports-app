// components/playback/EventBelt.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';

export const BELT_H = 76;
export const EDGE_PAD = 24;

type Actor = 'home' | 'opponent' | 'neutral';

export type BeltEventRow = {
  _id?: string;
  t: number;
  kind: string;
  points?: number;
  actor?: Actor;
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

export type EventBeltProps = {
  duration: number;
  current: number;
  events: BeltEventRow[];
  onSeek: (sec: number) => void;
  bottomInset: number;
  colorFor: (e: BeltEventRow) => string;
  onPillLongPress: (ev: BeltEventRow) => void;
  fmt: (sec: number) => string;
  abbrKind: (k?: string) => string;
};

const EventBelt: React.FC<EventBeltProps> = ({
  duration,
  current,
  events,
  onSeek,
  bottomInset,
  colorFor,
  onPillLongPress,
  fmt,
  abbrKind,
}) => {
  const screenW = Dimensions.get('window').width;
  const PILL_W = 64;
  const MIN_GAP = 8;
  const PX_PER_SEC = 10;
  const BASE_LEFT = EDGE_PAD;

  const rowY = (actor?: string) => (actor === 'home' ? 10 : 40);

  const layout = useMemo(() => {
    const twoLane = events.map(e =>
      e.actor === 'home' || e.actor === 'opponent' ? e : { ...e, actor: 'opponent' as const },
    );
    const indexed = twoLane.map((e, i) => ({ e, i }));
    indexed.sort((a, b) => a.e.t - b.e.t || a.i - b.i);

    const lastLeft: Record<'home' | 'opponent', number> = {
      home: BASE_LEFT - PILL_W,
      opponent: BASE_LEFT - PILL_W,
    };

    const items: Array<{ e: BeltEventRow; x: number; y: number; c: string }> = [];

    for (const { e } of indexed) {
      const lane = (e.actor === 'home' ? 'home' : 'opponent') as 'home' | 'opponent';
      const desiredX = e.t * PX_PER_SEC;
      const desiredLeft = Math.max(desiredX - PILL_W / 2, BASE_LEFT);
      const prevLeft = lastLeft[lane];
      const placedLeft = Math.max(desiredLeft, prevLeft + PILL_W + MIN_GAP, BASE_LEFT);
      lastLeft[lane] = placedLeft;

      items.push({
        e,
        x: placedLeft + PILL_W / 2,
        y: rowY(lane),
        c: colorFor(e),
      });
    }

    const maxCenter = items.length ? Math.max(...items.map(it => it.x)) : 0;
    const contentW = Math.max(screenW, maxCenter + PILL_W / 2 + EDGE_PAD);
    return { items, contentW };
  }, [events, screenW, colorFor]);

  const scrollRef = useRef<ScrollView>(null);
  const userScrolling = useRef(false);
  const lastAuto = useRef(0);

  useEffect(() => {
    if (!duration) return;
    if (userScrolling.current) return;

    const playheadX = current * PX_PER_SEC;
    const targetX = Math.max(0, playheadX - screenW * 0.5);
    const nowMs = Date.now();

    if (nowMs - lastAuto.current > 120) {
      scrollRef.current?.scrollTo({ x: targetX, animated: false });
      lastAuto.current = nowMs;
    }
  }, [current, duration, screenW]);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: bottomInset + 4 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (userScrolling.current = true)}
        onScrollEndDrag={() => (userScrolling.current = false)}
        onMomentumScrollBegin={() => (userScrolling.current = true)}
        onMomentumScrollEnd={() => (userScrolling.current = false)}
        contentContainerStyle={{
          height: BELT_H,
          paddingHorizontal: EDGE_PAD,
          width: layout.contentW + EDGE_PAD * 2,
        }}
      >
        <View style={{ width: layout.contentW, height: BELT_H }}>
          <View
            style={{
              position: 'absolute',
              top: BELT_H / 2 - 2,
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          />
          {layout.items.map((it, i) => {
            const isPassed = current >= it.e.t;
            return (
              <Pressable
                key={`${it.e._id ?? 'n'}-${i}`}
                onPress={() => onSeek(it.e.t)}
                onLongPress={() => onPillLongPress(it.e)}
                delayLongPress={280}
                style={{
                  position: 'absolute',
                  left: it.x - PILL_W / 2,
                  top: it.y,
                  width: PILL_W,
                  height: 28,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: it.c,
                  borderWidth: 1,
                  borderColor: it.c,
                  opacity: isPassed ? 0.45 : 1,
                }}
              >
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                  {`${abbrKind(it.e.kind)}${
                    typeof it.e.points === 'number' && it.e.points > 0 ? `+${it.e.points}` : ''
                  }`}
                </Text>

                <Text style={{ color: 'white', opacity: 0.9, fontSize: 9, marginTop: 1 }}>
                  {fmt(it.e.t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default EventBelt;
