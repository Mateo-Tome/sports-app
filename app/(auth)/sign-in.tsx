// app/(auth)/sign-in.tsx
import { auth } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/userProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Screen = 'start' | 'signin' | 'signup';

const GUEST_OK_KEY = 'guest_ok';

const colors = {
  bg: '#050507',
  card: 'rgba(18,18,22,0.86)',
  stroke: 'rgba(255,255,255,0.10)',
  strokeSoft: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  sub: 'rgba(255,255,255,0.65)',
  dim: 'rgba(255,255,255,0.45)',
  accent: '#ef4444',
  accentDark: '#7f1d1d',
  inputBg: 'rgba(0,0,0,0.35)',
  ghostBg: 'rgba(255,255,255,0.06)',
  ghostStroke: 'rgba(255,255,255,0.18)',
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 22,
        padding: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.stroke,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
      }}
    >
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: busy || disabled ? colors.accentDark : colors.accent,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function GhostButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        marginTop: 10,
        borderRadius: 999,
        paddingVertical: 11,
        alignItems: 'center',
        backgroundColor: colors.ghostBg,
        borderWidth: 1,
        borderColor: colors.ghostStroke,
        opacity: busy ? 0.7 : 1,
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.92)', fontWeight: '900', fontSize: 13 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function BackLink({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <Pressable
      onPress={onBack}
      hitSlop={12}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      })}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>← Back</Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '900', fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SignInScreen() {
  const [screen, setScreen] = useState<Screen>('start');

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isAnon = !!auth.currentUser?.isAnonymous;

  const goToApp = () => router.replace('/(tabs)');

  const headerTitle = useMemo(() => {
    if (screen === 'start') return 'QuickClip';
    if (screen === 'signin') return 'Sign in';
    return 'Create account';
  }, [screen]);

  const headerSub = useMemo(() => {
    if (screen === 'start') {
      return isAnon
        ? 'Guest session active — create an account to keep this device and sync.'
        : 'Record. Review. Win.';
    }
    if (screen === 'signin') return 'Sign in to sync across devices.';
    return isAnon
      ? 'Create an account to save this guest session (keeps the same ID).'
      : 'Create an account so your clips follow you everywhere.';
  }, [screen, isAnon]);

  const validateEmailPass = (minPassLen = 6) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return 'Enter your email.';
    if (!pass) return 'Enter your password.';
    if (pass.length < minPassLen) return `Password must be at least ${minPassLen} characters.`;
    return null;
  };

  const onContinueGuest = async () => {
    setErr(null);
    setBusy(true);
    try {
      // If no user yet, create anon user. If already anon, keep same UID.
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const u = auth.currentUser;
      if (!u) throw new Error('Guest session failed to initialize.');

      await ensureUserDoc(u.uid);

      // ✅ Allow guests into tabs after they tap Continue
      await AsyncStorage.setItem(GUEST_OK_KEY, '1');

      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to continue as guest.');
    } finally {
      setBusy(false);
    }
  };

  const onForgotPassword = async () => {
    setErr(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErr('Enter your email first, then tap “Forgot password?”.');
      return;
    }

    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert('Password reset sent', 'Check your email for a reset link.');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  async function linkAnonToEmailPassword(trimmedEmail: string, password: string) {
    const u = auth.currentUser;
    if (!u || !u.isAnonymous) return false;

    const cred = EmailAuthProvider.credential(trimmedEmail, password);

    try {
      await linkWithCredential(u, cred);
      await ensureUserDoc(u.uid);
      return true;
    } catch (e: any) {
      if (String(e?.code) === 'auth/email-already-in-use') {
        setErr(
          'That email already has an account. Tap “Sign in” instead to use your existing account.'
        );
        return false;
      }
      throw e;
    }
  }

  const onSubmitSignIn = async () => {
    setErr(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setErr('Enter your email.');
    if (!pass) return setErr('Enter your password.');

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);

      // Real user: guest flag no longer needed
      await AsyncStorage.removeItem(GUEST_OK_KEY);

      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmitSignUp = async () => {
    setErr(null);

    const msg = validateEmailPass(6);
    if (msg) return setErr(msg);

    const trimmedEmail = email.trim();

    setBusy(true);
    try {
      if (isAnon) {
        const ok = await linkAnonToEmailPassword(trimmedEmail, pass);
        if (ok) {
          await AsyncStorage.removeItem(GUEST_OK_KEY);
          goToApp();
        }
        return;
      }

      await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);

      await AsyncStorage.removeItem(GUEST_OK_KEY);

      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Sign-up failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 0.8 }}>
          {headerTitle}
        </Text>
        <Text style={{ color: colors.sub, marginTop: 6, fontSize: 12 }}>{headerSub}</Text>

        {isAnon && screen === 'start' && (
          <View
            style={{
              marginTop: 10,
              alignSelf: 'flex-start',
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: 'rgba(239,68,68,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.35)',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 12 }}>
              Guest session active
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 18 }}>
          {screen === 'start' && (
            <Card>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Get started</Text>
              <Text style={{ color: colors.sub, fontSize: 12, marginTop: 6, marginBottom: 16 }}>
                Choose one option. You can change later.
              </Text>

              <PrimaryButton
                label={isAnon ? 'Create account (save this device)' : 'Create account'}
                onPress={() => {
                  setErr(null);
                  setScreen('signup');
                }}
                busy={busy}
              />

              <GhostButton
                label="Sign in to existing account"
                onPress={() => {
                  setErr(null);
                  setScreen('signin');
                }}
                busy={busy}
              />

              <View
                style={{
                  marginTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: colors.strokeSoft,
                  paddingTop: 14,
                }}
              >
                <Text
                  style={{
                    color: colors.sub,
                    fontSize: 11,
                    textAlign: 'center',
                    marginBottom: 10,
                  }}
                >
                  Just want to try it out?
                </Text>

                <TouchableOpacity
                  onPress={onContinueGuest}
                  disabled={busy}
                  style={{
                    borderRadius: 999,
                    paddingVertical: 11,
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.25)',
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                    Continue as Guest
                  </Text>
                </TouchableOpacity>
              </View>

              {!!err && (
                <Text style={{ color: colors.accent, marginTop: 12, fontSize: 13 }} numberOfLines={4}>
                  {err}
                </Text>
              )}
            </Card>
          )}

          {(screen === 'signin' || screen === 'signup') && (
            <Card>
              <BackLink
                label={screen === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                onBack={() => {
                  setErr(null);
                  setBusy(false);
                  setScreen('start');
                }}
              />

              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 6 }}>
                {screen === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
              <Text style={{ color: colors.sub, fontSize: 12, marginTop: 6, marginBottom: 16 }}>
                {screen === 'signin'
                  ? 'Use your existing email and password.'
                  : isAnon
                  ? 'This keeps your guest data and ID — it just adds an email/password.'
                  : 'Create a new account with email and password.'}
              </Text>

              <Text style={{ color: colors.dim, fontSize: 12, marginBottom: 6 }}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.35)"
                editable={!busy}
                style={{
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.strokeSoft,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  marginBottom: 12,
                }}
              />

              <Text style={{ color: colors.dim, fontSize: 12, marginBottom: 6 }}>Password</Text>
              <TextInput
                value={pass}
                onChangeText={setPass}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                editable={!busy}
                style={{
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.strokeSoft,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  marginBottom: 10,
                }}
              />

              {screen === 'signin' && (
                <Pressable
                  onPress={onForgotPassword}
                  disabled={busy}
                  style={{ alignSelf: 'flex-end', marginBottom: 12 }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800', fontSize: 12 }}>
                    Forgot password?
                  </Text>
                </Pressable>
              )}

              {!!err && (
                <Text style={{ color: colors.accent, marginBottom: 12, fontSize: 13 }} numberOfLines={4}>
                  {err}
                </Text>
              )}

              <PrimaryButton
                label={screen === 'signin' ? 'Sign in' : 'Create account'}
                onPress={screen === 'signin' ? onSubmitSignIn : onSubmitSignUp}
                busy={busy}
              />

              {screen === 'signup' && !isAnon && (
                <GhostButton
                  label="Already have an account? Sign in"
                  onPress={() => {
                    setErr(null);
                    setScreen('signin');
                  }}
                  busy={busy}
                />
              )}

              {screen === 'signin' && (
                <GhostButton
                  label="Need an account? Create one"
                  onPress={() => {
                    setErr(null);
                    setScreen('signup');
                  }}
                  busy={busy}
                />
              )}
            </Card>
          )}

          <Text
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 11,
              textAlign: 'center',
              marginTop: 14,
            }}
          >
            You’ll only see this screen if you sign out.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
