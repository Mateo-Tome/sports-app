import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Stroke = 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'im';

type SwimEvent = {
  label: string;
  raceLabel: string;
  stroke: Stroke;
  distance: string;
};

const YOUTH_EVENTS: SwimEvent[] = [
  { label: '25 Free', raceLabel: '25 Free', stroke: 'freestyle', distance: '25' },
  { label: '25 Back', raceLabel: '25 Back', stroke: 'backstroke', distance: '25' },
  { label: '25 Breast', raceLabel: '25 Breast', stroke: 'breaststroke', distance: '25' },
  { label: '25 Fly', raceLabel: '25 Fly', stroke: 'butterfly', distance: '25' },
];

const STANDARD_EVENTS: { title: string; subtitle: string; events: SwimEvent[] }[] = [
  {
    title: 'Freestyle',
    subtitle: 'Free / front crawl',
    events: [
      { label: '50', raceLabel: '50 Free', stroke: 'freestyle', distance: '50' },
      { label: '100', raceLabel: '100 Free', stroke: 'freestyle', distance: '100' },
      { label: '200', raceLabel: '200 Free', stroke: 'freestyle', distance: '200' },
      { label: '400/500', raceLabel: '400/500 Free', stroke: 'freestyle', distance: '400/500' },
      { label: '800/1000', raceLabel: '800/1000 Free', stroke: 'freestyle', distance: '800/1000' },
      { label: '1500/1650', raceLabel: '1500/1650 Free', stroke: 'freestyle', distance: '1500/1650' },
    ],
  },
  {
    title: 'Backstroke',
    subtitle: 'Back',
    events: [
      { label: '50', raceLabel: '50 Back', stroke: 'backstroke', distance: '50' },
      { label: '100', raceLabel: '100 Back', stroke: 'backstroke', distance: '100' },
      { label: '200', raceLabel: '200 Back', stroke: 'backstroke', distance: '200' },
    ],
  },
  {
    title: 'Breaststroke',
    subtitle: 'Breast',
    events: [
      { label: '50', raceLabel: '50 Breast', stroke: 'breaststroke', distance: '50' },
      { label: '100', raceLabel: '100 Breast', stroke: 'breaststroke', distance: '100' },
      { label: '200', raceLabel: '200 Breast', stroke: 'breaststroke', distance: '200' },
    ],
  },
  {
    title: 'Butterfly',
    subtitle: 'Fly',
    events: [
      { label: '50', raceLabel: '50 Fly', stroke: 'butterfly', distance: '50' },
      { label: '100', raceLabel: '100 Fly', stroke: 'butterfly', distance: '100' },
      { label: '200', raceLabel: '200 Fly', stroke: 'butterfly', distance: '200' },
    ],
  },
  {
    title: 'IM',
    subtitle: 'Individual Medley',
    events: [
      { label: '100', raceLabel: '100 IM', stroke: 'im', distance: '100' },
      { label: '200', raceLabel: '200 IM', stroke: 'im', distance: '200' },
      { label: '400', raceLabel: '400 IM', stroke: 'im', distance: '400' },
    ],
  },
];

export default function SwimmingSelection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ athlete?: string | string[] }>();
  const athleteParam = Array.isArray(params.athlete) ? params.athlete[0] : params.athlete;
  const athlete = (athleteParam ?? 'Unassigned').trim() || 'Unassigned';

  const go = (event: SwimEvent) => {
    const swimRace = JSON.stringify({
      raceLabel: event.raceLabel,
      stroke: event.stroke,
      distance: event.distance,
    });

    router.push({
      pathname: '/record/camera',
      params: {
        athlete,
        sport: 'swimming',
        style: 'race',

        // normal params
        stroke: event.stroke,
        distance: event.distance,
        raceLabel: event.raceLabel,

        // backup single param in case individual params get dropped
        swimRace,
      },
    });
  };

  const EventButton = ({ event }: { event: SwimEvent }) => (
    <TouchableOpacity
      onPress={() => go(event)}
      activeOpacity={0.85}
      style={{
        minWidth: 76,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(14,165,233,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.65)',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 13 }}>
        {event.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
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

      <ScrollView
        style={{ flex: 1, backgroundColor: 'black' }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
          Choose swimming race
        </Text>

        <Text style={{ color: '#AAA', marginTop: 6, marginBottom: 12, textAlign: 'center' }}>
          Recording — {athlete}
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 18,
            lineHeight: 18,
          }}
        >
          Choose the stroke category, then pick the race distance.
        </Text>

        <View
          style={{
            marginBottom: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(56,189,248,0.35)',
            backgroundColor: 'rgba(14,165,233,0.09)',
            padding: 14,
          }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
            Youth / Beginner
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12, marginTop: 3 }}>
            25 races for younger swimmers and local meets
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {YOUTH_EVENTS.map((event) => (
              <EventButton key={event.raceLabel} event={event} />
            ))}
          </View>
        </View>

        {STANDARD_EVENTS.map((group) => (
          <View
            key={group.title}
            style={{
              marginBottom: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: 14,
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
              {group.title}
            </Text>

            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 }}>
              {group.subtitle}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {group.events.map((event) => (
                <EventButton key={event.raceLabel} event={event} />
              ))}
            </View>
          </View>
        ))}

        <Text
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          Pool course is not required. 400/500, 800/1000, and 1500/1650 cover common meter/yard event variations.
        </Text>
      </ScrollView>
    </>
  );
}