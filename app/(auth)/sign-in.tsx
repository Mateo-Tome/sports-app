// app/(auth)/sign-in.tsx
import { auth } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/userProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'signin' | 'signup';

const GUEST_OK_KEY = 'guest_ok';

const GOOGLE_WEB_CLIENT_ID =
  '149278395589-fvs4adqfascj8cntgndod3u4gaokssni.apps.googleusercontent.com';

const colors = {
  bg: '#050507',
  card: '#101014',
  stroke: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  sub: 'rgba(255,255,255,0.62)',
  dim: 'rgba(255,255,255,0.42)',
  accent: '#ef4444',
  input: 'rgba(255,255,255,0.06)',
};

function AppText({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: any;
  numberOfLines?: number;
}) {
  return (
    <Text maxFontSizeMultiplier={1.25} numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

function AuthButton({
  label,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || disabled}
      activeOpacity={0.88}
      style={{
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent,
        opacity: busy || disabled ? 0.55 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <AppText style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>
          {label}
        </AppText>
      )}
    </TouchableOpacity>
  );
}

function ProviderButton({
  label,
  icon,
  onPress,
  busy,
  disabled,
  dark = false,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || disabled}
      activeOpacity={0.88}
      style={{
        height: 50,
        borderRadius: 999,
        backgroundColor: dark ? '#000000' : '#FFFFFF',
        borderWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: busy || disabled ? 0.55 : 1,
        marginTop: 10,
      }}
    >
      {busy ? (
        <ActivityIndicator color={dark ? 'white' : 'black'} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText
            style={{
              width: 24,
              textAlign: 'center',
              marginRight: 10,
              fontSize: 19,
              fontWeight: '900',
              color: dark ? 'white' : 'black',
            }}
          >
            {icon}
          </AppText>

          <AppText
            style={{
              color: dark ? 'white' : '#1f1f1f',
              fontWeight: '800',
              fontSize: 15,
            }}
          >
            {label}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const isAnon = !!auth.currentUser?.isAnonymous;

  useEffect(() => {
    try {
      const { GoogleSignin } = require(
        '@react-native-google-signin/google-signin'
      );

      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
    } catch {
      console.log('Google Sign-In native module not available in this build.');
    }
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const goToApp = () => router.replace('/(tabs)');

  const resetError = () => setErr(null);

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
        setErr('That email already has an account. Sign in instead.');
        return false;
      }
      throw e;
    }
  }

  const validate = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) return 'Enter your email.';
    if (!pass) return 'Enter your password.';
    if (mode === 'signup' && pass.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return null;
  };

  const onGoogleSignIn = async () => {
    resetError();
    setBusy(true);

    let GoogleSignin: any;
    let statusCodes: any;

    try {
      const google = require('@react-native-google-signin/google-signin');
      GoogleSignin = google.GoogleSignin;
      statusCodes = google.statusCodes;
    } catch {
      setErr('Google Sign-In is not available in this iOS build yet.');
      setBusy(false);
      return;
    }

    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;

      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const u = auth.currentUser;

      if (u?.isAnonymous) {
        try {
          await linkWithCredential(u, credential);
        } catch (e: any) {
          const code = String(e?.code ?? '');
          if (
            code === 'auth/credential-already-in-use' ||
            code === 'auth/email-already-in-use'
          ) {
            await signInWithCredential(auth, credential);
          } else {
            throw e;
          }
        }
      } else {
        await signInWithCredential(auth, credential);
      }

      if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);
      await AsyncStorage.removeItem(GUEST_OK_KEY);

      goToApp();
    } catch (e: any) {
      if (e?.code === statusCodes?.SIGN_IN_CANCELLED) return;
      setErr(e?.message ?? 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const onAppleSignIn = () => {
    Alert.alert(
      'Apple Sign-In next',
      'The Apple button is ready visually. We will wire the actual Apple login after Google is fully tested.'
    );
  };

  const onSubmit = async () => {
    resetError();

    const msg = validate();
    if (msg) {
      setErr(msg);
      return;
    }

    const trimmedEmail = email.trim();

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      } else if (isAnon) {
        const ok = await linkAnonToEmailPassword(trimmedEmail, pass);
        if (!ok) return;
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      }

      if (auth.currentUser) await ensureUserDoc(auth.currentUser.uid);
      await AsyncStorage.removeItem(GUEST_OK_KEY);

      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const onForgotPassword = async () => {
    resetError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErr('Enter your email first.');
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

  const title = mode === 'signup' ? 'Create account' : 'Sign in';
  const subtitle =
    mode === 'signup'
      ? 'Save clips, athletes, events, and device access.'
      : 'Welcome back to QuickClip.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 22,
            paddingBottom: 28,
            justifyContent: keyboardOpen ? 'flex-start' : 'center',
          }}
        >
          <View style={{ marginBottom: 26 }}>
            <AppText
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: 34,
                fontWeight: '900',
                letterSpacing: -0.5,
              }}
            >
              QuickClip
            </AppText>

            <AppText
              numberOfLines={2}
              style={{
                color: colors.sub,
                fontSize: 15,
                lineHeight: 21,
                marginTop: 8,
                maxWidth: 330,
              }}
            >
              Record. Organize. Analyze. Share.
            </AppText>
          </View>

          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.stroke,
              padding: 18,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.06)',
                padding: 4,
                marginBottom: 18,
              }}
            >
              {(['signup', 'signin'] as Mode[]).map((m) => {
                const active = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMode(m);
                      resetError();
                    }}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? 'white' : 'transparent',
                    }}
                  >
                    <AppText
                      numberOfLines={1}
                      style={{
                        color: active ? 'black' : 'rgba(255,255,255,0.72)',
                        fontWeight: '900',
                        fontSize: 13,
                      }}
                    >
                      {m === 'signup' ? 'Join' : 'Sign in'}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText
              numberOfLines={1}
              style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}
            >
              {title}
            </AppText>

            <AppText
              numberOfLines={2}
              style={{
                color: colors.sub,
                fontSize: 13,
                lineHeight: 19,
                marginTop: 6,
                marginBottom: 18,
              }}
            >
              {subtitle}
            </AppText>

            <AppText
              style={{
                color: colors.dim,
                fontSize: 12,
                fontWeight: '800',
                marginBottom: 7,
              }}
            >
              Email
            </AppText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.34)"
              editable={!busy}
              maxFontSizeMultiplier={1.2}
              style={{
                height: 52,
                color: colors.text,
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.stroke,
                borderRadius: 15,
                paddingHorizontal: 14,
                fontSize: 15,
                marginBottom: 13,
              }}
            />

            <AppText
              style={{
                color: colors.dim,
                fontSize: 12,
                fontWeight: '800',
                marginBottom: 7,
              }}
            >
              Password
            </AppText>
            <TextInput
              value={pass}
              onChangeText={setPass}
              secureTextEntry
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.34)"
              editable={!busy}
              maxFontSizeMultiplier={1.2}
              style={{
                height: 52,
                color: colors.text,
                backgroundColor: colors.input,
                borderWidth: 1,
                borderColor: colors.stroke,
                borderRadius: 15,
                paddingHorizontal: 14,
                fontSize: 15,
                marginBottom: 10,
              }}
            />

            {mode === 'signin' ? (
              <Pressable
                onPress={onForgotPassword}
                disabled={busy}
                hitSlop={10}
                style={{ alignSelf: 'flex-end', marginBottom: 14 }}
              >
                <AppText
                  style={{
                    color: colors.sub,
                    fontWeight: '800',
                    fontSize: 12,
                  }}
                >
                  Forgot password?
                </AppText>
              </Pressable>
            ) : (
              <View style={{ height: 10 }} />
            )}

            {!!err && (
              <AppText
                numberOfLines={3}
                style={{
                  color: colors.accent,
                  fontSize: 13,
                  lineHeight: 18,
                  marginBottom: 12,
                }}
              >
                {err}
              </AppText>
            )}

            <AuthButton label="Continue" onPress={onSubmit} busy={busy} />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 18,
                marginBottom: 2,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                }}
              />
              <AppText
                style={{
                  color: colors.dim,
                  fontSize: 11,
                  fontWeight: '900',
                }}
              >
                OR
              </AppText>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                }}
              />
            </View>

            <ProviderButton
              label="Continue with Google"
              icon="G"
              onPress={onGoogleSignIn}
              busy={busy}
            />

            {Platform.OS === 'ios' && (
              <ProviderButton
                label="Continue with Apple"
                icon=""
                onPress={onAppleSignIn}
                busy={false}
                disabled={busy}
                dark
              />
            )}
          </View>

          <AppText
            numberOfLines={2}
            style={{
              color: 'rgba(255,255,255,0.34)',
              fontSize: 11,
              lineHeight: 16,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            Free includes all sports and unlimited local recording.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}