import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BaseballSelection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ athlete?: string | string[] }>();
  const athleteParam = Array.isArray(params.athlete) ? params.athlete[0] : params.athlete;
  const athlete = (athleteParam ?? 'Unassigned').trim() || 'Unassigned';

  // The 'go' function now pushes 'baseball' as the sport, and 'hitting' or 'pitching' as the style.
  const go = (style: 'hitting' | 'pitching') => {
    // The camera screen will receive sport: 'baseball' and style: 'hitting' or 'pitching'
    router.push({ pathname: '/record/camera', params: { athlete, sport: 'baseball', style } });
  };

  const CardBtn = ({
    icon, title, subtitle, onPress,
  }: { icon: string; title: string; subtitle?: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        width: '88%',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ maxWidth: '82%' }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2, fontSize: 13 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 22, marginLeft: 8 }}>›</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Use the system header back chevron only */}
      <Stack.Screen
        options={{
          title: '',
          headerTitle: '',
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: 'white',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          paddingTop: insets.top + 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900' }}>Choose baseball focus</Text>
        <Text style={{ color: '#AAA', marginTop: 6, marginBottom: 10 }}>Recording — {athlete}</Text>

        {/* Buttons for Baseball Focus */}
        <CardBtn icon="⚾️" title="Hitting"  subtitle="Track contact, base hits, and outs" onPress={() => go('hitting')} />
        <CardBtn icon="🧍" title="Pitching" subtitle="Track pitch type, speed, and location" onPress={() => go('pitching')} />
      </View>
    </>
  );
}