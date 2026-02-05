// app/(auth)/paywall.tsx
import { subscribeAccess, type AccessState } from '@/lib/access';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const FEATURES: Array<{
  title: string;
  description?: string;
  pro: boolean;
  basic: boolean;
}> = [
  { title: 'All sports unlocked', description: 'Wrestling, Baseball, Basketball, Volleyball, BJJ', pro: true, basic: false },
  { title: 'Cloud storage', description: 'Store more clips and highlights', pro: true, basic: false },
  { title: 'Multi-device sync', description: 'Up to 5 devices', pro: true, basic: false },
  { title: 'Priority uploads', description: 'Faster processing', pro: true, basic: false },
  { title: 'Advanced stats', description: 'Full analytics dashboard', pro: true, basic: false },
  { title: 'Basic editing tools', pro: true, basic: true },
];

function niceSport(k: string | null) {
  switch (k) {
    case 'wrestling':
      return 'Wrestling';
    case 'baseball':
      return 'Baseball';
    case 'basketball':
      return 'Basketball';
    case 'volleyball':
      return 'Volleyball';
    case 'bjj':
      return 'BJJ';
    default:
      return null;
  }
}

function IconCheck({ isPro = false }: { isPro?: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: isPro ? 'rgba(245,194,77,0.18)' : 'rgba(34,197,94,0.16)',
        borderWidth: 1.5,
        borderColor: isPro ? 'rgba(245,194,77,0.6)' : 'rgba(34,197,94,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: isPro ? '#f5c24d' : '#22c55e', fontWeight: '900', fontSize: 13, lineHeight: 13 }}>✓</Text>
    </View>
  );
}

function IconX() {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontWeight: '900', fontSize: 13, lineHeight: 13 }}>
        ✕
      </Text>
    </View>
  );
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();

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

  useEffect(() => {
    if (!access.loading && access.isPro) {
      router.replace('/(tabs)');
    }
  }, [access.loading, access.isPro]);

  const subtitle = useMemo(() => {
    if (!access.isSignedIn) return 'Sign in to unlock all features and sync across devices';
    if (access.isAnonymous) return 'Your guest session will be preserved after upgrading';
    return 'Unlock everything and sync across all your devices';
  }, [access.isSignedIn, access.isAnonymous]);

  const lockedLine = useMemo(() => {
    if (!access.allowedSport || access.isPro) return null;
    const s = niceSport(access.allowedSport) ?? 'your selected sport';
    return `Currently limited to: ${s}`;
  }, [access.allowedSport, access.isPro]);

  const price = '$10.99';
  const priceSub = '/month';

  if (access.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050507', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ef4444" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050507' }} edges={['top', 'left', 'right']}>
      {/* Enhanced gradient background */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#050507' }} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.4,
        }}
      >
        <View style={{ 
          position: 'absolute', 
          top: -100, 
          left: '10%', 
          width: 300, 
          height: 300, 
          borderRadius: 150,
          backgroundColor: '#ef4444',
          opacity: 0.15,
        }} />
        <View style={{ 
          position: 'absolute', 
          bottom: -120, 
          right: '5%', 
          width: 350, 
          height: 350, 
          borderRadius: 175,
          backgroundColor: '#f5c24d',
          opacity: 0.12,
        }} />
      </View>

      {/* Top bar */}
      <View
        style={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.90)', fontWeight: '700', fontSize: 18 }}>✕</Text>
          </View>
        </Pressable>

        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(28, insets.bottom + 20),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={{ marginTop: 12, marginBottom: 24 }}>
          <View style={{
            backgroundColor: 'rgba(239,68,68,0.12)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.3)',
          }}>
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '900' }}>
              UPGRADE TO PRO
            </Text>
          </View>

          <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 }}>
            Unlock Everything
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 10, lineHeight: 24 }}>
            {subtitle}
          </Text>

          {!!lockedLine && (
            <View style={{
              marginTop: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: 'rgba(245,194,77,0.10)',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(245,194,77,0.25)',
            }}>
              <Text style={{ color: 'rgba(245,194,77,0.95)', fontSize: 13, fontWeight: '800' }}>
                ⚠️ {lockedLine}
              </Text>
            </View>
          )}
        </View>

        {/* Plan Comparison Card */}
        <View
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            marginBottom: 20,
          }}
        >
          {/* Plan Headers */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            {/* Pro Column Header */}
            <View
              style={{
                flex: 1,
                paddingVertical: 18,
                paddingHorizontal: 16,
                backgroundColor: 'rgba(239,68,68,0.18)',
                borderRightWidth: 1,
                borderRightColor: 'rgba(255,255,255,0.10)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>Pro</Text>
                <View style={{
                  marginLeft: 8,
                  backgroundColor: '#f5c24d',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 10 }}>BEST</Text>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Full access
              </Text>
            </View>

            {/* Basic Column Header */}
            <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>
                Basic
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Limited features
              </Text>
            </View>
          </View>

          {/* Feature Rows */}
          <View style={{ paddingVertical: 4 }}>
            {FEATURES.map((feature, idx) => (
              <View
                key={feature.title}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, marginBottom: 4 }}>
                      {feature.title}
                    </Text>
                    {feature.description && (
                      <Text style={{ color: 'rgba(255,255,255,0.50)', fontWeight: '600', fontSize: 12, lineHeight: 16 }}>
                        {feature.description}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 32, alignItems: 'center' }}>
                    {feature.pro ? <IconCheck isPro /> : <IconX />}
                    {feature.basic ? <IconCheck /> : <IconX />}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Card */}
        <View
          style={{
            borderRadius: 20,
            borderWidth: 2,
            borderColor: 'rgba(239,68,68,0.4)',
            backgroundColor: 'rgba(239,68,68,0.08)',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 48, lineHeight: 48 }}>
                {price}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 18, marginLeft: 4, marginBottom: 8 }}>
                {priceSub}
              </Text>
            </View>

            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
                Cancel anytime • No commitments
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.50)', fontWeight: '600', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                Yearly plan coming soon with savings
              </Text>
            </View>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={() => {
            alert('Purchasing not wired yet (monthly)');
          }}
          activeOpacity={0.88}
          style={{
            borderRadius: 18,
            paddingVertical: 18,
            alignItems: 'center',
            backgroundColor: '#ef4444',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#ef4444',
            shadowOpacity: 0.5,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
            marginBottom: 14,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, letterSpacing: 0.3 }}>
            Start Pro Now
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, marginTop: 6 }}>
            Instant unlock • Sync everywhere
          </Text>
        </TouchableOpacity>

        {/* Restore Purchase */}
        <TouchableOpacity
          onPress={() => {
            alert('Restore not wired yet');
          }}
          style={{ paddingVertical: 16, alignItems: 'center' }}
          activeOpacity={0.7}
        >
          <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 15 }}>
            Restore Purchase
          </Text>
        </TouchableOpacity>

        {/* Legal Text */}
        <View style={{ marginTop: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            Subscription auto-renews unless canceled at least 24 hours before the end of the current period.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            <TouchableOpacity>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' }}>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text style={{ color: 'rgba(255,255,255,0.30)' }}>•</Text>
            <TouchableOpacity>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' }}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}