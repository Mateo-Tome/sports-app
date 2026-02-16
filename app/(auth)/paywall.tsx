// app/(auth)/paywall.tsx
import { subscribeAccess, type AccessState } from '@/lib/access';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ RevenueCat kill-switch (OFF unless you explicitly enable it)
// Set EXPO_PUBLIC_ENABLE_REVENUECAT=1 when you’re ready later.
const RC_ENABLED = process.env.EXPO_PUBLIC_ENABLE_REVENUECAT === '1';

// TODO: paste real URLs (must be reachable on the web)
const TERMS_URL = 'https://example.com/terms';
const PRIVACY_URL = 'https://example.com/privacy';

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
      <Text style={{ color: isPro ? '#f5c24d' : '#22c55e', fontWeight: '900', fontSize: 13, lineHeight: 13 }}>
        ✓
      </Text>
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

  // ✅ keep UI stable even when RevenueCat is disabled
  const [pkgLoading, setPkgLoading] = useState(false);
  const [priceText, setPriceText] = useState<string>('$10.99'); // just a placeholder for now
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAccess(setAccess);
    return unsub;
  }, []);

  // ✅ Only fetch offerings/price if RC is enabled
  useEffect(() => {
    if (!RC_ENABLED) {
      setPkgLoading(false);
      setErr(null);
      // keep placeholder priceText
      return;
    }

    let alive = true;
    (async () => {
      setPkgLoading(true);
      setErr(null);
      try {
        // Lazy import so TestFlight build never even touches RC code paths unless enabled
        const { getMonthlyPackage } = await import('@/lib/purchases');
        const p = await getMonthlyPackage();
        if (!alive) return;
        setPriceText(p?.product?.priceString ?? '$10.99');
      } catch (e: any) {
        if (!alive) return;
        // Don’t show scary errors in UI; keep it quiet unless you're actively testing RC.
        setPriceText('$10.99');
        setErr(null);
        console.log('[Paywall] RevenueCat price fetch skipped/failed (non-fatal):', e?.message ?? e);
      } finally {
        if (alive) setPkgLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

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

  if (access.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050507', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ef4444" />
      </SafeAreaView>
    );
  }

  // ✅ Pro state: show a clean “already pro” screen instead of redirecting away
  if (access.isPro) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050507' }} edges={['top', 'left', 'right']}>
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#050507' }} />
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <View
            style={{
              position: 'absolute',
              top: -100,
              left: '10%',
              width: 300,
              height: 300,
              borderRadius: 150,
              backgroundColor: '#ef4444',
              opacity: 0.15,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: -120,
              right: '5%',
              width: 350,
              height: 350,
              borderRadius: 175,
              backgroundColor: '#f5c24d',
              opacity: 0.12,
            }}
          />
        </View>

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
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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
          <View style={{ marginTop: 12 }}>
            <View
              style={{
                backgroundColor: 'rgba(34,197,94,0.12)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                alignSelf: 'flex-start',
                borderWidth: 1,
                borderColor: 'rgba(34,197,94,0.30)',
              }}
            >
              <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '900' }}>PRO ACTIVE</Text>
            </View>

            <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 }}>
              You’re already Pro
            </Text>

            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 10, lineHeight: 24 }}>
              Thanks for supporting QuickClip. All Pro features are unlocked on this account.
            </Text>

            <View
              style={{
                marginTop: 16,
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            >
              <View style={{ paddingVertical: 4 }}>
                {FEATURES.filter((f) => f.pro).map((feature, idx) => (
                  <View
                    key={feature.title}
                    style={{
                      paddingVertical: 16,
                      paddingHorizontal: 18,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: 'rgba(255,255,255,0.06)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, marginBottom: 4 }}>
                        {feature.title}
                      </Text>
                      {!!feature.description && (
                        <Text style={{ color: 'rgba(255,255,255,0.50)', fontWeight: '600', fontSize: 12, lineHeight: 16 }}>
                          {feature.description}
                        </Text>
                      )}
                    </View>
                    <IconCheck />
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.88}
              style={{
                marginTop: 18,
                borderRadius: 18,
                paddingVertical: 18,
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.90)', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
                Close
              </Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onBuy = async () => {
    setErr(null);

    if (!RC_ENABLED) {
      Alert.alert('Coming soon', 'Purchases are temporarily disabled in this test build.');
      return;
    }

    setBuying(true);
    try {
      const { purchaseMonthly } = await import('@/lib/purchases');
      await purchaseMonthly();
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg && !msg.toLowerCase().includes('cancel')) setErr(msg);
    } finally {
      setBuying(false);
    }
  };

  const onRestore = async () => {
    setErr(null);

    if (!RC_ENABLED) {
      Alert.alert('Coming soon', 'Restore purchases is temporarily disabled in this test build.');
      return;
    }

    setRestoring(true);
    try {
      const { restorePurchases } = await import('@/lib/purchases');
      await restorePurchases();
    } catch (e: any) {
      setErr(String(e?.message ?? 'Restore failed.'));
    } finally {
      setRestoring(false);
    }
  };

  const purchasesDisabledNote = !RC_ENABLED
    ? 'Purchases are disabled in this test build. (RevenueCat on hold)'
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050507' }} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#050507' }} />
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <View
          style={{
            position: 'absolute',
            top: -100,
            left: '10%',
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: '#ef4444',
            opacity: 0.15,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -120,
            right: '5%',
            width: 350,
            height: 350,
            borderRadius: 175,
            backgroundColor: '#f5c24d',
            opacity: 0.12,
          }}
        />
      </View>

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
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
        <View style={{ marginTop: 12, marginBottom: 24 }}>
          <View
            style={{
              backgroundColor: 'rgba(239,68,68,0.12)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              alignSelf: 'flex-start',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '900' }}>UPGRADE TO PRO</Text>
          </View>

          <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 }}>
            Unlock Everything
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 10, lineHeight: 24 }}>
            {subtitle}
          </Text>

          {!!lockedLine && (
            <View
              style={{
                marginTop: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: 'rgba(245,194,77,0.10)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(245,194,77,0.25)',
              }}
            >
              <Text style={{ color: 'rgba(245,194,77,0.95)', fontSize: 13, fontWeight: '800' }}>
                ⚠️ {lockedLine}
              </Text>
            </View>
          )}

          {!!purchasesDisabledNote && (
            <View
              style={{
                marginTop: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '700' }}>
                {purchasesDisabledNote}
              </Text>
            </View>
          )}
        </View>

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
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)' }}>
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
                <View
                  style={{
                    marginLeft: 8,
                    backgroundColor: '#f5c24d',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 10 }}>BEST</Text>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Full access
              </Text>
            </View>

            <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>
                Basic
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Limited features
              </Text>
            </View>
          </View>

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
                {priceText}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 18, marginLeft: 4, marginBottom: 8 }}>
                /month
              </Text>
            </View>

            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
                Cancel anytime • No commitments
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.50)', fontWeight: '600', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                Yearly plan coming soon
              </Text>
            </View>

            {pkgLoading && (
              <View style={{ marginTop: 10, alignItems: 'center' }}>
                <ActivityIndicator color="#ef4444" />
              </View>
            )}

            {!!err && (
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                {err}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={onBuy}
          disabled={buying || pkgLoading || !RC_ENABLED}
          activeOpacity={0.88}
          style={{
            borderRadius: 18,
            paddingVertical: 18,
            alignItems: 'center',
            backgroundColor:
              buying || pkgLoading
                ? 'rgba(239,68,68,0.55)'
                : !RC_ENABLED
                  ? 'rgba(239,68,68,0.35)'
                  : '#ef4444',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#ef4444',
            shadowOpacity: buying || pkgLoading || !RC_ENABLED ? 0 : 0.5,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: buying || pkgLoading || !RC_ENABLED ? 0 : 10,
            marginBottom: 14,
            opacity: !RC_ENABLED ? 0.75 : 1,
          }}
        >
          {buying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, letterSpacing: 0.3 }}>
                {RC_ENABLED ? `Start Pro — ${priceText}/month` : 'Start Pro — Coming soon'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, marginTop: 6 }}>
                {RC_ENABLED ? 'Instant unlock • Sync everywhere' : 'Purchases disabled for this test build'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onRestore}
          disabled={restoring || !RC_ENABLED}
          style={{ paddingVertical: 16, alignItems: 'center', opacity: restoring || !RC_ENABLED ? 0.6 : 1 }}
          activeOpacity={0.7}
        >
          {restoring ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 15 }}>
              Restore Purchase
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ marginTop: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            Subscription auto-renews unless canceled at least 24 hours before the end of the current period.
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} activeOpacity={0.7}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' }}>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text style={{ color: 'rgba(255,255,255,0.30)' }}>•</Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
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
