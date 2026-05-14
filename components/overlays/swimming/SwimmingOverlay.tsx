import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OverlayProps } from '../types';

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.000';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function niceStroke(stroke?: string) {
  const v = String(stroke ?? '').toLowerCase();
  if (v.includes('free')) return 'Free';
  if (v.includes('back')) return 'Back';
  if (v.includes('breast')) return 'Breast';
  if (v.includes('fly') || v.includes('butter')) return 'Fly';
  if (v.includes('im')) return 'IM';
  return '';
}

const LiveRaceTimer = memo(function LiveRaceTimer({
  running,
  finishedText,
  startMsRef,
}: {
  running: boolean;
  finishedText: string;
  startMsRef: React.MutableRefObject<number | null>;
}) {
  const [text, setText] = useState('00:00.000');

  useEffect(() => {
    if (!running) {
      setText(finishedText);
      return;
    }

    const id = setInterval(() => {
      const start = startMsRef.current ?? Date.now();
      const elapsed = Math.max(0, (Date.now() - start) / 1000);
      setText(formatTime(elapsed));
    }, 33);

    return () => clearInterval(id);
  }, [running, finishedText, startMsRef]);

  return (
    <Text allowFontScaling={false} style={{ color: 'white', fontSize: 19, fontWeight: '900' }}>
      {text}
    </Text>
  );
});

