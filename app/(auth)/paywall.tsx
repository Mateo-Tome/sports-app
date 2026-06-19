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

const RC_ENABLED = process.env.EXPO_PUBLIC_ENABLE_REVENUECAT === '1';

const TERMS_URL = 'https://quickclipapp.com/terms';
const PRIVACY_URL = 'https://quickclipapp.com/privacy';

const FEATURES: Array<{
  title: string;
  description?: string;
  pro: boolean;
  basic: boolean;
}> = [
  {
    title: 'All sports',
    description: 'Wrestling, Baseball, Softball, Basketball, Swimming, Volleyball, BJJ',
    pro: true,
    basic: true,
  },
  {
    title: 'Cloud uploads',
    description: 'Free: 2 active uploads • Pro: 250 GB cloud storage',
    pro: true,
    basic: true,
  },
  {
    title: 'Share links',
    description: 'Share uploaded clips with family, coaches, and athletes',
    pro: true,
    basic: false,
  },
  {
    title: 'Cross-device sync',
    description: 'Keep clips, athletes, events, and stats synced',
    pro: true,
    basic: false,
  },
  {
    title: 'Devices',
    description: 'Free: 1 active device • Pro: up to 8 devices',
    pro: true,
    basic: true,
  },
  {
    title: 'Events and stats',
    description: 'Organize clips by athlete, sport, and event',
    pro: true,
    basic: true,
  },
];

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
      <Text
        style={{
          color: isPro ? '#f5c24d' : '#22c55e',
          fontWeight: '900',
          fontSize: 13,
          lineHeight: 13,
        }}
      >
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
      <Text
        style={{
          color: 'rgba(255,255,255,0.35)',
          fontWeight: '900',
          fontSize: 13,
          lineHeight: 13,
        }}
      >
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
    isTester: false,
    isPro: false,
    plan: 'free',
    maxCloudVideos: 2,
    maxCloudStorageBytes: null,
    maxDevices: 1,
  });

  const [pkgLoading, setPkgLoading] = useState(false);
  const [priceText, setPriceText] = useState<string>('$10.99');
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAccess(setAccess);
    return unsub;
  }, []);

  useEffect(() => {
    if (!RC_ENABLED) {
      setPkgLoading(false);
      setErr(null);
      return;
    }

    let alive = true;

    (async () => {
      setPkgLoading(true);
      setErr(null);

      try {
        const { getMonthlyPackage } = await import('@/lib/purchases');
        const p = await getMonthlyPackage();
        if (!alive) return;
        setPriceText(p?.product?.priceString ?? '$10.99');
      } catch (e: any) {
        if (!alive) return;
        setPriceText('$10.99');
        setErr(null);
        console.log('[Paywall] RevenueCat price fetch skipped/failed:', e?.message ?? e);
      } finally {
        if (alive) setPkgLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const subtitle = useMemo(() => {
    if (!access.isSignedIn) {
      return 'Sign in to unlock cloud storage, share links, and sync across devices.';
    }
  
    return 'Upgrade for more cloud storage, share links, sync, and more devices.';
  }, [access.isSignedIn]);

  if (access.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050507', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ef4444" />
      </SafeAreaView>
    );
  }

  if (access.isPro) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050507' }} edges={['top', 'left', 'right']}>
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#050507' }} />

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
          <Pressable onPress={() => router.back()} hitSlop={12}>
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

            <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', marginTop: 16 }}>
              You’re already Pro
            </Text>

            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 10, lineHeight: 24 }}>
              Thanks for supporting QuickClip. Pro features are active on this account.
            </Text>

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
              <Text style={{ color: 'rgba(255,255,255,0.90)', fontWeight: '900', fontSize: 16 }}>
                Close
              </Text>
            </TouchableOpacity>
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
    ? 'Purchases are disabled in this test build. RevenueCat is on hold.'
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050507' }} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: '#050507' }} />

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
        <Pressable onPress={() => router.back()} hitSlop={12}>
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

          <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', marginTop: 16 }}>
            More cloud. More sync.
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 10, lineHeight: 24 }}>
            {subtitle}
          </Text>

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
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>
                Pro
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                250 GB cloud
              </Text>
            </View>

            <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>
                Free
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                2 cloud uploads
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

                    {!!feature.description && (
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
                250 GB cloud storage • 8 devices • share links
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.50)', fontWeight: '600', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                Cancel anytime
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
            marginBottom: 14,
            opacity: !RC_ENABLED ? 0.75 : 1,
          }}
        >
          {buying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
                {RC_ENABLED ? `Start Pro — ${priceText}/month` : 'Start Pro — Coming soon'}
              </Text>

              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, marginTop: 6 }}>
                {RC_ENABLED ? 'Cloud storage • Sync • Share links' : 'Purchases disabled for this test build'}
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