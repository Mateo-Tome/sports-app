// app/(auth)/sign-in.tsx - UPDATED

import { useRouter } from 'expo-router'; // <-- Added useRouter
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter(); // <-- Initialized useRouter

  // Helper function to abstract busy state and error handling
  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      Alert.alert(okMsg);
    } catch (e: any) {
      // Supabase errors have a `message` property
      Alert.alert('Error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // --- Supabase Auth Handlers ---

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) throw error;
  };

  const handleCreateAccount = async () => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
    });
    
    if (error) {
      if (error.message.includes('Email link')) {
        Alert.alert('Verify Email', 'Check your inbox to verify your account.');
      }
      throw error;
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const handleContinueAsGuest = async () => {
    try {
        await supabase.auth.signOut();
    } catch {} 
    
    Alert.alert('Continuing', 'Accessing as unauthenticated user.');
    router.replace('/(tabs)'); // <-- Added navigation
  };

  return (
    <KeyboardAvoidingView
      style={styles.container} // <-- Applied style for dark mode
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={{ gap: 8 }}>
        <Text style={styles.headerText}>Sign in</Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#777" // <-- Added placeholder color
          value={email}
          onChangeText={setEmail}
          style={styles.input} // <-- Applied fixed style
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#777" // <-- Added placeholder color
          secureTextEntry
          value={pass}
          onChangeText={setPass}
          style={styles.input} // <-- Applied fixed style
        />
      </View>
      
      {/* 1. SIGN IN */}
      <TouchableOpacity
        disabled={busy}
        onPress={() => run(handleSignIn, 'Signed in')}
        style={[styles.button, { backgroundColor: busy ? '#999' : '#0a84ff' }]}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Working…' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      {/* 2. CREATE ACCOUNT */}
      <TouchableOpacity
        disabled={busy}
        onPress={() => run(handleCreateAccount, 'Account created')}
        style={[styles.button, { backgroundColor: busy ? '#999' : '#34c759' }]}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Working…' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      {/* 3. CONTINUE AS GUEST */}
      <TouchableOpacity
        disabled={busy}
        onPress={() => run(handleContinueAsGuest, 'Continuing as unauthenticated user')}
        style={[styles.button, { backgroundColor: busy ? '#999' : '#ff9f0a' }]}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Working…' : 'Continue as Guest'}
        </Text>
      </TouchableOpacity>

      {/* 4. SIGN OUT */}
      <TouchableOpacity
        disabled={busy}
        onPress={() => run(handleSignOut, 'Signed out')}
        style={[styles.button, { backgroundColor: busy ? '#999' : '#ff3b30' }]}
      >
        <Text style={styles.buttonText}>
          {busy ? 'Working…' : 'Sign Out'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, 
        padding: 20, 
        justifyContent: 'center', 
        gap: 16,
        backgroundColor: 'black', // <-- Set a background color for the screen
    },
    headerText: {
        fontSize: 22, 
        fontWeight: '700',
        color: 'white', // <-- Ensures header text is visible
    },
    input: {
        borderWidth: 1, 
        borderColor: '#333',
        borderRadius: 10, 
        padding: 12,
        backgroundColor: '#1c1c1e', // <-- Dark background for contrast
        color: 'white', // <-- FIX: Sets the input text color to white
    },
    button: {
        padding: 14, 
        borderRadius: 12,
    },
    buttonText: {
        color: 'white', 
        fontWeight: '700', 
        textAlign: 'center',
    },
});