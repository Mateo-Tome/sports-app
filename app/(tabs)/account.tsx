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
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../lib/firebase';

function maskEmail(email?: string | null) {
  if (!email) return '';
  const [u, d] = email.split('@');
  if (!u || !d) return email;
  return `${u.slice(0, 2)}•••@${d}`;
}

function shortUid(uid?: string | null) {
  if (!uid) return '';
  return `${uid.slice(0, 6)}…`;
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  onPress,
  danger,
}: {
  title: string;
  subtitle?: string;
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
      {!!onPress && <Text style={{ color: 'rgba(255,255,255,0.35)', fontWeight: '900' }}>›</Text>}
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

  // updates immediately when auth changes
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const goToSignIn = () => router.push('/(auth)/sign-in');
  const goToPaywall = () => router.push('/paywall');

  const identity = useMemo(() => {
    if (!user) {
      return {
        badge: 'SIGNED OUT',
        headline: 'Signed out',
        // bring back the “specific identifier line” style
        detail: '',
        sub: 'Sign in to sync across devices.',
      };
    }
    if (user.isAnonymous) {
      return {
        badge: 'GUEST',
        headline: 'Guest mode',
        detail: `ID: ${shortUid(user.uid)}`,
        sub: 'Clips stay on this device unless you create an account.',
      };
    }
    return {
      badge: 'ACCOUNT',
      headline: 'Signed in',
      detail: maskEmail(user.email) || `ID: ${shortUid(user.uid)}`,
      sub: 'Your account is connected and can sync.',
    };
  }, [user?.uid, user?.email, user?.isAnonymous]);

  const primaryCta = useMemo(() => {
    if (!user) return { label: 'Sign in', onPress: goToSignIn };
    if (user.isAnonymous) return { label: 'Create account', onPress: goToSignIn };
    return { label: 'Upgrade', onPress: goToPaywall };
  }, [user]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right']}>
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
            Sign in, create an account, or upgrade.
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
            {busy && <ActivityIndicator color="#fff" />}
          </View>

          <Text style={{ color: 'white', fontWeight: '900', fontSize: 18, marginTop: 10 }}>
            {identity.headline}
          </Text>

          {!!identity.detail && (
            <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 4, fontSize: 12, fontWeight: '800' }}>
              {identity.detail}
            </Text>
          )}

          <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 12 }}>
            {identity.sub}
          </Text>

          {/* Primary actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              onPress={primaryCta.onPress}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: '#ef4444',
                alignItems: 'center',
                opacity: busy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>{primaryCta.label}</Text>
            </TouchableOpacity>

            {!!user && (
              <TouchableOpacity
                onPress={handleSignOut}
                disabled={busy}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '900' }}>Sign out</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Guest clarity */}
          {!!user?.isAnonymous && (
            <View
              style={{
                marginTop: 12,
                borderRadius: 14,
                padding: 12,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>Tip</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 }}>
                Create an account to keep the same ID and sync clips across devices.
              </Text>
            </View>
          )}
        </View>

        {/* Launch essentials */}
        <Section title="Launch essentials">
          <Row title="Upgrade to Pro" subtitle="Unlock all sports." onPress={goToPaywall} />
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <Row
            title="Restore purchases"
            subtitle="If Apple says you already paid."
            onPress={() =>
              Alert.alert('Restore purchases', 'Next: wire to RevenueCat restorePurchases().')
            }
          />
        </Section>

        {/* Easy V2/V3 expansion (no fake functionality now) */}
        <Section title="Coming soon">
          <Row title="Devices" subtitle="See which devices are signed in (v2)." />
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <Row title="Storage" subtitle="See how much video you’ve uploaded (v3)." />
        </Section>

        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
          QuickClip • {Platform.OS.toUpperCase()}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
