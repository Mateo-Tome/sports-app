// app/(auth)/choose-sport.tsx
import { auth } from '@/lib/firebase';
import { ensureUserDoc, lockFreeSport, type SportKey } from '@/lib/userProfile';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SportOption = { key: SportKey; title: string; subtitle: string };

const OPTIONS: SportOption[] = [
  { key: 'wrestling', title: 'Wrestling', subtitle: 'Folkstyle / Freestyle / Greco' },
  { key: 'baseball', title: 'Baseball', subtitle: 'At-bats, pitches, plays' },
  { key: 'basketball', title: 'Basketball', subtitle: 'Shots, assists, defense' },
  { key: 'volleyball', title: 'Volleyball', subtitle: 'Pass ratings, kills, blocks' },
  { key: 'bjj', title: 'BJJ', subtitle: 'Gi / No-gi rounds & notes' },
];

export default function ChooseSportScreen() {
  const user = auth.currentUser;
  const [picked, setPicked] = useState<SportKey | null>(null);
  const [busy, setBusy] = useState(false);

  const canUse = !!user;

  const pickedLabel = useMemo(() => {
    const o = OPTIONS.find((x) => x.key === picked);
    return o?.title ?? '';
  }, [picked]);

  const onConfirm = async () => {
    const u = auth.currentUser; // re-check in case auth changed
    if (!u) {
      Alert.alert('Start a session', 'Tap “Continue as Guest” or sign in first.');
      router.replace('/(auth)/sign-in');
      return;
    }
    if (!picked) return;

    Alert.alert(
      'Lock this sport?',
      `Free accounts choose ONE sport forever.\n\nLock: ${pickedLabel}\n\nUpgrade to Pro anytime to unlock all sports.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Lock it',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await ensureUserDoc(u.uid);
              await lockFreeSport(u.uid, picked);
              router.replace('/(tabs)');
            } catch (e: any) {
              Alert.alert('Could not lock sport', e?.message ?? 'Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '900' }}>
          Choose your free sport
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 12 }}>
          Free accounts get full access to ONE sport. Upgrade to Pro anytime to unlock all sports.
        </Text>

        {!canUse && (
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>Start a session</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4, fontSize: 12 }}>
              Tap “Continue as Guest” or sign in so we can save your choice.
            </Text>

            <Pressable
              onPress={() => router.replace('/(auth)/sign-in')}
              style={({ pressed }) => ({
                marginTop: 10,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: 'center',
                backgroundColor: pressed ? '#b91c1c' : '#ef4444',
              })}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Go to sign in</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 18, paddingTop: 14, gap: 10 }}>
        {OPTIONS.map((o) => {
          const selected = picked === o.key;
          return (
            <Pressable
              key={o.key}
              disabled={!canUse || busy}
              onPress={() => setPicked(o.key)}
              style={({ pressed }) => ({
                opacity: !canUse ? 0.5 : pressed ? 0.8 : 1,
                padding: 14,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: selected ? 'white' : 'rgba(255,255,255,0.15)',
                backgroundColor: selected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
              })}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{o.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 2, fontSize: 12 }}>
                {o.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ padding: 18, paddingBottom: 22 }}>
        <Pressable
          disabled={!canUse || !picked || busy}
          onPress={onConfirm}
          style={({ pressed }) => ({
            opacity: !canUse || !picked || busy ? 0.5 : pressed ? 0.8 : 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: 'center',
            backgroundColor: '#ef4444',
          })}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: 'white', fontWeight: '900' }}>Continue</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            marginTop: 10,
            opacity: pressed ? 0.7 : 1,
            paddingVertical: 10,
            borderRadius: 999,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(255,255,255,0.06)',
          })}
        >
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '900' }}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
