// app/(auth)/paywall.tsx
import { subscribeAccess, type AccessState } from '@/lib/access';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaywallScreen() {
  const [access, setAccess] = useState<AccessState>({
    loading: true,
    uid: null,
    isSignedIn: false,
    isAnonymous: false,
    allowedSport: null,
    isTester: false,
    isPro: false,
  });

  useEffect(() => {
    const unsub = subscribeAccess(setAccess);
    return unsub;
  }, []);

  // Already Pro / Tester → no reason to be here
  useEffect(() => {
    if (!access.loading && access.isPro) {
      router.replace('/(tabs)');
    }
  }, [access.loading, access.isPro]);

  if (access.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
      >
        {/* Header */}
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '900', marginBottom: 10 }}>
          Upgrade to Pro
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 24 }}>
          Unlock every sport and record without limits.
        </Text>

        {/* Features */}
        <View
          style={{
            borderRadius: 16,
            padding: 16,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            marginBottom: 24,
          }}
        >
          <Feature text="Unlimited sports (no lock-in)" />
          <Feature text="All recording overlays" />
          <Feature text="Cloud sync & backups" />
          <Feature text="Future sports included" />
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => {
            // 🚧 RevenueCat will go here next
            alert('Purchasing not wired yet');
          }}
          style={{
            backgroundColor: 'white',
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: 'black', fontSize: 18, fontWeight: '900' }}>
            Start Pro
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            // 🚧 RevenueCat restore later
            alert('Restore not wired yet');
          }}
          style={{
            paddingVertical: 12,
            alignItems: 'center',
            marginBottom: 30,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
            Restore purchase
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' }}>
          Subscription auto-renews unless canceled.
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 12,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          Terms • Privacy
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, alignSelf: 'center' }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
            Not now
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: 'white', fontSize: 15, fontWeight: '800' }}>
        • {text}
      </Text>
    </View>
  );
}
