// app/(tabs)/account.tsx
import { formatStorage, getAccountUsage, type AccountUsage } from '@/lib/accountUsage';
import { getDeviceUsage } from '@/lib/devices/deviceRegistry';
import { auth, db } from '@/lib/firebase';
import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_VERSION = '1.0.3';

type DeviceUsageState = {
  activeDeviceCount: number;
  maxDevices: number;
  text: string;
  isOverLimit: boolean;
};

function maskEmail(email?: string | null) {
  if (!email) return '';
  const [u, d] = email.split('@');
  if (!u || !d) return email;
  return `${u.slice(0, 2)}•••@${d}`;
}

function shortUid(uid?: string | null) {
  return uid ? `${uid.slice(0, 6)}…` : '';
}

function Card({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: highlight ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.12)',
        backgroundColor: highlight ? 'rgba(239,68,68,0.075)' : 'rgba(255,255,255,0.045)',
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      <View style={{ padding: 18 }}>{children}</View>
    </View>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: 'white', fontSize: 21, fontWeight: '900' }}>{title}</Text>
      {!!sub && (
        <Text style={{ color: 'rgba(255,255,255,0.58)', marginTop: 5, lineHeight: 20 }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 130,
        borderRadius: 16,
        padding: 14,
        backgroundColor: 'rgba(0,0,0,0.28)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 11 }}>
        {label}
      </Text>
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 22, marginTop: 6 }}>
        {value}
      </Text>
      {!!sub && (
        <Text
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontWeight: '700',
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {sub}
        </Text>
      )}
    </View>
  );
}

function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const bg =
    kind === 'primary'
      ? '#ef4444'
      : kind === 'danger'
        ? 'rgba(220,38,38,0.18)'
        : 'rgba(255,255,255,0.07)';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}
      style={{
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: kind === 'primary' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.12)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: '#22c55e', fontWeight: '900' }}>✓</Text>
      <Text style={{ color: 'rgba(255,255,255,0.82)', fontWeight: '700', flex: 1 }}>{text}</Text>
    </View>
  );
}

