// app/(auth)/sign-in.tsx
import { auth } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/userProfile';
import { router } from 'expo-router';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useMemo, useState } from 'react';
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

export default function SignInScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isAnon = !!auth.currentUser?.isAnonymous;

  const goToApp = () => router.replace('/(tabs)');

  const colors = {
    bg: '#050507',
    card: 'rgba(18,18,22,0.85)',
    stroke: 'rgba(255,255,255,0.10)',
    strokeSoft: 'rgba(255,255,255,0.06)',
    text: '#FFFFFF',
    sub: 'rgba(255,255,255,0.65)',
    dim: 'rgba(255,255,255,0.45)',
    accent: '#ef4444',
    accentDark: '#7f1d1d',
    inputBg: 'rgba(0,0,0,0.35)',
  };

  const title = useMemo(() => {
    if (isAnon) return 'Upgrade your guest';
    return mode === 'signin' ? 'Welcome back' : 'Create account';
  }, [isAnon, mode]);

  const subtitle = useMemo(() => {
    if (isAnon) return 'Add an email so your clips sync across devices.';
    return mode === 'signin'
      ? 'Sign in to sync your matches across every device.'
      : 'Create an account so your matches follow you everywhere.';
  }, [isAnon, mode]);

  const primaryCta = useMemo(() => {
    if (isAnon) return 'Upgrade guest account';
    return mode === 'signin' ? 'Sign in' : 'Sign up';
  }, [isAnon, mode]);

  const validate = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return 'Enter your email.';
    if (!pass && (mode === 'signin' || mode === 'signup' || isAnon)) return 'Enter your password.';
    if ((mode === 'signup' || isAnon) && pass.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  // ✅ FIX: guest now creates Firestore user doc immediately
  const onContinueGuest = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      if (auth.currentUser) {
        await ensureUserDoc(auth.currentUser.uid);
      }

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

  async function upgradeAnonWithEmailPassword(trimmedEmail: string, password: string) {
    const u = auth.currentUser;
    if (!u || !u.isAnonymous) return false;

    const cred = EmailAuthProvider.credential(trimmedEmail, password);

    try {
      await linkWithCredential(u, cred);

      // ✅ ensure Firestore user profile exists (keeps same UID)
      await ensureUserDoc(u.uid);

      return true;
    } catch (e: any) {
      if (String(e?.code) === 'auth/email-already-in-use') {
        setErr(
          'That email already has a QuickClip account. If you want to use it, tap “Sign into existing account instead”.'
        );
        return false;
      }
      throw e;
    }
  }

  const onSubmitPrimary = async () => {
    setErr(null);

    const msg = validate();
    if (msg) {
      setErr(msg);
      return;
    }

    const trimmedEmail = email.trim();

    setBusy(true);
    try {
      if (isAnon) {
        const ok = await upgradeAnonWithEmailPassword(trimmedEmail, pass);
        if (ok) goToApp();
        return;
      }

      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, trimmedEmail, pass);
        if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
        if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);
      }

      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Auth error');
    } finally {
      setBusy(false);
    }
  };

  const onSignIntoExistingInstead = async () => {
    setErr(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !pass) {
      setErr('Enter an email and password to sign into an existing account.');
      return;
    }

    Alert.alert(
      'Switch accounts?',
      'This will sign into your existing account. Any guest-only data that hasn’t been uploaded/synced may not show here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign in',
          style: 'default',
          onPress: async () => {
            setBusy(true);
            try {
              await signInWithEmailAndPassword(auth, trimmedEmail, pass);
              if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);
              goToApp();
            } catch (e: any) {
              setErr(e?.message ?? 'Sign-in failed.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 0.8 }}>
          QuickClip
        </Text>
        <Text style={{ color: colors.sub, marginTop: 4, fontSize: 12 }}>
          Record. Review. Win.
        </Text>

        {isAnon && (
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 18 }}>
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
            {!isAnon && (
              <View
                style={{
                  flexDirection: 'row',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  overflow: 'hidden',
                  marginBottom: 18,
                  backgroundColor: 'rgba(0,0,0,0.25)',
                }}
              >
                <TouchableOpacity
                  onPress={() => setMode('signin')}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor: mode === 'signin' ? colors.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: mode === 'signin' ? '#fff' : colors.sub, fontWeight: '900', fontSize: 13 }}>
                    Sign in
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMode('signup')}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor: mode === 'signup' ? colors.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: mode === 'signup' ? '#fff' : colors.sub, fontWeight: '900', fontSize: 13 }}>
                    Sign up
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{title}</Text>
            <Text style={{ color: colors.sub, fontSize: 12, marginTop: 6, marginBottom: 16 }}>
              {subtitle}
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

            {!isAnon && mode === 'signin' && (
              <Pressable onPress={onForgotPassword} disabled={busy} style={{ alignSelf: 'flex-end', marginBottom: 12 }}>
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

            <TouchableOpacity
              onPress={onSubmitPrimary}
              disabled={busy}
              style={{
                borderRadius: 999,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: busy ? colors.accentDark : colors.accent,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{primaryCta}</Text>
              )}
            </TouchableOpacity>

            {isAnon && (
              <TouchableOpacity
                onPress={onSignIntoExistingInstead}
                disabled={busy}
                style={{
                  marginTop: 10,
                  borderRadius: 999,
                  paddingVertical: 11,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.92)', fontWeight: '900', fontSize: 13 }}>
                  Sign into existing account instead
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.strokeSoft, paddingTop: 14 }}>
              <Text style={{ color: colors.sub, fontSize: 11, textAlign: 'center', marginBottom: 10 }}>
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
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', marginTop: 14 }}>
            Stay signed in — you’ll only see this screen if you sign out.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
