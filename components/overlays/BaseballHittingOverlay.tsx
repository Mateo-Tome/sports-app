import React from 'react';
import { Animated, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OverlayProps } from './types';

// --- Reusable Components (FlashToast, ChooserClose, Separator) ---

/** Tiny visual confirmation toast (no haptics) - Unchanged */
function FlashToast({
  text, tint, top, center = true, onDone,
}: { text: string; tint: string; top: number; center?: boolean; onDone?: () => void }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(6)).current;

  React.useEffect(() => {
    const animIn = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]);
    const animOut = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 150, delay: 750, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -6, duration: 150, delay: 750, useNativeDriver: true }),
    ]);
    animIn.start(() => { animOut.start(({ finished }) => finished && onDone?.()); });
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

const ChooserClose = ({ onClose }: { onClose: () => void }) => (
  <TouchableOpacity
    onPress={onClose}
    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 6 }}
  >
    <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
  </TouchableOpacity>
);

const ChooserSeparator = () => (
  <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 }} />
);

// --- BaseballHittingOverlay Component ---

export default function BaseballHittingOverlay({
  isRecording,
  onEvent,
  getCurrentTSec: _getCurrentTSec,
  sport: _sport,
  style: _style,
  score: _score,
}: OverlayProps) {
  const insets = useSafeAreaInsets();
  const dims = useWindowDimensions();
  const { width: screenW, height: screenH } = dims;

  // Check if screen is wider than tall (Landscape mode check)
  const isLandscape = screenW > screenH;

  // layout paddings (using smaller margins for better edge fit)
  const EDGE_L = insets.left + 8;
  const EDGE_R = insets.right + 8;
  
  // Button grid position (kept at a reasonable offset)
  const TOP = insets.top + 125; 
  const BOTTOM = insets.bottom + 92;

  // sizing 
  const SIZE = 50; 
  const GAP = 8;
  const COLS = 2;
  const COL_W = COLS * SIZE + (COLS - 1) * GAP;
  
  // Pop-up Positioning
  const CHOOSER_TOP = 140;

  // Colors
  const GOLD = '#FFC107';   // Home Run
  const GREEN = '#4CAF50';  // Hits, Walk, HBP (Positive Action)
  const ORANGE = '#FF9800'; // Outs, Strike Out
  const RED = '#f44336';    // Foul, Ball, Steal, Strike (Neutral/Pitch Count actions)
  const COUNT_BG = 'rgba(0,0,0,0.8)'; // Background for the count box

  // =================================================================
  // === STATE MANAGEMENT FOR AT-BAT COUNT ===========================
  // =================================================================
  const [balls, setBalls] = React.useState(0);
  const [strikes, setStrikes] = React.useState(0);
  const [outs, setOuts] = React.useState(0);
  
  const [showContactChooser, setShowContactChooser] = React.useState(false);
  const [showOutChooser, setShowOutChooser] = React.useState(false);
  const [showHomerunConfirm, setShowHomerunConfirm] = React.useState(false);
  const [toast, setToast] = React.useState<null | { text: string; tint: string }>(null);

  const showToast = (text: string, tint: string) => setToast({ text, tint });

  /** Resets the ball/strike count to 0-0 */
  const resetCount = () => {
    setBalls(0);
    setStrikes(0);
  }

  /** Fires the event and resets the count if the action ends the at-bat */
  const fireAndManageCount = (key: string, label: string, bg: string, reset: boolean, value?: number, meta?: Record<string, any>) => {
    if (!isRecording) return;
    fire('neutral', key, label, value ?? 0, meta);
    showToast(label, bg);
    if (reset) {
        resetCount();
    }
  }

  const fire = (actor: 'home' | 'opponent' | 'neutral', key: string, label: string, value?: number, meta?: Record<string, any>) => {
    if (!isRecording) return;
    onEvent({ key, label, actor, value, meta });
  };
  
  // --- Count Display Component (MAX VERTICAL OFFSET) ---

  const AtBatCountDisplay = () => {
    // Dynamic sizing (kept small)
    const fontSize = isLandscape ? 12 : 13; 
    const marginHorizontal = isLandscape ? 10 : 10; 
    const paddingVertical = isLandscape ? 3 : 3; 
    const paddingHorizontal = isLandscape ? 12 : 10; 
    const resetFontSize = isLandscape ? 8 : 9; 
    const resetMarginLeft = isLandscape ? 6 : 8;
    
    // *** MAXIMUM OFFSET APPLIED: Pushing the box 95px above the top=0 line. ***
    const absoluteTopPosition: ViewStyle = {
        top: 0,
        marginTop: -95, // Aggressively push it to the absolute top edge
    };

    return (
      <View 
        pointerEvents="box-none" 
        style={{ 
          position: 'absolute', 
          ...absoluteTopPosition,
          left: 0, 
          right: 0, 
          alignItems: 'center', 
          zIndex: 100,
        }}
      >
        <View 
          style={{
            flexDirection: 'row',
            backgroundColor: COUNT_BG,
            borderRadius: 8,
            paddingHorizontal, 
            paddingVertical, 
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Always use FULL WORDS and apply dynamic sizing */}
          <Text style={{ color: 'white', fontSize, fontWeight: '900' }}>
              Balls: <Text style={{ color: RED }}>{balls}</Text>
          </Text>
          <Text style={{ color: 'white', fontSize, fontWeight: '900', marginHorizontal }}>
              Strikes: <Text style={{ color: RED }}>{strikes}</Text>
          </Text>

          <TouchableOpacity 
            onPress={resetCount}
            style={{ 
              marginLeft: resetMarginLeft, 
              paddingHorizontal: isLandscape ? 8 : 5, 
              paddingVertical: isLandscape ? 2 : 1, 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              borderRadius: 4 
            }}
          >
            <Text style={{ color: 'white', fontSize: resetFontSize }}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- Choosers and Grids (Updated functionality) ---

  const ContactChooser = () => {
    if (!showContactChooser && !showOutChooser) return null;
    
    // Renders the buttons for Single, Double, Triple, Out
    const ResultChips = () => (
      <>
        <Text style={{ color: 'white', fontWeight: '900', marginRight: 8, marginTop: 4 }}>Hit / Out</Text>
        <ChooserClose onClose={() => { setShowContactChooser(false); setShowOutChooser(false); }} />
        <ChooserSeparator />
        
        {/* Hits always end the at-bat and reset the count */}
        <Chip 
          label="Single" 
          bg={GREEN} 
          onPress={() => { 
            fireAndManageCount('hit_single', 'Single (1B)', GREEN, true, 1);
            setShowContactChooser(false);
          }} 
        />
        <Chip 
          label="Double" 
          bg={GREEN} 
          onPress={() => { 
            fireAndManageCount('hit_double', 'Double (2B)', GREEN, true, 2);
            setShowContactChooser(false);
          }} 
        />
        <Chip 
          label="Triple" 
          bg={GREEN} 
          onPress={() => { 
            fireAndManageCount('hit_triple', 'Triple (3B)', GREEN, true, 3);
            setShowContactChooser(false);
          }} 
        />

        {/* *** ADDED: Bunt Option (Treated as a generic base-running action/hit) *** */}
        <Chip 
          label="Bunt" 
          bg={GREEN} // Color it green as it's often a successful advancing action
          onPress={() => { 
            fireAndManageCount('bunt_safe', 'Bunt', GREEN, true, 1); // Fires a 'bunt_safe' event (like a 1B)
            setShowContactChooser(false);
          }} 
        />
        
        {/* Out opens second layer (will reset count once Out type is selected) */}
        <Chip 
          label="Out" 
          bg={ORANGE} 
          onPress={() => { 
            setShowContactChooser(false); // Close first layer
            setShowOutChooser(true);    // Open second layer
          }} 
        />
      </>
    );

    // Renders the buttons for Out type (All reset count and may increment outs)
    const OutChips = () => (
      <>
        <Text style={{ color: 'white', fontWeight: '900', marginRight: 8, marginTop: 4 }}>Type of Out</Text>
        <ChooserClose onClose={() => { setShowContactChooser(false); setShowOutChooser(false); }} />
        <ChooserSeparator />
        
        {/* All Outs reset the count (true) and track 0 bases */}
        <Chip 
          label="Ground Out" 
          bg={ORANGE} 
          onPress={() => { 
            fireAndManageCount('out_ground', 'Ground Out', ORANGE, true);
            setShowOutChooser(false);
            setOuts(o => o + 1); // For local display/logic testing
          }} 
        />
        <Chip 
          label="Fly Out" 
          bg={ORANGE} 
          onPress={() => { 
            fireAndManageCount('out_fly', 'Fly Out', ORANGE, true);
            setShowOutChooser(false);
            setOuts(o => o + 1); // For local display/logic testing
          }} 
        />
        <Chip 
          label="Strike Out" 
          bg={ORANGE} 
          onPress={() => { 
            fireAndManageCount('out_strike', 'Strike Out', ORANGE, true);
            setShowOutChooser(false);
            setOuts(o => o + 1); // For local display/logic testing
          }} 
        />
        <Chip 
          label="Fielder's Choice" 
          bg={ORANGE} 
          onPress={() => { 
            fireAndManageCount('out_fc', 'Fielder\'s Choice', ORANGE, true);
            setShowOutChooser(false);
            setOuts(o => o + 1); // For local display/logic testing
          }} 
        />
      </>
    );

    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: CHOOSER_TOP, left: EDGE_L, right: EDGE_R, alignItems: 'center', zIndex: 50 }}>
        <View style={{ 
          maxWidth: screenW - (EDGE_L + EDGE_R), 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: 'rgba(0,0,0,0.70)', 
          borderWidth: 1, 
          borderColor: 'rgba(255,255,255,0.25)', 
          borderRadius: 16, 
          paddingVertical: 8, 
          paddingHorizontal: 10 
        }}>
          {showContactChooser && ResultChips()}
          {showOutChooser && OutChips()}
        </View>
      </View>
    );
  };

  const Chip = ({ label, bg, onPress }: { label: string; bg: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ 
        height: 40, 
        paddingHorizontal: 16, 
        borderRadius: 999, 
        backgroundColor: bg, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginHorizontal: 4, 
        marginVertical: 4,
        shadowColor: '#000', 
        shadowOpacity: 0.25, 
        shadowOffset: { width: 0, height: 2 }, 
        shadowRadius: 3, 
        elevation: 2 
      }}
    >
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const HomeRunConfirm = () => {
    if (!showHomerunConfirm) return null;
    
    return (
      <View pointerEvents="box-none" style={{ position: 'absolute', top: CHOOSER_TOP, left: EDGE_L, right: EDGE_R, alignItems: 'center', zIndex: 50 }}>
        <View style={{ 
          maxWidth: screenW - (EDGE_L + EDGE_R), 
          backgroundColor: 'rgba(0,0,0,0.75)', 
          borderWidth: 1, 
          borderColor: 'rgba(255,255,255,0.25)', 
          borderRadius: 16, 
          paddingVertical: 12, 
          paddingHorizontal: 14 
        }}>
          <Text style={{ color: 'white', fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>Confirm Home Run?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => setShowHomerunConfirm(false)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
              <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => { 
                fireAndManageCount('hit_homerun', 'Home Run!', GOLD, true, 4); 
                setShowHomerunConfirm(false); 
              }} 
              style={{ 
                paddingHorizontal: 12, 
                paddingVertical: 8, 
                borderRadius: 999, 
                backgroundColor: GOLD,
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900' }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  
  // --- Main Button Grid (Unchanged Logic) ---

  const Circle = ({
    label, keyName, value, bg, onPressOverride, extraStyle = {},
  }: { label: string; keyName: string; value?: number; bg: string; onPressOverride?: () => void; extraStyle?: ViewStyle }) => (
    <TouchableOpacity
      disabled={!isRecording}
      onPress={() => {
        if (!isRecording) return;
        
        // Custom logic for count-managing buttons
        if (keyName === 'ball') {
            const nextBalls = balls + 1;
            setBalls(nextBalls);
            if (nextBalls >= 4) {
                // If 4th ball, it's a walk - reset count, fire walk event
                fireAndManageCount('walk', 'Walk (BB)', GREEN, true, 1);
            } else {
                fireAndManageCount(keyName, label, bg, false); // No count reset
            }
        } else if (keyName === 'strike' || keyName === 'foul') {
            let nextStrikes = strikes;
            
            // Only increment strikes for 'Strike' or if 'Foul' is not strike 3 (assuming league rule)
            if (keyName === 'strike' || (keyName === 'foul' && strikes < 2)) {
                nextStrikes = strikes + 1;
                setStrikes(nextStrikes);
            } else {
                // Fire foul event but don't increment strikes if S=2
                fireAndManageCount(keyName, label, bg, false);
            }
            
            if (nextStrikes >= 3) {
                // If 3rd strike, it's a strikeout - reset count, fire strikeout event
                fireAndManageCount('strikeout_looking', 'Strikeout', ORANGE, true);
                setOuts(o => o + 1); // For local display/logic testing
            } else if (keyName === 'strike') {
                 // Fire strike event if not S=3/Foul on S=2
                 fireAndManageCount(keyName, label, bg, false);
            }

        } else if (keyName === 'walk') {
            fireAndManageCount(keyName, label, bg, true, 1);
        } else if (keyName === 'hit_by_pitch') {
            fireAndManageCount(keyName, label, bg, true, 1);
        } else if (keyName === 'strikeout_look' || keyName === 'strikeout_swing') {
            // Manual Strikeout buttons also reset the count
            fireAndManageCount(keyName, label, bg, true);
            setOuts(o => o + 1); // For local display/logic testing
        } else if (onPressOverride) {
            onPressOverride();
        } else {
            // Default: fire and reset count for events that end the at-bat (e.g., manual steal, but we'll assume others are handled)
            fireAndManageCount(keyName, label, bg, true, value);
        }
      }}
      style={{ 
        width: SIZE, 
        height: SIZE, 
        borderRadius: SIZE / 2, 
        backgroundColor: bg, 
        alignItems: 'center', 
        justifyContent: 'center', 
        opacity: isRecording ? 1 : 0.55, 
        shadowColor: '#000', 
        shadowOpacity: 0.25, 
        shadowOffset: { width: 0, height: 2 }, 
        shadowRadius: 3, 
        elevation: 2,
        ...extraStyle,
      }}
    >
      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const LeftGrid = () => (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: EDGE_L, top: 0, bottom: 0, alignItems: 'flex-start', width: COL_W }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP, marginTop: 8 }}>
        {/* Row 1 */}
        <Circle label="HIT/OUT" keyName="contact" bg={GREEN} onPressOverride={() => setShowContactChooser(true)} extraStyle={{ width: SIZE * 2 + GAP, borderRadius: 999 }} />
        
        {/* Row 2 - Count-Managing Buttons */}
        <Circle label="Foul" keyName="foul" bg={RED} />
        <Circle label="Ball" keyName="ball" bg={RED} />
        
        {/* Row 3 - Walk is now handled by the 'Ball' logic, but this button provides manual override/instant Walk */}
        <Circle label="Steal" keyName="steal_att" bg={RED} value={0} /> 
        <Circle label="Walk" keyName="walk" bg={GREEN} value={1} /> 
        
      </View>
      <View style={{ flex: 1 }} />
    </View>
  );

  const RightGrid = () => (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: EDGE_R, top: 0, bottom: 0, alignItems: 'flex-end', width: COL_W }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COL_W, gap: GAP, justifyContent: 'flex-end', marginTop: 8 }}>
        {/* Home Run Confirmation Button */}
        <Circle 
          label="HR" 
          keyName="homerun_confirm" 
          bg={GOLD} 
          onPressOverride={() => setShowHomerunConfirm(true)} 
          extraStyle={{ width: SIZE * 2 + GAP, borderRadius: 999 }} 
        />
        
        {/* Other actions - Count and At-Bat Enders */}
        <Circle label="Strike" keyName="strike" bg={RED} /> 
        {/* Hit By Pitch is an automatic base and resets count */}
        <Circle label="HBP" keyName="hit_by_pitch" bg={GREEN} value={1} /> 
        {/* Manual Strikeout Buttons - reset count and fire event */}
        <Circle label="K Look" keyName="strikeout_look" bg={ORANGE} />
        <Circle label="K Swing" keyName="strikeout_swing" bg={ORANGE} />
      </View>
      <View style={{ flex: 1 }} />
    </View>
  );


  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: TOP, bottom: BOTTOM }}>
      
      {/* FINAL At-Bat Count Display: Pushed to the absolute top edge */}
      <AtBatCountDisplay />
      
      {/* Pop-up Choosers */}
      <ContactChooser />
      <HomeRunConfirm />

      {/* Toast Notification */}
      {toast ? <FlashToast text={toast.text} tint={toast.tint} top={CHOOSER_TOP + 10} center onDone={() => setToast(null)} /> : null}

      <LeftGrid />
      <RightGrid />
    </View>
  );
}