// components/modules/baseball/BaseballHittingPlaybackModule.tsx
import React, { useMemo, useState } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { PlaybackModuleProps } from '../types';

// Keep these in sync with BaseballHittingOverlay
const BALL_COLOR = '#22c55e';     // green
const STRIKE_COLOR = '#ef4444';   // red
const FOUL_COLOR = '#eab308';     // yellow
const HIT_COLOR = '#22c55e';      // green
const OUT_COLOR = '#f97316';      // orange
const HR_COLOR = '#eab308';       // yellow/gold
const WALK_COLOR = '#0ea5e9';     // cyan/blue for walk
const K_COLOR = '#CF1020';        // fire truck red
const FRAME_COLOR = 'rgba(255,255,255,0.35)';

const KEY_COLOR: Record<string, string> = {
  ball: BALL_COLOR,
  strike: STRIKE_COLOR,
  foul: FOUL_COLOR,
  hit: HIT_COLOR,
  out: OUT_COLOR,
  homerun: HR_COLOR,
  walk: WALK_COLOR,
  strikeout: K_COLOR,
};

/** Tiny visual confirmation toast (no haptics) */
function FlashToast({
  text,
  tint,
  top,
  center = true,
  onDone,
}: {
  text: string;
  tint: string;
  top: number;
  center?: boolean;
  onDone?: () => void;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(6)).current;

  React.useEffect(() => {
    const animIn = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]);
    const animOut = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        delay: 750,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -6,
        duration: 150,
        delay: 750,
        useNativeDriver: true,
      }),
    ]);
    animIn.start(() => {
      animOut.start(({ finished }) => finished && onDone?.());
    });
  }, [opacity, translateY, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left: center ? undefined : 12,
        right: center ? undefined : 12,
        alignSelf: center ? 'center' : 'auto',
        opacity,
        transform: [{ translateY }],
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: tint,
        zIndex: 100,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900' }}>{text}</Text>
    </Animated.View>
  );
}

