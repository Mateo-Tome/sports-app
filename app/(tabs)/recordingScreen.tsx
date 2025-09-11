// app/(tabs)/recordingScreen.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SPORTS = ['Wrestling', 'Basketball', 'Baseball', 'Volleyball', 'BJJ'] as const;

export default function RecordingScreen() {
  const router = useRouter();

  // Cast pathname to quiet TS until route types regenerate
  const toCam = (sportKey: string, styleKey: string) =>
    router.push({ pathname: '/record/camera' as any, params: { sport: sportKey, style: styleKey } });

  const go = (sport: (typeof SPORTS)[number]) => {
    if (sport === 'Wrestling') {
      router.push('/screens/wrestlingselection');
      return;
    }
    switch (sport) {
      case 'Basketball':
        toCam('basketball', 'default');
        break;
      case 'Baseball':
        toCam('baseball', 'default');
        break;
      case 'Volleyball':
        toCam('volleyball', 'default');
        break;
      case 'BJJ':
        toCam('bjj', 'gi'); // later you can add gi/nogi picker
        break;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', marginBottom: 12 }}>
          Record
        </Text>

        {/* Plain camera (no overlay) */}
        <TouchableOpacity
          onPress={() => toCam('plain', 'none')}
          style={{
            width: '100%',
            paddingVertical: 18,             // big but not huge
            marginBottom: 18,
            borderWidth: 2,
            borderColor: '#fff',
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
          }}
        >
          <Text style={{ fontSize: 18, color: 'black', fontWeight: '900' }}>Plain Camera</Text>
          <Text style={{ fontSize: 12, color: 'black', opacity: 0.6, marginTop: 2 }}>No overlay</Text>
        </TouchableOpacity>

        <Text style={{ color: 'white', opacity: 0.8, marginBottom: 10, fontWeight: '800' }}>
          Or choose a sport
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {SPORTS.map((sport) => (
            <TouchableOpacity
              key={sport}
              onPress={() => go(sport)}
              style={{
                width: '49%',                 // a touch wider
                paddingVertical: 34,          // slightly taller than before
                marginBottom: 16,
                borderWidth: 2,
                borderColor: '#fff',
                borderRadius: 12,             // a bit rounder
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
              }}
            >
              <Text style={{ fontSize: 22, color: 'black', fontWeight: '800' }}>{sport}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}







