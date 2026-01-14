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
  const pill = (active: boolean) => ({
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'white',
    opacity: active ? 1 : 0.45,
  });

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 }}>
      <Pressable onPress={() => onChange('local')} style={pill(dataSource === 'local')}>
        <Text style={{ color: 'white' }}>Local</Text>
      </Pressable>

      <Pressable onPress={() => onChange('cloud')} style={pill(dataSource === 'cloud')}>
        <Text style={{ color: 'white' }}>
          Cloud{typeof cloudCount === 'number' ? ` (${cloudCount})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}
