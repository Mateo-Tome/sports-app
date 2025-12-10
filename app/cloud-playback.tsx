// app/cloud-playback.tsx
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Linking,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CloudPlaybackScreen() {
  const { uri, shareId } = useLocalSearchParams<{
    uri?: string;
    shareId?: string;
  }>();

  const videoRef = useRef<Video | null>(null);

  const [loadState, setLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!uri) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: 'black',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', marginBottom: 16 }}>
          No cloud video URL provided.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: 'white',
          }}
        >
          <Text style={{ color: '#111', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: 'white',
              fontWeight: '800',
              fontSize: 14,
            }}
            numberOfLines={1}
          >
            Cloud playback
          </Text>
          {!!shareId && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 11,
              }}
              numberOfLines={1}
            >
              shareId: {shareId}
            </Text>
          )}
        </View>
      </View>

      {/* Debug info about URL + load state + open in browser */}
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <Text
          style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}
          numberOfLines={2}
        >
          uri: {uri}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 11,
            marginTop: 2,
          }}
        >
          loadState: {loadState}
        </Text>
        {!!errorMsg && (
          <Text style={{ color: 'tomato', fontSize: 11, marginTop: 2 }}>
            error: {errorMsg}
          </Text>
        )}

        <TouchableOpacity
          onPress={() => Linking.openURL(String(uri))}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
            Open in browser
          </Text>
        </TouchableOpacity>
      </View>

      {/* Video */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: 'black',
          }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          onLoadStart={() => {
            console.log('[CloudPlayback] onLoadStart');
            setLoadState('loading');
            setErrorMsg(null);
          }}
          onLoad={(data) => {
            console.log('[CloudPlayback] onLoad success', data);
            setLoadState('loaded');
          }}
          onError={(err) => {
            console.log('[CloudPlayback] onError', err);
            setLoadState('error');
            const msg =
              (err as any)?.error?.message ?? JSON.stringify(err);
            setErrorMsg(msg);
          }}
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            if ((status as any).didJustFinish) {
              console.log('[CloudPlayback] playback finished');
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}
