import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';

export default function HighlightButton({
  onPress,
  disabled,
  count = 0,
}: {
  onPress: () => void;
  disabled?: boolean;
  count?: number;
}) {
  const shine = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const starScale = useRef(new Animated.Value(0)).current;
  const starOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shine]);

  const translateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });

  const runPressFX = () => {
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.95, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pressScale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    starScale.setValue(0.6);
    starOpacity.setValue(0.0);
    Animated.parallel([
      Animated.timing(starScale, { toValue: 1.25, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(starOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(starOpacity, { toValue: 0, delay: 350, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { runPressFX(); onPress(); }}
          disabled={disabled}
          style={{
            paddingVertical: 9,           // 25% smaller
            paddingHorizontal: 18,
            borderRadius: 999,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: '#ffffff',
            minWidth: 120,
            alignItems: 'center',
          }}
        >
          <LinearGradient
            colors={disabled ? ['#b9b9b9', '#d6d6d6'] : ['#f7d774', '#d4a017', '#b88912']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.98 }}
          />

          {!disabled && (
            <Animated.View
              style={{
                position: 'absolute',
                top: -12, bottom: -12, width: 60,
                transform: [{ translateX }, { rotate: '20deg' }],
                opacity: 0.28,
              }}
            >
              <LinearGradient
                colors={['transparent', 'white', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          )}

          <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>✨ Highlight</Text>

          {count > 0 && (
            <View
              style={{
                position: 'absolute', top: -6, right: -6,
                backgroundColor: '#111',
                borderWidth: 2, borderColor: '#fff',
                borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
                minWidth: 20, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{count}</Text>
            </View>
          )}

          <Animated.Text
            style={{
              position: 'absolute', top: -18, right: -8,
              fontSize: 20, color: '#fff',
              transform: [{ scale: starScale }], opacity: starOpacity,
              textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
            }}
          >
            ⭐
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
