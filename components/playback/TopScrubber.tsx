import { Platform } from 'react-native';
import TopScrubberNative from './TopScrubberNative';
import TopScrubberWeb from './TopScrubberWeb';

type Insets = { top: number; right: number; bottom: number; left: number };

export default function TopScrubber(props: {
  current: number;
  duration: number;
  onSeek: (sec: number) => void;
  insets: Insets;
  visible: boolean;
  onInteracting?: (active: boolean) => void;
}) {
  if (Platform.OS === 'web') return <TopScrubberWeb {...props} />;
  return <TopScrubberNative {...props} />;
}
