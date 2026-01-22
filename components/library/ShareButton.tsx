import { Alert, Pressable, Share, Text } from 'react-native';

type Props = {
  shareId: string;
  buildUrl?: (shareId: string) => string;
  label?: string;
};

function getBaseUrl() {
  const base = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '').trim();
  return base ? base.replace(/\/+$/, '') : '';
}

function toAbsoluteUrl(base: string, maybeRelativeOrAbsolute: string) {
  const v = (maybeRelativeOrAbsolute ?? '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const path = v.startsWith('/') ? v : `/${v}`;
  return base ? `${base}${path}` : '';
}

export default function ShareButton({
  shareId,
  buildUrl,
  label = 'Share',
}: Props) {
  const base = getBaseUrl();
  const defaultUrl = base
    ? `${base}/s/${encodeURIComponent(shareId)}`
    : '';

  const candidate = buildUrl?.(shareId);
  const url = candidate ? toAbsoluteUrl(base, candidate) : defaultUrl;

  const onShare = async () => {
    if (!url) {
      Alert.alert(
        'Share not configured',
        'Missing EXPO_PUBLIC_WEB_BASE_URL in .env'
      );
      return;
    }

    await Share.share({ message: url });
  };

  return (
    <Pressable
      onPress={onShare}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: 'white',
      }}
    >
      <Text style={{ color: '#111', fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}
