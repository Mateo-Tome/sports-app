import { Text, TextProps } from 'react-native';

export function OverlayCompactText(props: TextProps) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      {...props}
    />
  );
}