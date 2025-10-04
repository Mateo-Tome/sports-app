// components/HapticTab.tsx
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, Vibration } from 'react-native';

// Generic pressable for anywhere in the app (overlay buttons, etc.)
type HPProps = React.ComponentProps<typeof Pressable> & {
  impact?: Haptics.ImpactFeedbackStyle;
};

export function HapticPressable({
  onPressIn,
  style,
  impact = Haptics.ImpactFeedbackStyle.Light,
  ...rest
}: HPProps) {
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(impact);
        } else if (Platform.OS === 'android') {
          // Tiny buzz so Android has feedback too (optional)
          Vibration.vibrate(12);
        }
        onPressIn?.(e);
      }}
      // Important: return a *new* style object so nothing tries to mutate a frozen one
      style={(state) => {
        const base =
          typeof style === 'function'
            ? style(state)
            : style;
        return [base as any, state.pressed ? { opacity: 0.8 } : null];
      }}
    />
  );
}

// Keep tab bar behavior the same (this is what already works for you)
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (Platform.OS === 'android') {
          Vibration.vibrate(12);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

export default HapticTab;


