// app/athlete/ProfilePhotoCamera.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfilePhotoCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const camRef = useRef<CameraView>(null);

  const [mountCam, setMountCam] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (permission?.granted) {
      setMountCam(true);
      setCameraReady(false);
      setTimeout(() => {
        if (!cameraReady) { setMountCam(false); setTimeout(() => setMountCam(true), 30); }
      }, 1200);
    }
  }, [permission?.granted]); // eslint-disable-line

  if (!permission?.granted) {
    return (
      <View style={{ flex:1, backgroundColor:'black', alignItems:'center', justifyContent:'center' }}>
        <TouchableOpacity onPress={requestPermission} style={{ padding:12, borderRadius:12, borderWidth:1, borderColor:'white' }}>
          <Text style={{ color:'white', fontWeight:'700' }}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const take = async () => {
    if (!cameraReady) return;
    try {
      const res = await (camRef.current as any)?.takePictureAsync?.({ skipProcessing: true, quality: 0.9 });
      const uri = res?.uri as string | undefined;
      if (!uri) { Alert.alert('Failed', 'No image captured'); return; }
      const { granted } = await MediaLibrary.requestPermissionsAsync();
      if (!granted) { Alert.alert('Saved in app only'); }
      const dest = FileSystem.cacheDirectory + `profile_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      // Return the uri to previous screen however you pass data (router params, global store, etc.)
      // For now just go back.
      (nav as any)?.goBack?.();
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? String(e));
    }
  };

  return (
    <View style={{ flex:1, backgroundColor:'black' }}>
      {mountCam ? (
        <CameraView
          ref={camRef}
          style={{ flex:1 }}
          facing="front"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e:any) => {
            const msg = e?.message || e?.nativeEvent?.message || 'Camera mount error';
            console.warn('[profile camera mount error]', e);
            Alert.alert('Camera error', msg);
            setCameraReady(false);
          }}
        />
      ) : <View style={{ flex:1, backgroundColor:'black' }} />}

      <View style={{ position:'absolute', bottom: insets.bottom + 20, left:0, right:0, alignItems:'center' }}>
        <TouchableOpacity disabled={!cameraReady} onPress={take} style={{ opacity: cameraReady ? 1 : 0.5, backgroundColor:'white', paddingVertical:12, paddingHorizontal:24, borderRadius:999 }}>
          <Text style={{ color:'black', fontWeight:'900' }}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
