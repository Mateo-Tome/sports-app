import { Text, TextProps } from 'react-native';

export function OverlayTitleText(props: TextProps) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      {...props}
    />
  );
}