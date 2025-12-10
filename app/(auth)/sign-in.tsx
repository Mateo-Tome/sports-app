// app/(auth)/sign-in.tsx
import { auth } from '@/lib/firebase';
import { router } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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

  const accentRed = '#ef4444';
  const darkRed = '#7f1d1d';

  const goToApp = () => router.replace('/(tabs)');

  const onContinueGuest = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signInAnonymously(auth);
      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to continue as guest.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setErr(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !pass) {
      setErr('Please enter an email and password.');
      return;
    }
    if (mode === 'signup' && pass.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      }
      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Auth error');
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'signin' ? 'Welcome back' : 'Create your account';
  const primaryCta =
    mode === 'signin' ? 'Sign in' : 'Sign up';

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: 'black',
      }}
    >
      {/* Top header / branding - safe from the notch */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: 12,
          paddingTop: 4,
          backgroundColor: '#0b0b0b',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Text
          style={{
            color: 'white',
            fontSize: 28,
            fontWeight: '900',
            letterSpacing: 1,
            textShadowColor: 'rgba(239,68,68,0.45)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 16,
          }}
        >
          QuickClip
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            marginTop: 2,
          }}
        >
          Record. Review. Win.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            justifyContent: 'center',
          }}
        >
          {/* Card container */}
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            }}
          >
            {/* Mode toggle */}
            <View
              style={{
                flexDirection: 'row',
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                overflow: 'hidden',
                marginBottom: 20,
                backgroundColor: '#090909',
              }}
            >
              <TouchableOpacity
                onPress={() => setMode('signin')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor:
                    mode === 'signin' ? accentRed : 'transparent',
                }}
                disabled={busy}
              >
                <Text
                  style={{
                    color: mode === 'signin' ? 'white' : 'rgba(255,255,255,0.7)',
                    fontWeight: '800',
                    fontSize: 14,
                  }}
                >
                  Sign in
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('signup')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor:
                    mode === 'signup' ? accentRed : 'transparent',
                }}
                disabled={busy}
              >
                <Text
                  style={{
                    color: mode === 'signup' ? 'white' : 'rgba(255,255,255,0.7)',
                    fontWeight: '800',
                    fontSize: 14,
                  }}
                >
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Screen title */}
            <Text
              style={{
                color: 'white',
                fontSize: 22,
                fontWeight: '800',
                marginBottom: 4,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              {mode === 'signin'
                ? 'Sign in to sync your matches across every device.'
                : 'Create a QuickClip account so your matches follow you everywhere.'}
            </Text>

            {/* Inputs */}
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={{
                color: 'white',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 10,
                fontSize: 14,
                backgroundColor: '#050505',
              }}
              editable={!busy}
            />

            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                marginBottom: 4,
                marginTop: 4,
              }}
            >
              Password
            </Text>
            <TextInput
              value={pass}
              onChangeText={setPass}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={{
                color: 'white',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 8,
                fontSize: 14,
                backgroundColor: '#050505',
              }}
              editable={!busy}
            />

            {/* Small hint */}
            {mode === 'signup' && (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                Use an email you’ll remember — your cloud videos will be tied to
                this account.
              </Text>
            )}

            {/* Error */}
            {!!err && (
              <Text
                style={{
                  color: accentRed,
                  marginBottom: 10,
                  fontSize: 13,
                }}
                numberOfLines={3}
              >
                {err}
              </Text>
            )}

            {/* Primary button */}
            <TouchableOpacity
              onPress={onSubmit}
              disabled={busy}
              style={{
                backgroundColor: busy ? darkRed : accentRed,
                borderRadius: 999,
                paddingVertical: 12,
                alignItems: 'center',
                marginBottom: 10,
                opacity: busy ? 0.85 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '800',
                    fontSize: 15,
                  }}
                >
                  {primaryCta}
                </Text>
              )}
            </TouchableOpacity>

            {/* Tiny text link to flip mode */}
            <TouchableOpacity
              disabled={busy}
              onPress={() =>
                setMode(mode === 'signin' ? 'signup' : 'signin')
              }
              style={{ marginBottom: 14 }}
            >
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                {mode === 'signin'
                  ? "Don't have an account yet? Sign up"
                  : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>

            {/* Divider for social logins */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginVertical: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}
              />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  marginHorizontal: 8,
                }}
              >
                or continue with
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}
              />
            </View>

            {/* Social buttons - UI only for now */}
            <View style={{ gap: 8, marginBottom: 6 }}>
              <TouchableOpacity
                disabled
                style={{
                  borderRadius: 999,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                  opacity: 0.7,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  Continue with Apple
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled
                style={{
                  borderRadius: 999,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#050505',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                  opacity: 0.7,
                }}
              >
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.95)',
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  Continue with Google
                </Text>
              </TouchableOpacity>
            </View>

            {/* Continue as guest */}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.12)',
                paddingTop: 10,
                marginTop: 6,
              }}
            >
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Just want to try it out?
              </Text>

              <TouchableOpacity
                onPress={onContinueGuest}
                disabled={busy}
                style={{
                  backgroundColor: '#050505',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  paddingVertical: 10,
                  alignItems: 'center',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  Continue as Guest
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tiny footer hint */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            Your videos stay on your device until you choose to upload them.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
