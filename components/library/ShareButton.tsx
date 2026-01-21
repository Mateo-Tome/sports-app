import { Alert, Pressable, Share, Text, View } from 'react-native';

type Props = {
  shareId: string;
  buildUrl?: (shareId: string) => string;
};

export default function ShareButton({ shareId, buildUrl }: Props) {
  const base = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '').trim();

  const url =
    buildUrl?.(shareId) ??
    (base
      ? `${base.replace(/\/+$/, '')}/s/${encodeURIComponent(shareId)}`
      : '');

  const onShare = async () => {
    if (!url) {
      Alert.alert(
        'Share not configured',
        'Missing EXPO_PUBLIC_WEB_BASE_URL in .env'
      );
      return;
    }

    try {
      // IMPORTANT: Only share `message`.
      // Providing both `message` and `url` can cause some targets (especially web)
      // to treat the link as relative and break it (e.g. /quickclip-web.pages.dev/s/...).
      await Share.share({ message: url });
    } catch (e: any) {
      Alert.alert('Share failed', String(e?.message ?? e ?? 'Unknown error'));
    }
  };

  const onCopyFallback = () => {
    Alert.alert('Copy this link', url || '(missing EXPO_PUBLIC_WEB_BASE_URL)');
  };

  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Pressable
        onPress={onShare}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: 'white',
        }}
      >
        <Text style={{ color: '#111', fontWeight: '900' }}>Share</Text>
      </Pressable>

      <Pressable
        onPress={onCopyFallback}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: 'white',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>Copy Link</Text>
      </Pressable>
    </View>
  );
}