function CompareRow({
  label,
  free,
  pro,
  dimFree,
}: {
  label: string;
  free: string;
  pro: string;
  dimFree?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
        alignItems: 'center',
      }}
    >
      <Text style={{ flex: 1.15, color: 'rgba(255,255,255,0.78)', fontWeight: '800', fontSize: 13 }}>
        {label}
      </Text>

      <Text
        style={{
          flex: 1,
          color: dimFree ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.86)',
          fontWeight: '800',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        {free}
      </Text>

      <Text
        style={{
          flex: 1,
          color: '#f5c24d',
          fontWeight: '900',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        {pro}
      </Text>
    </View>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<any>({});
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [deviceUsage, setDeviceUsage] = useState<DeviceUsageState | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  const PRO_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PRO === '1';

  const isTester = profile?.isTester === true;
  const isPro = profile?.isPro === true || isTester;
  const planName = isPro ? 'PRO' : 'FREE';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setProfile({});
      setUsage(null);
      setDeviceUsage(null);
      return;
    }

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : {});
    });

    return () => {
      unsubProfile();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUsage(null);
      return;
    }

    let alive = true;

    (async () => {
      setUsageLoading(true);
      try {
        const next = await getAccountUsage(user.uid);
        if (alive) setUsage(next);
      } catch (e) {
        console.log('[Account] usage load failed:', e);
        if (alive) setUsage(null);
      } finally {
        if (alive) setUsageLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setDeviceUsage(null);
      return;
    }

    let alive = true;

    (async () => {
      setDeviceLoading(true);
      try {
        const maxDevices = isPro ? 8 : 1;
        const next = await getDeviceUsage(user.uid, maxDevices);
        if (alive) setDeviceUsage(next);
      } catch (e) {
        console.log('[Account] device usage load failed:', e);
        if (alive) {
          setDeviceUsage({
            activeDeviceCount: 1,
            maxDevices: isPro ? 8 : 1,
            text: isPro ? '1 / 8' : '1 / 1',
            isOverLimit: false,
          });
        }
      } finally {
        if (alive) setDeviceLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid, isPro]);

  const accountState = useMemo(() => {
    if (!user) {
      return {
        badge: 'SIGNED OUT',
        headline: 'Sign in to protect your clips',
        detail: 'Create or sign in to an account to use cloud uploads, sync, sharing, and device access.',
        line: '',
      };
    }

    return {
      badge: 'SIGNED IN',
      headline: 'Account active',
      detail: 'Your account is ready for cloud uploads, sync, and sharing.',
      line: maskEmail(user.email) || `User ID: ${shortUid(user.uid)}`,
    };
  }, [user?.uid, user?.email]);

  const uploadText = usage
    ? `${Math.min(usage.cloudVideoCount, usage.freeMaxCloudVideos)} / ${usage.freeMaxCloudVideos}`
    : '— / 2';

  const storageText = usage
    ? `${formatStorage(usage.cloudStorageUsedBytes)} / ${formatStorage(usage.proStorageLimitBytes)}`
    : '— / 250 GB';

  const deviceText = deviceUsage?.text ?? (isPro ? '— / 8' : '— / 1');

  const goToSignIn = () => router.push('/(auth)/sign-in');
  const goToPaywall = () => router.push('/(auth)/paywall');

  const handleSignOut = async () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut(auth);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openPrivacy = () => Linking.openURL('https://quickclipapp.com/privacy');
  const openTerms = () => Linking.openURL('https://quickclipapp.com/terms');
  const requestDeletion = () =>
    Linking.openURL('mailto:support@quickclipapp.com?subject=Account%20Deletion%20Request');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: Math.max(16, insets.top + 10),
          paddingBottom: Math.max(30, insets.bottom + 22),
        }}
      >
        <View style={{ marginBottom: 18 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: isPro ? 'rgba(245,194,77,0.14)' : 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: isPro ? 'rgba(245,194,77,0.35)' : 'rgba(255,255,255,0.14)',
            }}
          >
            <Text
              style={{
                color: isPro ? '#f5c24d' : 'rgba(255,255,255,0.85)',
                fontWeight: '900',
                fontSize: 12,
              }}
            >
              {isTester ? 'TESTER • PRO' : planName}
            </Text>
          </View>

          <Text style={{ color: 'white', fontSize: 38, fontWeight: '900', marginTop: 14 }}>
            Account
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.60)', fontSize: 15, lineHeight: 22, marginTop: 6 }}>
            Manage your plan, uploads, devices, and account settings.
          </Text>
        </View>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.58)', fontWeight: '900', fontSize: 12 }}>
              {accountState.badge}
            </Text>
            {(busy || usageLoading || deviceLoading) && <ActivityIndicator color="#ef4444" />}
          </View>

          <Text style={{ color: 'white', fontWeight: '900', fontSize: 23, marginTop: 12 }}>
            {accountState.headline}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 20, marginTop: 6 }}>
            {accountState.detail}
          </Text>

          {!!accountState.line && (
            <View
              style={{
                marginTop: 14,
                borderRadius: 14,
                padding: 12,
                backgroundColor: 'rgba(0,0,0,0.30)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontWeight: '800' }}>
                {accountState.line}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {!user ? (
              <Button label="Sign In" onPress={goToSignIn} />
            ) : (
              <Button label="Sign Out" kind="ghost" onPress={handleSignOut} disabled={busy} />
            )}
          </View>
        </Card>

        {deviceUsage?.isOverLimit ? (
          <Card highlight>
            <SectionTitle
              title="Device limit reached"
              sub={
                isPro
                  ? 'This account is over the 8 active device limit. Recording still works offline, but cloud features may need device management soon.'
                  : 'Free allows 1 active device. Recording still works offline, but Pro allows up to 8 active devices.'
              }
            />
          </Card>
        ) : null}

        <Card highlight={!isPro}>
          <SectionTitle
            title={isPro ? 'Pro Plan' : 'Free Plan'}
            sub={
              isPro
                ? 'You have the full QuickClip cloud plan.'
                : 'Free is built for local recording. Upgrade when you need sync, sharing, and more cloud storage.'
            }
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {isPro ? (
              <>
                <StatBox label="STORAGE" value={storageText} sub="Cloud storage" />
                <StatBox label="DEVICES" value={deviceText} sub="Active devices" />
              </>
            ) : (
              <>
                <StatBox label="UPLOADS" value={uploadText} sub="Active cloud videos" />
                <StatBox label="DEVICES" value={deviceText} sub="Active devices" />
                <StatBox label="SPORTS" value="All" sub="Unlocked" />
                <StatBox label="LOCAL" value="Unlimited" sub="Videos, athletes, events" />
              </>
            )}
          </View>

          {!isPro && (
            <TouchableOpacity
              onPress={PRO_ENABLED ? goToPaywall : undefined}
              disabled={!PRO_ENABLED}
              activeOpacity={0.88}
              style={{
                marginTop: 16,
                borderRadius: 18,
                paddingVertical: 16,
                alignItems: 'center',
                backgroundColor: PRO_ENABLED ? '#ef4444' : 'rgba(239,68,68,0.35)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>
                {PRO_ENABLED ? 'Upgrade to Pro' : 'Pro coming soon'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 12, marginTop: 4 }}>
                250 GB cloud • Share links • 8 devices
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Free vs Pro"
            sub="Simple difference: Free is local-first. Pro unlocks cloud, sharing, sync, and more devices."
          />

          <View
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              backgroundColor: 'rgba(0,0,0,0.22)',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: 13,
                paddingHorizontal: 12,
                backgroundColor: 'rgba(255,255,255,0.045)',
              }}
            >
              <Text style={{ flex: 1.15, color: 'rgba(255,255,255,0.45)', fontWeight: '900', fontSize: 12 }}>
                FEATURE
              </Text>
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.80)', fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
                FREE
              </Text>
              <Text style={{ flex: 1, color: '#f5c24d', fontWeight: '900', fontSize: 12, textAlign: 'center' }}>
                PRO
              </Text>
            </View>

            <View style={{ paddingHorizontal: 12 }}>
              <CompareRow label="Sports" free="All" pro="All" />
              <CompareRow label="Local videos" free="Unlimited" pro="Unlimited" />
              <CompareRow label="Athletes & events" free="Unlimited" pro="Unlimited" />
              <CompareRow label="Cloud uploads" free="2 active" pro="250 GB" />
              <CompareRow label="Share links" free="—" pro="Included" dimFree />
              <CompareRow label="Cross-device sync" free="—" pro="Included" dimFree />
              <CompareRow label="Devices" free="1 active" pro="Up to 8" />
              <CompareRow label="Support" free="Standard" pro="Priority" />
            </View>
          </View>
        </Card>

        <Card>
          <SectionTitle title="What you get today" />

          <View style={{ gap: 12 }}>
            <Feature text="All sports unlocked on Free and Pro" />
            <Feature text="Unlimited local videos, athletes, and events" />
            <Feature text="Free includes 2 active cloud uploads" />
            <Feature text="Pro adds 250 GB cloud storage" />
            <Feature text="Pro adds share links and cross-device sync" />
            <Feature text="Pro allows up to 8 active devices" />
          </View>
        </Card>

        <Card>
          <SectionTitle title="Support & Legal" />

          <View style={{ gap: 10 }}>
            <Button label="Privacy Policy" kind="ghost" onPress={openPrivacy} />
            <Button label="Terms of Service" kind="ghost" onPress={openTerms} />
            <Button label="Request account deletion" kind="danger" onPress={requestDeletion} />
          </View>
        </Card>

        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontWeight: '700', fontSize: 12 }}>
            QuickClip
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '600', fontSize: 11, marginTop: 4 }}>
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} • Version {APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}