export default function SwimmingOverlay({
  isRecording,
  getCurrentTSec,
  onEvent,
  stroke,
  distance,
  raceLabel,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();

  const startMsRef = useRef<number | null>(null);
  const lastSplitMsRef = useRef<number | null>(null);

  const raceStartedRef = useRef(false);
  const raceFinishedRef = useRef(false);
  const turnsRef = useRef(0);
  const strokesRef = useRef(0);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [raceStarted, setRaceStarted] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [turns, setTurns] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [finalTimeText, setFinalTimeText] = useState('00:00.000');
  const [flash, setFlash] = useState<string | null>(null);

  const title = useMemo(() => {
    const label = String(raceLabel ?? '').trim();
    const dist = String(distance ?? '').trim();
    const strokeName = niceStroke(stroke);

    if (label) return label;             // should show "50 Free"
    if (dist && strokeName) return `${dist} ${strokeName}`;
    if (dist) return dist;
    if (strokeName) return strokeName;
    return 'NO RACE SELECTED';
  }, [raceLabel, distance, stroke]);

  const elapsedNow = () => {
    const start = startMsRef.current ?? Date.now();
    return Math.max(0, (Date.now() - start) / 1000);
  };

  const showFlash = (text: string, ms = 550) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(text);
    flashTimerRef.current = setTimeout(() => setFlash(null), ms);
  };

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const fire = (key: string, label: string, meta: Record<string, any> = {}) => {
    if (!isRecording) return;

    onEvent({
      key,
      kind: key,
      label,
      actor: 'neutral',
      meta: {
        sport: 'swimming',
        style: 'race',
        stroke,
        distance,
        raceLabel: title,
        pillLabel: label,
        videoTimeSec: getCurrentTSec(),
        ...meta,
      },
    });
  };

  const startRace = () => {
    if (!isRecording) {
      showFlash('Press record first');
      return;
    }
    if (raceStartedRef.current || raceFinishedRef.current) return;

    const now = Date.now();

    startMsRef.current = now;
    lastSplitMsRef.current = now;
    raceStartedRef.current = true;
    raceFinishedRef.current = false;
    turnsRef.current = 0;
    strokesRef.current = 0;

    setRaceStarted(true);
    setRaceFinished(false);
    setTurns(0);
    setStrokes(0);
    setFinalTimeText('00:00.000');

    fire('start_race', 'Start', {
      raceElapsedSec: 0,
      raceLabel: title,
      stroke,
      distance,
    });

    showFlash('START');
  };

  const finishRace = () => {
    if (!isRecording || !raceStartedRef.current || raceFinishedRef.current) return;

    const finalTimeSec = elapsedNow();
    const text = formatTime(finalTimeSec);

    raceFinishedRef.current = true;
    setRaceFinished(true);
    setFinalTimeText(text);

    fire('finish_race', 'Finish', {
      finalTimeSec,
      turnCount: turnsRef.current,
      strokeCount: strokesRef.current,
      raceLabel: title,
      stroke,
      distance,
    });

    showFlash(`FINISH ${text}`, 1200);
  };

  const turnSplit = () => {
    if (!isRecording || !raceStartedRef.current || raceFinishedRef.current) {
      showFlash('Press START first');
      return;
    }

    const now = Date.now();
    const start = startMsRef.current ?? now;
    const last = lastSplitMsRef.current ?? start;

    const splitDurationSec = Math.max(0, (now - last) / 1000);
    const raceElapsedSec = Math.max(0, (now - start) / 1000);

    lastSplitMsRef.current = now;

    const next = turnsRef.current + 1;
    turnsRef.current = next;
    setTurns(next);

    fire('turn_split', `Turn/Split ${next}`, {
      turnNumber: next,
      splitDurationSec,
      raceElapsedSec,
      raceLabel: title,
      stroke,
      distance,
    });

    showFlash(`TURN ${next}`);
  };

  const addStroke = () => {
    if (!isRecording || !raceStartedRef.current || raceFinishedRef.current) {
      showFlash('Press START first');
      return;
    }

    const next = strokesRef.current + 1;
    strokesRef.current = next;
    setStrokes(next);

    fire('stroke_count', `Stroke ${next}`, {
      strokeCount: next,
      raceElapsedSec: elapsedNow(),
      raceLabel: title,
      stroke,
      distance,
    });
  };

  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;

  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);
  const GAP = 10;
  const BTN_H = Math.max(62, Math.min(82, Math.floor((availableHeight - GAP) / 2)));
  const BTN_W = 132;

  const SwimButton = ({
    label,
    sub,
    onPress,
    bg,
  }: {
    label: string;
    sub?: string;
    onPress: () => void;
    bg: string;
  }) => (
    <TouchableOpacity
      activeOpacity={0.55}
      onPress={onPress}
      hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
      style={{
        width: BTN_W,
        height: BTN_H,
        borderRadius: 24,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.55)',
        elevation: 2,
      }}
    >
      <Text allowFontScaling={false} style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>
        {label}
      </Text>

      {!!sub && (
        <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '900', fontSize: 13, marginTop: 4 }}>
          {sub}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -42,
          alignSelf: 'center',
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 16,
          backgroundColor: 'rgba(0,0,0,0.72)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
          maxWidth: '60%',
        }}
      >
        <Text allowFontScaling={false} numberOfLines={1} style={{ color: 'white', fontSize: 13, fontWeight: '900' }}>
          {title}
        </Text>
      </View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -46,
          right: EDGE_R,
          borderRadius: 16,
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: 'rgba(0,0,0,0.72)',
          minWidth: 154,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(125,211,252,0.55)',
        }}
      >
        <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.62)', fontSize: 9, fontWeight: '900' }}>
          RACE TIMER
        </Text>

        <LiveRaceTimer
          running={raceStarted && !raceFinished}
          finishedText={finalTimeText}
          startMsRef={startMsRef}
        />
      </View>

      {!!flash && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 8, alignSelf: 'center', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: 'rgba(14,165,233,0.96)', zIndex: 50 }}>
          <Text allowFontScaling={false} style={{ color: 'white', fontWeight: '900' }}>
            {flash}
          </Text>
        </View>
      )}

      <View pointerEvents="box-none" style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, justifyContent: 'center' }}>
        <SwimButton
          label={!raceStarted ? 'START' : raceFinished ? 'DONE' : 'FINISH'}
          sub={!raceStarted ? 'race' : raceFinished ? finalTimeText : 'race'}
          onPress={!raceStarted ? startRace : finishRace}
          bg={!raceStarted ? 'rgba(14,165,233,0.96)' : 'rgba(239,68,68,0.96)'}
        />
      </View>

      <View pointerEvents="box-none" style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, justifyContent: 'center', gap: GAP }}>
        <SwimButton label="TURN/SPLIT" sub={`${turns}`} onPress={turnSplit} bg="rgba(0,0,0,0.84)" />
        <SwimButton label="STROKE" sub={`${strokes}`} onPress={addStroke} bg="rgba(0,0,0,0.84)" />
      </View>
    </View>
  );
}