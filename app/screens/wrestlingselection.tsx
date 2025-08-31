// app/screens/wrestlingselection.tsx
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export default function WrestlingSelection() {
  const router = useRouter();

  const go = (style: 'folkstyle' | 'freestyle' | 'greco') => {
    router.push({ pathname: '/record/camera', params: { sport: 'wrestling', style } });
  };

  const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginTop: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: '#ccc',
        borderRadius: 8,
        backgroundColor: 'white',
      }}
    >
      <Text style={{ fontSize: 18, color: 'red' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'red', fontSize: 24 }}>wrestling styles</Text>

      <Btn label="Folkstyle" onPress={() => go('folkstyle')} />
      <Btn label="Freestyle" onPress={() => go('freestyle')} />
      <Btn label="Greco-Roman" onPress={() => go('greco')} />
    </View>
  );
}

  
