import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

export default function HighlightButton({
  onPress,
  disabled,
  count = 0,
}: {
  onPress: () => void;
  disabled?: boolean;
  count?: number;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const runPressFX = () => {
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(pressScale, { toValue: 1, duration: 120, useNativeDriver: true }),
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
            width: 44,
            height: 44,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible', // let the counter badge stick out
            opacity: disabled ? 0.7 : 1,
          }}
        >
          <LinearGradient
            colors={disabled ? ['#b9b9b9', '#d6d6d6'] : ['#f7d774', '#d4a017', '#b88912']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', inset: 0, borderRadius: 999 }}
          />

          {/* Just the star (no text, no shimmer) */}
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>⭐</Text>

          {/* Counter badge */}
          {count > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: '#111',
                borderWidth: 2,
                borderColor: '#fff',
                borderRadius: 999,
                minWidth: 20,
                paddingHorizontal: 6,
                paddingVertical: 2,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{count}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
