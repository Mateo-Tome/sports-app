// app/(auth)/sign-in.tsx
import { auth } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/userProfile';
import { router } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true),
    );

    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const goToApp = () => router.replace('/(tabs)');

  const resetError = () => setErr(null);

  const validate = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) return 'Enter your email.';
    if (!pass) return 'Enter your password.';
    if (mode === 'signup' && pass.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return null;
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
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      }

      if (auth.currentUser) {
        await ensureUserDoc(auth.currentUser.uid);
      }

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
      ? 'Use the same email and password on every device.'
      : 'Sign in using the email and password you created for QuickClip.';

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
              numberOfLines={3}
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
                numberOfLines={4}
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
          </View>

          <AppText
            numberOfLines={3}
            style={{
              color: 'rgba(255,255,255,0.34)',
              fontSize: 11,
              lineHeight: 16,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            One parent account. Athletes are profiles, not separate accounts.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}