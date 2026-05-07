// components/playback/PlaybackSpeedControl.tsx
import { Pressable, Text, View } from 'react-native';

export type PlaybackRate = 0.25 | 0.5 | 1;

export default function PlaybackSpeedControl({
  value,
  onChange,
}: {
  value: PlaybackRate;
  onChange: (v: PlaybackRate) => void;
}) {
    
  const speeds: PlaybackRate[] = [0.25, 0.5, 1];

  return (
    <View style={{ marginTop: 10 }}>
      <Text
        allowFontScaling={false}
        style={{
          color: 'rgba(255,255,255,0.62)',
          fontWeight: '800',
          fontSize: 11,
          letterSpacing: 0.6,
          marginBottom: 6,
          paddingHorizontal: 6,
        }}
      >
        SPEED
      </Text>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {speeds.map((s) => {
          const active = value === s;

          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: active ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.18)',
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  color: '#fff',
                  fontWeight: '900',
                  fontSize: 13,
                }}
              >
                {s}x
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}