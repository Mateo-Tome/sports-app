// app/(tabs)/account.tsx
import { formatStorage, getAccountUsage, type AccountUsage } from '@/lib/accountUsage';
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

function maskEmail(email?: string | null) {
  if (!email) return '';
  const [u, d] = email.split('@');
  if (!u || !d) return email;
  return `${u.slice(0, 2)}•••@${d}`;
}

function shortUid(uid?: string | null) {
  return uid ? `${uid.slice(0, 6)}…` : '';
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.045)',
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <View style={{ padding: 18 }}>{children}</View>
    </View>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{
      flex: 1,
      minWidth: 130,
      borderRadius: 16,
      padding: 14,
      backgroundColor: 'rgba(0,0,0,0.28)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    }}>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 11 }}>
        {label}
      </Text>
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 22, marginTop: 6 }}>
        {value}
      </Text>
      {!!sub && (
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '700', fontSize: 12, marginTop: 4 }}>
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
    kind === 'primary' ? '#ef4444' :
    kind === 'danger' ? 'rgba(220,38,38,0.18)' :
    'rgba(255,255,255,0.07)';

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

export default function AccountScreen() {
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<any>({});
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const PRO_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PRO === '1';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setProfile({});
      setUsage(null);
      return;
    }

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : {});
    });

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
      unsubProfile();
    };
  }, [user?.uid]);

  const isTester = profile?.isTester === true;
  const isPro = profile?.isPro === true || isTester;
  const planName = isPro ? 'PRO' : 'FREE';

  const accountState = useMemo(() => {
    if (!user) return {
      badge: 'SIGNED OUT',
      headline: 'Sign in to protect your clips',
      detail: 'Use QuickClip as a guest, or create an account to keep your data safer.',
      line: '',
    };

    if (user.isAnonymous) return {
      badge: 'GUEST',
      headline: 'Guest mode active',
      detail: 'You can record and use all sports. Create an account before switching devices.',
      line: `Guest ID: ${shortUid(user.uid)}`,
    };

    return {
      badge: 'SIGNED IN',
      headline: 'Account active',
      detail: 'Your account is ready for cloud uploads, sync, and sharing.',
      line: maskEmail(user.email) || `User ID: ${shortUid(user.uid)}`,
    };
  }, [user?.uid, user?.email, user?.isAnonymous]);

  const uploadText = usage
    ? `${Math.min(usage.cloudVideoCount, usage.freeMaxCloudVideos)} / ${usage.freeMaxCloudVideos}`
    : '— / 2';

  const storageText = usage
    ? `${formatStorage(usage.cloudStorageUsedBytes)} / ${formatStorage(usage.proStorageLimitBytes)}`
    : '— / 250 GB';

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
    Linking.openURL(
      'mailto:support@quickclipapp.com?subject=Account%20Deletion%20Request'
    );

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
          <View style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: isPro ? 'rgba(245,194,77,0.14)' : 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: isPro ? 'rgba(245,194,77,0.35)' : 'rgba(255,255,255,0.14)',
          }}>
            <Text style={{ color: isPro ? '#f5c24d' : 'rgba(255,255,255,0.85)', fontWeight: '900', fontSize: 12 }}>
              {planName}
            </Text>
          </View>

          <Text style={{ color: 'white', fontSize: 38, fontWeight: '900', marginTop: 14 }}>
            Account
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.60)', fontSize: 15, lineHeight: 22, marginTop: 6 }}>
            Manage your plan, uploads, and account settings.
          </Text>
        </View>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.58)', fontWeight: '900', fontSize: 12 }}>
              {accountState.badge}
            </Text>
            {(busy || usageLoading) && <ActivityIndicator color="#ef4444" />}
          </View>

          <Text style={{ color: 'white', fontWeight: '900', fontSize: 23, marginTop: 12 }}>
            {accountState.headline}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 20, marginTop: 6 }}>
            {accountState.detail}
          </Text>

          {!!accountState.line && (
            <View style={{
              marginTop: 14,
              borderRadius: 14,
              padding: 12,
              backgroundColor: 'rgba(0,0,0,0.30)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontWeight: '800' }}>
                {accountState.line}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {!user || user.isAnonymous ? (
              <>
                <Button label={user?.isAnonymous ? 'Create Account' : 'Sign In'} onPress={goToSignIn} />
                <Button label="Not now" kind="ghost" onPress={() => router.back()} />
              </>
            ) : (
              <>
                <Button label="Sign Out" kind="ghost" onPress={handleSignOut} disabled={busy} />
              </>
            )}
          </View>
        </Card>

        <Card>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>
            {isPro ? 'Pro Plan' : 'Free Plan'}
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.60)', marginTop: 6, lineHeight: 20 }}>
            {isPro
              ? '250 GB cloud storage, share links, sync, and more devices.'
              : 'All sports are unlocked. Free includes 2 active cloud uploads.'}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {isPro ? (
              <>
                <StatBox label="STORAGE" value={storageText} sub="Cloud storage" />
                <StatBox label="DEVICES" value="8" sub="Device limit" />
              </>
            ) : (
              <>
                <StatBox label="UPLOADS" value={uploadText} sub="Active cloud videos" />
                <StatBox label="SPORTS" value="All" sub="Unlocked" />
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
            </TouchableOpacity>
          )}
        </Card>

        <Card>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>
            What you get
          </Text>

          <View style={{ gap: 12, marginTop: 14 }}>
            <Feature text="All sports unlocked on Free and Pro" />
            <Feature text="Unlimited local videos, athletes, and events" />
            <Feature text="Free: 2 active cloud uploads" />
            <Feature text="Pro: 250 GB cloud storage" />
            <Feature text="Pro: share links and cross-device sync" />
            <Feature text="Pro: up to 8 active devices" />
          </View>
        </Card>

        <Card>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>
            Support & Legal
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>
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
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} • Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}