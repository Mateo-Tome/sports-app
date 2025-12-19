// components/playback/PlaybackOverlays.tsx
import { Pressable, Text, View } from 'react-native';

export function SkipHudOverlay(props: {
  visible: boolean;
  side: 'left' | 'right';
  total: number;
  insets: { left: number; right: number };
  safeMargin: number;
  maxWidth: number;
}) {
  const { visible, side, total, insets, safeMargin, maxWidth } = props;
  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '45%',
        left: side === 'left' ? insets.left + safeMargin : undefined,
        right: side === 'right' ? insets.right + safeMargin : undefined,
        maxWidth,
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        zIndex: 60,
      }}
    >
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
        {side === 'left' ? `⟲  -${total}s` : `+${total}s  ⟳`}
      </Text>
    </View>
  );
}

export function ReplayOverlay(props: {
  visible: boolean;
  onReplay: () => void;
}) {
  const { visible, onReplay } = props;
  if (!visible) return null;

  return (
    <Pressable
      onPress={onReplay}
      style={{
        position: 'absolute',
        top: '45%',
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        zIndex: 40,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900' }}>Replay ⟲</Text>
    </Pressable>
  );
}

export function LoadingErrorOverlay(props: {
  visible: boolean;
  loading: boolean;
  errorMsg: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { visible, loading, errorMsg, onBack, onRetry } = props;
  if (!visible) return null;

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 90,
      }}
    >
      <View
        style={{
          width: '92%',
          maxWidth: 420,
          borderRadius: 14,
          backgroundColor: 'rgba(0,0,0,0.78)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
          padding: 14,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'center' }}>
          {loading ? 'Loading…' : 'Could not load video'}
        </Text>

        {!!errorMsg && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              marginTop: 8,
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            {errorMsg}
          </Text>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={onBack}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.22)',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>Back</Text>
          </Pressable>

          <Pressable
            onPress={onRetry}
            disabled={loading}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: loading ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.95)',
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.35)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>
              {loading ? 'Loading…' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function EditModeMask(props: {
  visible: boolean;
  bottomInset: number;
  onExit: () => void;
}) {
  const { visible, bottomInset, onExit } = props;
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 100 }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.15)',
        }}
      />
      <Pressable
        onPress={onExit}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: bottomInset + 24,
          alignItems: 'center',
        }}
      >
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f59e0b' }}>
          <Text style={{ color: '#111', fontWeight: '900' }}>Tap to exit Edit/Add</Text>
        </View>
      </Pressable>
    </View>
  );
}

export function DebugOverlay(props: { msg?: string }) {
  if (!props.msg) return null;
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{props.msg}</Text>
    </View>
  );
}
