// components/library/LibraryDataSourceToggle.tsx
import { Pressable, Text, View } from 'react-native';

export default function LibraryDataSourceToggle({
  dataSource,
  onChange,
  cloudCount,
}: {
  dataSource: 'local' | 'cloud';
  onChange: (v: 'local' | 'cloud') => void;
  cloudCount?: number;
}) {
  const activeIsLocal = dataSource === 'local';

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 10,
        height: 56,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: '#0b0b0b',
        padding: 4,
        overflow: 'hidden',
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', position: 'relative' }}>
        {/* active slider */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: activeIsLocal ? 0 : '50%',
            width: '50%',
            borderRadius: 999,
            backgroundColor: '#dc2626',
          }}
        />

        <Pressable
          onPress={() => onChange('local')}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontSize: 16,
              fontWeight: '900',
              textAlign: 'center',
              includeFontPadding: false,
              lineHeight: 20,
              opacity: activeIsLocal ? 1 : 0.62,
            }}
          >
            Local
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onChange('cloud')}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontSize: 16,
              fontWeight: '900',
              textAlign: 'center',
              includeFontPadding: false,
              lineHeight: 20,
              opacity: activeIsLocal ? 0.62 : 1,
            }}
          >
            Cloud{typeof cloudCount === 'number' ? ` (${cloudCount})` : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}