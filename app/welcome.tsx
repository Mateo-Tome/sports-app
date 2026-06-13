// app/welcome.tsx
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export default function Welcome() {
  const goToSignIn = () => {
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: 'white', fontSize: 34, fontWeight: '900', marginBottom: 12 }}>
        QuickClip
      </Text>

      <Text style={{ color: 'white', opacity: 0.7, marginBottom: 24, lineHeight: 21 }}>
        Record, organize, analyze, and share sports film.
      </Text>

      <TouchableOpacity
        onPress={goToSignIn}
        style={{ backgroundColor: '#ef4444', padding: 15, borderRadius: 14 }}
      >
        <Text style={{ color: 'white', fontWeight: '900', textAlign: 'center' }}>
          Sign in or create account
        </Text>
      </TouchableOpacity>
    </View>
  );
}