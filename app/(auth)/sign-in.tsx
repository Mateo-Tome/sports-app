import { auth } from '@/lib/firebase';
import { router } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    signInAnonymously,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignInScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), pass);
      }
      goToApp();
    } catch (e: any) {
      setErr(e?.message ?? 'Auth error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', padding: 20, justifyContent: 'center' }}>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '900', marginBottom: 24 }}>
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="rgba(255,255,255,0.5)"
        style={{
          color: 'white',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}
      />
      <TextInput
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="rgba(255,255,255,0.5)"
        style={{
          color: 'white',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 16,
        }}
      />

      {!!err && (
        <Text style={{ color: 'tomato', marginBottom: 12 }} numberOfLines={3}>
          {err}
        </Text>
      )}

      <TouchableOpacity
        onPress={onSubmit}
        disabled={busy}
        style={{
          backgroundColor: 'white',
          borderRadius: 999,
          paddingVertical: 12,
          alignItems: 'center',
          marginBottom: 12,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator />
        ) : (
          <Text style={{ color: 'black', fontWeight: '800' }}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        style={{
          borderColor: 'white',
          borderWidth: 1,
          borderRadius: 999,
          paddingVertical: 12,
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Have an account? Sign in'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onContinueGuest}
        disabled={busy}
        style={{
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: 'white',
          borderRadius: 999,
          paddingVertical: 12,
          alignItems: 'center',
          opacity: busy ? 0.7 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800' }}>Continue as Guest</Text>
      </TouchableOpacity>
    </View>
  );
}
