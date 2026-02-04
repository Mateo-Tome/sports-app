// app/(tabs)/account.tsx
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

// ===============================
// 🔧 DEV TOOLS TOGGLE
// Turn ON only while you’re building/testing.
const SHOW_DEV_TOOLS = false;
// ===============================

type PlanKey = 'guest' | 'free' | 'pro' | 'elite';

function maskEmail(email?: string | null) {
  if (!email) return '';
  const [u, d] = email.split('@');
  if (!u || !d) return email;
  return `${u.slice(0, 2)}•••@${d}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function Pill({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '900', marginBottom: 10 }}>
        {title}
      </Text>
      <View
        style={{
          borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  title,
  subtitle,
  right,
  onPress,
  danger,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const content = (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#ff6b6b' : 'white', fontWeight: '900', fontSize: 14 }}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 2, fontSize: 12 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? <Text style={{ color: 'rgba(255,255,255,0.35)', fontWeight: '900' }}>›</Text>}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}

export default function AccountScreen() {
  const [busy, setBusy] = useState(false);

  // ✅ This makes the screen update immediately when auth changes
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // ⚠️ For now these are placeholders.
  // Later: load from Firestore users/{uid} or RevenueCat customerInfo
  const [plan, setPlan] = useState<PlanKey>('guest');

  // storage usage placeholders (wire later)
  const [usageBytes, setUsageBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(1 * 1024 * 1024 * 1024); // 1GB default

  const identity = useMemo(() => {
    if (!user) {
      return {
        headline: 'Not signed in',
        sub: 'Sign in, or continue as a guest.',
        badge: 'SIGNED OUT',
      };
    }
    if (user.isAnonymous) {
      return {
        headline: 'Guest',
        sub: `ID: ${user.uid.slice(0, 6)}…`,
        badge: 'GUEST',
      };
    }
    return {
      headline: 'Signed in',
      sub: maskEmail(user.email) || `ID: ${user.uid.slice(0, 6)}…`,
      badge: 'ACCOUNT',
    };
  }, [user?.uid, user?.email, user?.isAnonymous]);

  useEffect(() => {
    // ✅ Simple default plan logic for now:
    // - no user or anonymous => guest
    // - signed in => free until billing wired
    if (!user) {
      setPlan('guest');
      setLimitBytes(1 * 1024 * 1024 * 1024);
      return;
    }

    if (user.isAnonymous) {
      setPlan('guest');
      setLimitBytes(1 * 1024 * 1024 * 1024);
    } else {
      setPlan('free');
      setLimitBytes(1 * 1024 * 1024 * 1024);
    }
  }, [user?.uid, user?.isAnonymous]);

  const goToSignIn = () => router.push('/sign-in');

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

  const planLabel = useMemo(() => {
    switch (plan) {
      case 'guest':
        return 'Guest';
      case 'free':
        return 'Free';
      case 'pro':
        return 'Pro';
      case 'elite':
        return 'Elite';
      default:
        return 'Free';
    }
  }, [plan]);

  const planSubtitle = useMemo(() => {
    if (plan === 'guest') return 'Try the app. Upgrade anytime to sync across devices.';
    if (plan === 'free') return 'One sport unlocked • Limited devices/storage';
    if (plan === 'pro') return 'All sports • Up to 5 devices';
    if (plan === 'elite') return 'All sports • Up to 10 devices';
    return '';
  }, [plan]);

  const usedPct = useMemo(() => {
    if (!limitBytes) return 0;
    return Math.min(1, Math.max(0, usageBytes / limitBytes));
  }, [usageBytes, limitBytes]);

  const primaryButton = () => {
    if (!user) {
      return (
        <TouchableOpacity
          onPress={goToSignIn}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: '#ef4444',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>Sign in</Text>
        </TouchableOpacity>
      );
    }

    if (user.isAnonymous) {
      return (
        <TouchableOpacity
          onPress={goToSignIn}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: '#ef4444',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>Upgrade guest</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => {
          // Later: open paywall / manage subscription
          Alert.alert('Manage plan', 'Next: wire this to your paywall / RevenueCat.');
        }}
        style={{
          flex: 1,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: '#ef4444',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900' }}>Manage plan</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: 'black' }}
      contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
    >
      {/* Header */}
      <View style={{ marginTop: 6 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: 0.5 }}>
          Account
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4, fontSize: 12 }}>
          Manage your plan, sync, and devices.
        </Text>
      </View>

      {/* Identity card */}
      <View
        style={{
          marginTop: 14,
          borderRadius: 22,
          padding: 16,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pill label={identity.badge} />
          <View style={{ flex: 1 }} />
          {(busy || user === undefined) && <ActivityIndicator color="#fff" />}
        </View>

        <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, marginTop: 10 }}>
          {identity.headline}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 12 }}>
          {identity.sub}
        </Text>

        {/* Primary actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {primaryButton()}

          {!!user && (
            <TouchableOpacity
              onPress={handleSignOut}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '900' }}>
                Sign out
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Plan & limits */}
      <Section title="Plan & limits">
        <Row
          title={`Current plan: ${planLabel}`}
          subtitle={planSubtitle}
          onPress={() => {
            Alert.alert(
              'Plan',
              'Next: wire this to RevenueCat + a Firestore user profile document.'
            );
          }}
        />

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />

        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>Storage</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
            {formatBytes(usageBytes)} used of {formatBytes(limitBytes)}
          </Text>

          <View
            style={{
              marginTop: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <View style={{ height: '100%', width: `${usedPct * 100}%`, backgroundColor: 'white' }} />
          </View>

          {SHOW_DEV_TOOLS && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => setUsageBytes((b) => Math.min(limitBytes, b + 250 * 1024 * 1024))}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>+250MB</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setUsageBytes(0)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>Reset</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Section>

      {/* Devices */}
      <Section title="Devices">
        <Row
          title="Manage devices"
          subtitle="See which devices are signed in and remove old ones."
          onPress={() =>
            Alert.alert(
              'Devices',
              'Next: wire to users/{uid}/devices and enforce limits server-side.'
            )
          }
        />
      </Section>

      {/* Support */}
      <Section title="Help & support">
        <Row
          title="Contact support"
          subtitle="Questions, bugs, feature requests."
          onPress={() => Alert.alert('Support', 'Next: open email composer or support form.')}
        />
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Row
          title="Privacy policy"
          subtitle="Required for App Store."
          onPress={() => Alert.alert('Privacy', 'Next: open your privacy policy URL.')}
        />
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Row
          title="Terms of service"
          subtitle="Required for subscriptions."
          onPress={() => Alert.alert('Terms', 'Next: open your terms URL.')}
        />
      </Section>

      {/* Developer tools (hidden) */}
      {SHOW_DEV_TOOLS && (
        <Section title="Developer tools">
          <Row
            title="Open sign-in screen"
            subtitle="Jump to auth screen."
            onPress={() => router.push('/sign-in')}
          />
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <Row
            title="Print auth state"
            subtitle="Logs uid / isAnonymous / email."
            onPress={() => {
              const cu = auth.currentUser;
              console.log('[Account] auth state', {
                uid: cu?.uid,
                isAnonymous: cu?.isAnonymous,
                email: cu?.email,
                platform: Platform.OS,
              });
              Alert.alert('Logged', 'Auth state logged to console.');
            }}
          />
        </Section>
      )}

      <Text
        style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 11,
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        QuickClip • {Platform.OS.toUpperCase()}
      </Text>
    </ScrollView>
  );
}
