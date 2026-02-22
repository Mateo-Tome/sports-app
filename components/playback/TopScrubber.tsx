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

  // ✅ NEW: fires immediately while dragging (even before RAF seek flush)
  onPreviewTime?: (sec: number) => void;
}) {
  if (Platform.OS === 'web') {
    // ✅ Don't forward onPreviewTime to avoid breaking existing TopScrubberWeb
    const { onPreviewTime, ...webProps } = props;
    return <TopScrubberWeb {...webProps} />;
  }
  return <TopScrubberNative {...props} />;
}