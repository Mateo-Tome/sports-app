// app/(tabs)/account.tsx
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
      }}
    >
      <View style={{ padding: 20 }}>{children}</View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
      style={{
        flex: 1,
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: disabled ? 'rgba(239,68,68,0.45)' : '#ef4444',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOpacity: disabled ? 0 : 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: disabled ? 0 : 8,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function GhostButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
      style={{
        flex: 1,
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.88)', fontWeight: '800', fontSize: 16 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function IconCheck() {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(34,197,94,0.16)',
        borderWidth: 1.5,
        borderColor: 'rgba(34,197,94,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#22c55e', fontWeight: '900', fontSize: 12, lineHeight: 12 }}>✓</Text>
    </View>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const identity = useMemo(() => {
    if (!user) {
      return {
        badge: 'SIGNED OUT',
        badgeColor: 'rgba(239,68,68,0.12)',
        badgeBorder: 'rgba(239,68,68,0.30)',
        badgeText: '#ef4444',
        headline: "You're not signed in",
        detail: 'Sign in to sync your clips across all devices and unlock Pro features.',
        line1: '',
        line2: '',
      };
    }

    if (user.isAnonymous) {
      const id = shortUid(user.uid);
      return {
        badge: 'GUEST SESSION',
        badgeColor: 'rgba(245,194,77,0.12)',
        badgeBorder: 'rgba(245,194,77,0.30)',
        badgeText: '#f5c24d',
        headline: 'Guest mode active',
        detail: 'Create an account to preserve your data and sync across devices.',
        line1: id ? `Guest ID: ${id}` : '',
        line2: '⚠️ Data not backed up',
      };
    }

    const emailLine = maskEmail(user.email);
    return {
      badge: 'SIGNED IN',
      badgeColor: 'rgba(34,197,94,0.12)',
      badgeBorder: 'rgba(34,197,94,0.30)',
      badgeText: '#22c55e',
      headline: 'Account active',
      detail: 'Your clips are synced and backed up across all devices.',
      line1: emailLine || (user.uid ? `User ID: ${shortUid(user.uid)}` : ''),
      line2: user.emailVerified ? '✓ Email verified' : 'Email not verified',
    };
  }, [user?.uid, user?.email, user?.isAnonymous, user?.emailVerified]);

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

  const actionRow = () => {
    if (!user) {
      return (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          <PrimaryButton label="Sign In" onPress={goToSignIn} disabled={busy} />
          <GhostButton label="Close" onPress={() => router.back()} disabled={busy} />
        </View>
      );
    }

    if (user.isAnonymous) {
      return (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          <PrimaryButton label="Create Account" onPress={goToSignIn} disabled={busy} />
          <GhostButton label="Not now" onPress={() => router.back()} disabled={busy} />
        </View>
      );
    }
    

    return (
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
        <PrimaryButton label="Upgrade to Pro" onPress={goToPaywall} disabled={busy} />
        <GhostButton label="Sign Out" onPress={handleSignOut} disabled={busy} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(28, insets.bottom + 20),
          paddingTop: Math.max(16, insets.top + 12), // notch-safe
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 4, marginBottom: 24 }}>
          <View
            style={{
              backgroundColor: identity.badgeColor,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              alignSelf: 'flex-start',
              borderWidth: 1,
              borderColor: identity.badgeBorder,
            }}
          >
            <Text style={{ color: identity.badgeText, fontSize: 13, fontWeight: '900' }}>
              {identity.badge}
            </Text>
          </View>

          <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', marginTop: 16, letterSpacing: -0.5 }}>
            Account
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 10, fontSize: 16, lineHeight: 24 }}>
            Manage your QuickClip account and subscription
          </Text>
        </View>

        {/* Status */}
        <View style={{ marginBottom: 16 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Status
              </Text>

              {busy && <ActivityIndicator color="#ef4444" size="small" />}
            </View>

            <Text style={{ color: 'white', fontWeight: '900', fontSize: 22, marginBottom: 8 }}>
              {identity.headline}
            </Text>

            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20 }}>
              {identity.detail}
            </Text>

            {(!!identity.line1 || !!identity.line2) && (
              <View
                style={{
                  marginTop: 16,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.10)',
                }}
              >
                {!!identity.line1 && (
                  <Text style={{ color: 'rgba(255,255,255,0.88)', fontWeight: '800', fontSize: 13 }}>
                    {identity.line1}
                  </Text>
                )}
                {!!identity.line2 && (
                  <Text
                    style={{
                      color: identity.line2.includes('✓')
                        ? '#22c55e'
                        : identity.line2.includes('⚠️')
                        ? '#f5c24d'
                        : 'rgba(255,255,255,0.55)',
                      fontWeight: '700',
                      fontSize: 12,
                      marginTop: identity.line1 ? 6 : 0,
                    }}
                  >
                    {identity.line2}
                  </Text>
                )}
              </View>
            )}

            {actionRow()}
          </Card>
        </View>

        {/* Pro benefits */}
        <View style={{ marginBottom: 16 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 20 }}>
                  QuickClip Pro
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.60)', fontWeight: '700', fontSize: 13, marginTop: 2 }}>
                  Everything unlocked
                </Text>
              </View>

              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: 'rgba(245,194,77,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(245,194,77,0.3)',
                }}
              >
                <Text style={{ color: '#f5c24d', fontWeight: '900', fontSize: 14 }}>
                  $10.99/mo
                </Text>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              {[
                'All sports unlocked',
                'Extended cloud storage',
                'Sync up to 5 devices',
                'Priority upload processing',
                'Advanced stats & analytics',
              ].map((t) => (
                <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconCheck />
                  <Text style={{ color: 'rgba(255,255,255,0.88)', fontWeight: '700', fontSize: 14, flex: 1 }}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={goToPaywall}
              activeOpacity={0.88}
              style={{
                marginTop: 18,
                borderRadius: 18,
                paddingVertical: 15,
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.90)', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
                View plan options
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* App info */}
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
            QuickClip
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '600' }}>
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} • Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
