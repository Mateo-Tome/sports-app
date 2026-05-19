import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveImportedVideo } from '../../lib/imports/saveImportedVideo';
import { SPORT_CONFIGS, type SportMode } from '../../lib/sports/sportModes';

function paramToStr(v: unknown, fallback = '') {
  return Array.isArray(v) ? String(v[0] ?? fallback) : v == null ? fallback : String(v);
}

export default function ImportVideoSetupScreen() {
  const params = useLocalSearchParams();

  const videoUri = useMemo(() => paramToStr(params.videoUri), [params.videoUri]);
  const fileName = useMemo(() => paramToStr(params.fileName, 'Imported video'), [params.fileName]);
  const athlete = useMemo(() => paramToStr(params.athlete, 'Unassigned'), [params.athlete]);

  const [selectedSportKey, setSelectedSportKey] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<SportMode | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedSport = SPORT_CONFIGS.find((s) => s.key === selectedSportKey);
  const sportNeedsMode = !!selectedSport?.modes?.length;

  const chooseSport = (sportKey: string) => {
    setSelectedSportKey(sportKey);
    setSelectedMode(null);

    const sport = SPORT_CONFIGS.find((s) => s.key === sportKey);

    if (sport && !sport.modes?.length) {
      setSelectedMode({
        sport: sport.key,
        style: 'default',
        title: sport.label,
      });
    }
  };

  const saveImport = async () => {
    if (saving) return;

    if (!videoUri) {
      Alert.alert('Missing video', 'No video was selected.');
      return;
    }

    if (!selectedSport) {
      Alert.alert('Choose a sport', 'Select what sport this video belongs to.');
      return;
    }

    if (sportNeedsMode && !selectedMode) {
      Alert.alert('Choose a mode', `Select the ${selectedSport.label} mode for this video.`);
      return;
    }

    const sportKey = selectedMode?.sport ?? selectedSport.key;
    const styleKey = selectedMode?.style ?? 'default';

    try {
      setSaving(true);

      const saved = await saveImportedVideo({
        sourceUri: videoUri,
        athlete,
        sport: sportKey,
        style: styleKey,
        fileName,
      });

      Alert.alert('Imported', 'Video saved to QuickClip.', [
        {
          text: 'Review & Tag',
          onPress: () => {
            router.replace({
              pathname: '/screens/PlaybackScreen',
              params: {
                uri: saved.appUri,
                athlete,
                sport: sportKey,
                style: styleKey,
              },
            });
          },
        },
        {
          text: 'Done',
          onPress: () => router.replace('/(tabs)/library'),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '900' }}>
          Add Existing Video
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 13 }}>
          Tell QuickClip what this video is so it can appear correctly in your library, playback, and stats.
        </Text>

        <View
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800' }}>
            ATHLETE
          </Text>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginTop: 4 }}>
            {athlete}
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 12 }} numberOfLines={1}>
            {fileName}
          </Text>
        </View>

        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 12 }}>
          Choose sport
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {SPORT_CONFIGS.map((sport) => {
            const active = selectedSportKey === sport.key;

            return (
              <TouchableOpacity
                key={sport.key}
                onPress={() => chooseSport(sport.key)}
                activeOpacity={0.85}
                style={{
                  width: '49%',
                  paddingVertical: 24,
                  marginBottom: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? '#DC2626' : 'white',
                }}
              >
                <Text style={{ color: active ? 'white' : 'black', fontSize: 18, fontWeight: '900' }}>
                  {sport.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedSport?.modes?.length ? (
          <>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginTop: 10, marginBottom: 12 }}>
              Choose {selectedSport.label} mode
            </Text>

            {selectedSport.modes.map((mode) => {
              const active = selectedMode?.sport === mode.sport && selectedMode?.style === mode.style;

              return (
                <TouchableOpacity
                  key={`${mode.sport}:${mode.style}`}
                  onPress={() => setSelectedMode(mode)}
                  activeOpacity={0.85}
                  style={{
                    width: '100%',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    marginBottom: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: active ? '#DC2626' : 'rgba(255,255,255,0.15)',
                    backgroundColor: active ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
                    {mode.title}
                  </Text>

                  {mode.subtitle ? (
                    <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 3, fontSize: 12 }}>
                      {mode.subtitle}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        <TouchableOpacity
          onPress={saveImport}
          disabled={saving}
          activeOpacity={0.9}
          style={{
            marginTop: 10,
            width: '100%',
            paddingVertical: 18,
            borderRadius: 12,
            backgroundColor: selectedMode && !saving ? '#DC2626' : 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
            {saving ? 'Saving…' : 'Save to QuickClip'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={saving}
          style={{ marginTop: 14, alignItems: 'center', paddingVertical: 12 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '800' }}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}