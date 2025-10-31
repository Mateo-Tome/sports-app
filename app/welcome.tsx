// app/welcome.tsx

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

// 🛑 REMOVED: import { getSupabaseUser } from '@/lib/supabase';

export default function Welcome() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Ready to test local features.');
  const [hasCheckedSession, setHasCheckedSession] = useState(true); // Forces buttons to show

  // 🛑 TEMPORARILY DISABLED: Removed useEffect to stop checking Supabase session
  useEffect(() => {
    // Setting status immediately to indicate readiness
    setStatus('Ready to test local features.');
    setHasCheckedSession(true);
  }, []);

  const continueAsGuest = () => {
    setBusy(true); 
    setStatus('Navigating to main app...');

    // This is now a simple, guaranteed navigation command.
    router.replace('/(tabs)'); 
  };

  const handleSignIn = () => {
    router.push('/(auth)/sign-in');
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: 'white', fontSize: 30, fontWeight: '900', marginBottom: 12 }}>
        Welcome to Beta
      </Text>
      <Text style={{ color: 'white', opacity: 0.7, marginBottom: 24 }}>
        We are focused on testing recording and highlighting. Everything is saved locally!
      </Text>

      {/* Primary actions container */}
      {hasCheckedSession && (
        <View>
          {/* 1. CONTINUE AS GUEST Button (Primary) - Guaranteed Navigation */}
          <TouchableOpacity
            onPress={continueAsGuest}
            style={{
              backgroundColor: 'white',
              padding: 14,
              borderRadius: 12,
              opacity: busy ? 0.7 : 1,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: 'black', fontWeight: '900', textAlign: 'center' }}>
              {busy ? 'Launching App…' : 'Start Testing (Guest Mode)'}
            </Text>
          </TouchableOpacity>

          {/* 2. SIGN IN Button (Secondary) - Still available, but not required */}
          <TouchableOpacity
            onPress={handleSignIn}
            disabled={busy}
            style={{
              backgroundColor: 'transparent',
              padding: 14,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: 'white',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', textAlign: 'center' }}>
              Sign in / Register (Optional)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {busy || !hasCheckedSession ? <ActivityIndicator style={{ marginTop: 16 }} color="white" /> : null}

      {status !== 'Idle' ? (
        <Text selectable style={{ color: 'white', opacity: 0.8, marginTop: 16 }}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}