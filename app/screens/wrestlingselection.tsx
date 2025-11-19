// app/screens/wrestlingselection.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WrestlingSelection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ athlete?: string | string[] }>();
  const athleteParam = Array.isArray(params.athlete) ? params.athlete[0] : params.athlete;
  const athlete = (athleteParam ?? 'Unassigned').trim() || 'Unassigned';

  const go = (style: 'folkstyle' | 'freestyle' | 'greco') => {
    router.push({
      pathname: '/record/camera',
      params: { athlete, sport: 'wrestling', style },
    });
  };

  const CardBtn = ({
    icon,
    title,
    subtitle,
    onPress,
    comingSoon = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    comingSoon?: boolean;
  }) => (
    <TouchableOpacity
      onPress={comingSoon ? undefined : onPress}
      disabled={comingSoon}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        width: '88%',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: comingSoon
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        opacity: comingSoon ? 0.45 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ maxWidth: '82%' }}>
          <Text
            style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '800',
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                marginTop: 2,
                fontSize: 13,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}

          {/* "Coming soon" label – easy to remove later */}
          {comingSoon && (
            <Text
              style={{
                color: '#facc15',
                fontSize: 12,
                fontWeight: '800',
                marginTop: 4,
              }}
            >
              Coming soon
            </Text>
          )}
        </View>
      </View>
      <Text
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 22,
          marginLeft: 8,
        }}
      >
        ›
      </Text>
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
        <Text
          style={{ color: 'white', fontSize: 22, fontWeight: '900' }}
        >
          Choose wrestling style
        </Text>
        <Text
          style={{ color: '#AAA', marginTop: 6, marginBottom: 10 }}
        >
          Recording — {athlete}
        </Text>

        {/* Folkstyle = fully enabled */}
        <CardBtn
          icon="🇺🇸"
          title="Folkstyle"
          subtitle="High school & college (US)"
          onPress={() => go('folkstyle')}
        />

        {/* Freestyle / Greco = clearly marked as Coming Soon */}
        <CardBtn
          icon="🌍"
          title="Freestyle"
          subtitle="International rules"
          onPress={() => go('freestyle')}
          comingSoon
        />
        <CardBtn
          icon="🛡️"
          title="Greco-Roman"
          subtitle="Upper-body only"
          onPress={() => go('greco')}
          comingSoon
        />
      </View>
    </>
  );
}