export default function BaseballHittingPlaybackModule({
  overlayOn,
  insets,
  editMode,
  editSubmode,
  onOverlayEvent,
  events,
  now,           // we use `now` from PlaybackScreen
}: PlaybackModuleProps) {
  // respect overlay mode: when overlayOn is false, hide all baseball UI
  if (!overlayOn) return null;

  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;
  const isPortrait = screenH >= screenW;

  // Same layout math as overlay
  const EDGE_L = insets.left + 10;
  const EDGE_R = insets.right + 10;
  const TOP = insets.top + 52;
  const BOTTOM = insets.bottom + 92;

  const availableHeight = Math.max(0, dims.height - TOP - BOTTOM);
  const ROWS = 3;
  const GAP = 10;
  const maxSize = Math.floor((availableHeight - (ROWS - 1) * GAP) / ROWS);
  const SIZE = Math.max(44, Math.min(70, maxSize));
  const BTN_SIZE = Math.round(SIZE * 0.75); // 25% smaller

  const CHOOSER_TOP = isPortrait ? TOP + 40 : TOP + 10;

  // Are we in edit/replace palette mode?
  const showPalette = !!editMode && (editSubmode === 'add' || editSubmode === 'replace');

  // ======== COUNT FROM EVENTS FOR NORMAL PLAYBACK =========
  const lastCount = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return null;
    let found: { balls: number; strikes: number; fouls: number } | null = null;

    for (let i = 0; i < events.length; i++) {
      const row: any = events[i];

      // Only consider events up to the current playback time
      if (typeof row.t === 'number' && row.t > now) break;

      const m = row?.meta;
      if (!m) continue;

      const hasCountMeta =
        typeof m.balls === 'number' ||
        typeof m.strikes === 'number' ||
        typeof m.fouls === 'number' ||
        typeof m.ballsAfter === 'number' ||
        typeof m.strikesAfter === 'number' ||
        typeof m.foulsAfter === 'number';

      if (hasCountMeta) {
        found = {
          balls:
            typeof m.ballsAfter === 'number'
              ? m.ballsAfter
              : typeof m.balls === 'number'
              ? m.balls
              : 0,
          strikes:
            typeof m.strikesAfter === 'number'
              ? m.strikesAfter
              : typeof m.strikes === 'number'
              ? m.strikes
              : 0,
          fouls:
            typeof m.foulsAfter === 'number'
              ? m.foulsAfter
              : typeof m.fouls === 'number'
              ? m.fouls
              : 0,
        };
      }
    }

    return found;
  }, [events, now]);

  const derivedBalls = lastCount?.balls ?? 0;
  const derivedStrikes = lastCount?.strikes ?? 0;
  // fouls are tracked but not displayed in the playback pill

  // ======== LOCAL STATE FOR EDIT MODE (overlay-style) =========
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [outs, setOuts] = useState(0);

  const [resultChooserOpen, setResultChooserOpen] = useState(false);
  const [strikeoutChooserOpen, setStrikeoutChooserOpen] = useState(false);
  const [hrConfirmOpen, setHrConfirmOpen] = useState(false);
  const [toast, setToast] =
    useState<null | { text: string; tint: string }>(null);

  const showToast = (text: string, tint: string) => setToast({ text, tint });

  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
    setFouls(0);
  };

  const fire = (key: string, label: string, extraMeta?: Record<string, any>) => {
    const color = KEY_COLOR[key] ?? 'rgba(148,163,184,0.9)';

    onOverlayEvent?.({
      key,
      label,
      actor: 'neutral',
      value: undefined,
      meta: {
        color,
        tint: color,
        buttonColor: color,
        chipColor: color,
        balls,
        strikes,
        fouls,
        outs,
        ...(extraMeta || {}),
      },
    });
  };

  // --- Count actions --------------------------------------------------------
  const onBall = () => {
    setBalls(prev => {
      const next = Math.min(prev + 1, 4);
      fire('ball', 'Ball', { ballsAfter: next });
      showToast(`Ball ${next}`, BALL_COLOR);
      return next;
    });
  };

  const onStrike = () => {
    setStrikes(prev => {
      const next = Math.min(prev + 1, 3);
      fire('strike', 'Strike', { strikesAfter: next });
      showToast(`Strike ${next}`, STRIKE_COLOR);
      return next;
    });
  };

  const onFoul = () => {
    setFouls(prevFouls => {
      let nextStrikes: number;
      setStrikes(prevStrikes => {
        nextStrikes = prevStrikes < 2 ? prevStrikes + 1 : prevStrikes;
        fire('foul', 'Foul Ball', {
          foulsAfter: prevFouls + 1,
          strikesAfter: nextStrikes,
        });
        return nextStrikes;
      });
      const newFouls = prevFouls + 1;
      showToast(`Foul (${newFouls})`, FOUL_COLOR);
      return newFouls;
    });
  };

  const incrementOuts = (type: string) => {
    setOuts(prev => {
      const next = Math.min(prev + 1, 3);
      fire('out', 'Out', { type, outsAfter: next });
      showToast(type, OUT_COLOR);
      return next;
    });
    resetCount();
  };

  const recordHit = (type: 'single' | 'double' | 'triple' | 'bunt') => {
    fire('hit', 'Hit', { type });
    showToast(
      type === 'single'
        ? 'Single'
        : type === 'double'
        ? 'Double'
        : type === 'triple'
        ? 'Triple'
        : 'Bunt',
      HIT_COLOR,
    );
    resetCount();
  };

  const recordHomerun = () => {
    fire('homerun', 'Home Run', { type: 'homerun' });
    showToast('Home Run', HR_COLOR);
    resetCount();
  };

  const recordWalk = () => {
    fire('walk', 'Walk', { type: 'walk' });
    showToast('Walk', WALK_COLOR);
    resetCount();
  };

  const recordStrikeout = (kind: 'swinging' | 'looking') => {
    setOuts(prev => {
      const next = Math.min(prev + 1, 3);
      fire('strikeout', 'Strikeout', { kind, outsAfter: next });
      const label = kind === 'swinging' ? 'K Swinging' : 'K Looking';
      showToast(label, K_COLOR);
      return next;
    });
    resetCount();
  };

  // --- Shared button components --------------------------------------------
  const Circle = ({
    label,
    bg,
    onPress,
  }: {
    label: string;
    bg: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: BTN_SIZE / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const PopupFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: CHOOSER_TOP,
        left: EDGE_L,
        right: EDGE_R,
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <View
        style={{
          maxWidth: screenW - (EDGE_L + EDGE_R),
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderWidth: 1,
          borderColor: FRAME_COLOR,
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        {children}
      </View>
    </View>
  );

  // --- Hit + Out chooser ----------------------------------------------------
  const HitOutChooser = () => {
    if (!showPalette || !resultChooserOpen) return null;

    const HitChip = ({
      label,
      type,
    }: {
      label: string;
      type: 'single' | 'double' | 'triple' | 'bunt';
    }) => (
      <TouchableOpacity
        onPress={() => {
          setResultChooserOpen(false);
          recordHit(type);
        }}
        style={{
          height: 40,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: HIT_COLOR,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 6,
          marginVertical: 4,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>{label}</Text>
      </TouchableOpacity>
    );

    const OutChip = ({ label }: { label: string }) => (
      <TouchableOpacity
        onPress={() => {
          setResultChooserOpen(false);
          incrementOuts(label);
        }}
        style={{
          height: 40,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: OUT_COLOR,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 6,
          marginVertical: 4,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>{label}</Text>
      </TouchableOpacity>
    );

    return (
      <PopupFrame>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 14,
              marginBottom: 6,
              textAlign: 'center',
            }}
          >
            Select Result
          </Text>

          {/* Hits */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontWeight: '700',
              marginTop: 4,
              marginBottom: 2,
            }}
          >
            Hits
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HitChip label="Single" type="single" />
            <HitChip label="Double" type="double" />
            <HitChip label="Triple" type="triple" />
            <HitChip label="Bunt" type="bunt" />
          </View>

          {/* Outs */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontWeight: '700',
              marginTop: 8,
              marginBottom: 2,
            }}
          >
            Outs
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OutChip label="Ground Out" />
            <OutChip label="Flyout" />
            <OutChip label="Fielder's Choice" />
          </View>

          <TouchableOpacity
            onPress={() => setResultChooserOpen(false)}
            style={{
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PopupFrame>
    );
  };

  // --- Strikeout chooser ----------------------------------------------------
  const StrikeoutChooser = () => {
    if (!showPalette || !strikeoutChooserOpen) return null;

    const KChip = ({
      label,
      kind,
    }: {
      label: string;
      kind: 'swinging' | 'looking';
    }) => (
      <TouchableOpacity
        onPress={() => {
          setStrikeoutChooserOpen(false);
          recordStrikeout(kind);
        }}
        style={{
          height: 40,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: K_COLOR,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 6,
          marginVertical: 4,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>{label}</Text>
      </TouchableOpacity>
    );

    return (
      <PopupFrame>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 14,
              marginBottom: 6,
              textAlign: 'center',
            }}
          >
            Strikeout Type
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KChip label="K Swinging" kind="swinging" />
            <KChip label="K Looking" kind="looking" />
          </View>
          <TouchableOpacity
            onPress={() => setStrikeoutChooserOpen(false)}
            style={{
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </PopupFrame>
    );
  };

  // --- Homerun confirm ------------------------------------------------------
  const HomerunConfirm = () => {
    if (!showPalette || !hrConfirmOpen) return null;

    return (
      <PopupFrame>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 14,
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            Confirm Home Run?
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              onPress={() => setHrConfirmOpen(false)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: FRAME_COLOR,
                marginRight: 8,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setHrConfirmOpen(false);
                recordHomerun();
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: HR_COLOR,
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>Confirm HR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PopupFrame>
    );
  };

  // --- Count pill at the very top ------------------------------------------
  const displayBalls = showPalette ? balls : derivedBalls;
  const displayStrikes = showPalette ? strikes : derivedStrikes;

  const CountBar = () => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          paddingHorizontal: 10,  // ~25% smaller
          paddingVertical: 4,     // ~25% smaller
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.65)',
          borderWidth: 1,
          borderColor: FRAME_COLOR,
        }}
      >
        {/* Words colored, numbers white */}
        <Text style={{ fontSize: 11 }}>
          <Text style={{ color: BALL_COLOR, fontWeight: '800' }}>Balls: </Text>
          <Text style={{ color: 'white', fontWeight: '900' }}>
            {displayBalls}
          </Text>
          <Text style={{ color: 'white' }}>   </Text>
          <Text style={{ color: STRIKE_COLOR, fontWeight: '800' }}>Strikes: </Text>
          <Text style={{ color: 'white', fontWeight: '900' }}>
            {displayStrikes}
          </Text>
        </Text>
      </View>
    </View>
  );

  // --- Left / Right stacks --------------------------------------------------
  const LeftStack = () => {
    if (!showPalette) return null;
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: EDGE_L,
          top: TOP,
          bottom: BOTTOM,
          justifyContent: 'center',
        }}
      >
        <View style={{ gap: GAP }}>
          <Circle label="Ball" bg={BALL_COLOR} onPress={onBall} />
          <Circle label="Strike" bg={STRIKE_COLOR} onPress={onStrike} />
          <Circle label="Foul" bg={FOUL_COLOR} onPress={onFoul} />
        </View>
      </View>
    );
  };

  const RightStack = () => {
    if (!showPalette) return null;
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: EDGE_R,
          top: TOP,
          bottom: BOTTOM,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ gap: GAP }}>
          <Circle
            label="Result"
            bg={HIT_COLOR}
            onPress={() => setResultChooserOpen(true)}
          />
          <Circle
            label="K"
            bg={K_COLOR}
            onPress={() => setStrikeoutChooserOpen(true)}
          />
          <Circle
            label="HR"
            bg={HR_COLOR}
            onPress={() => setHrConfirmOpen(true)}
          />
          <Circle
            label="Walk"
            bg={WALK_COLOR}
            onPress={recordWalk}
          />
        </View>
      </View>
    );
  };

  // ================= RENDER =================
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {/* Top pill */}
      <CountBar />

      {/* Overlay-style edit UI only when edit/replace is active */}
      <HitOutChooser />
      <StrikeoutChooser />
      <HomerunConfirm />

      {showPalette && toast ? (
        <FlashToast
          text={toast.text}
          tint={toast.tint}
          top={isPortrait ? insets.top + 60 : insets.top + 40}
          center
          onDone={() => setToast(null)}
        />
      ) : null}

      <LeftStack />
      <RightStack />
    </View>
  );
}
