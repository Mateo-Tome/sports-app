// components/recording/AddExistingVideoButton.tsx
import { Text, TouchableOpacity, View } from 'react-native';

type Props = {
  onPress: () => void;
};

export default function AddExistingVideoButton({ onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        width: '100%',
        paddingVertical: 18,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 18,
            color: 'white',
            fontWeight: '900',
          }}
        >
          Add Existing Video
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.82)',
            marginTop: 3,
            fontWeight: '600',
          }}
        >
          Import a saved clip into QuickClip
        </Text>
      </View>
    </TouchableOpacity>
  );
}