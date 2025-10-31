// app/(tabs)/settings.tsx

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// 🚨 SUPABASE IMPORTS
import { getSupabaseUser, supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<'signed-in' | 'guest' | 'error'>('guest');

  // --- AUTH STATE MONITOR ---
  useEffect(() => {
    // 1. Monitor real-time changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const user = session?.user || null;
        setUid(user?.id ?? null);
        setAuthStatus(user ? 'signed-in' : 'guest'); 
      }
    );

    // 2. Initial check
    (async () => {
        const user = await getSupabaseUser();
        setUid(user?.id ?? null);
        setAuthStatus(user ? 'signed-in' : 'guest');
    })();
    
    return () => {
        subscription.unsubscribe();
    };
  }, []);
  
  // 🚨 NEW FUNCTION: Sign In (TEST ONLY)
  const handleSignIn = async () => {
    setBusy(true);
    try {
      // ⚠️ REPLACE WITH YOUR ACTUAL TEST EMAIL AND PASSWORD!
      const TEST_EMAIL = "your-real-email-address"; 
      const TEST_PASSWORD = "your-test-password"; 
      
      const { error } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      if (error) throw error;
      
      Alert.alert('Sign In OK', `Logged in successfully.`);
      
    } catch (e: any) {
      Alert.alert('Sign In Failed', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // 🚨 NEW FUNCTION: Sign Out
  const handleSignOut = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      Alert.alert('Sign Out OK', 'You have been logged out.');
      
    } catch (e: any) {
      Alert.alert('Sign Out Failed', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };


  // --- TEST HANDLERS (Same logic as before) ---
  const handleRefreshToken = async () => {
    setBusy(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        Alert.alert('No user', 'No user is signed in.');
        return;
      }
      const tok = session.access_token;
      setTokenPreview(`${tok.slice(0, 10)}…${tok.slice(-10)}`);
      Alert.alert('Session valid', 'Access token is up-to-date.');
    } catch (e: any) {
      Alert.alert('Token check failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleTestDatabaseWrite = async () => {
    setBusy(true);
    try {
      const user = await getSupabaseUser();
      if (!user) {
        Alert.alert('Error', 'Must be signed in to test DB write.');
        return;
      }

      const { error } = await supabase
        .from('diagnostics') 
        .insert({
          uid: user.id,
          message: 'Supabase test write OK',
        });

      if (error) throw error;
      Alert.alert('Supabase DB', 'Test write OK.');
    } catch (e: any) {
      Alert.alert('Supabase DB write failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleTestStorageUpload = async () => {
    setBusy(true);
    setUploadPct(0);
    setLastUrl(null);
    
    try {
      const user = await getSupabaseUser();
      if (!user) {
          Alert.alert('Error', 'Must be signed in to upload (RLS).');
          return;
      }
      const userId = user.id;

      const logicalPath = `${userId}/diagnostics-${Date.now()}.txt`;
      const fileContent = `hello from Expo RN at ${new Date().toISOString()}\n`;
      const blob = new Blob([fileContent], { type: 'text/plain' });

      const { error: uploadError } = await supabase.storage
        .from('user-videos') 
        .upload(logicalPath, blob, { contentType: 'text/plain', upsert: false });
        
      if (uploadError) throw uploadError;

      setUploadPct(100);

      const { data: publicURLData } = supabase.storage
        .from('user-videos')
        .getPublicUrl(logicalPath);
        
      const url = publicURLData.publicUrl;
      setLastUrl(url);
      
      Alert.alert('Storage', 'Upload OK.');
    } catch (e: any) {
      Alert.alert('Storage upload failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
      setTimeout(() => setUploadPct(null), 1500);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      
      {/* --- STATUS DISPLAY --- */}
      <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#11111110' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Settings</Text>
        <Text style={{ fontSize: 16, marginBottom: 4 }}>
          Auth state: {uid ? 'signed in' : 'guest (anon)'}
        </Text>
        <Text selectable style={{ fontSize: 14, opacity: 0.8 }}>
          UID: {uid ?? '—'}
        </Text>
        {/* ... (rest of the status display) ... */}
        {tokenPreview && (
          <Text selectable style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Token preview: {tokenPreview}
          </Text>
        )}
        {uploadPct !== null && (
          <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Upload: {uploadPct}%
          </Text>
        )}
        {lastUrl && (
          <Text selectable style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Last URL: {lastUrl}
          </Text>
        )}
      </View>

      {/* --- AUTH BUTTONS --- */}
      {uid ? ( // Show Sign Out if logged in
         <TouchableOpacity
            onPress={handleSignOut}
            disabled={busy}
            style={{ padding: 14, borderRadius: 12, backgroundColor: busy ? '#999' : '#ff3b30' }}
          >
            <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
              {busy ? 'Logging Out…' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
      ) : ( // Show Sign In if logged out
        <TouchableOpacity
          onPress={handleSignIn}
          disabled={busy}
          style={{ padding: 14, borderRadius: 12, backgroundColor: busy ? '#999' : '#5ac8fa' }}
        >
          <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
            {busy ? 'Signing In…' : 'Sign In as Test User'}
          </Text>
        </TouchableOpacity>
      )}

      {/* --- TEST BUTTONS --- */}
      <TouchableOpacity
        onPress={handleRefreshToken}
        disabled={busy}
        style={{ padding: 14, borderRadius: 12, backgroundColor: busy ? '#999' : '#0a84ff' }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
          {busy ? 'Working…' : 'Check Access Token'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleTestDatabaseWrite}
        disabled={busy || !uid} 
        style={{ padding: 14, borderRadius: 12, backgroundColor: (busy || !uid) ? '#999' : '#34c759' }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
          {busy ? 'Working…' : 'Test Supabase DB Write'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleTestStorageUpload}
        disabled={busy || !uid} 
        style={{ padding: 14, borderRadius: 12, backgroundColor: (busy || !uid) ? '#999' : '#ff9f0a' }}
      >
        <Text style={{ color: 'white', fontWeight: '700', textAlign: 'center' }}>
          {busy ? 'Working…' : 'Test Supabase Storage Upload'}
        </Text>
      </TouchableOpacity>

      {busy && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <ActivityIndicator />
        </View>
      )}
    </ScrollView>
  );
}