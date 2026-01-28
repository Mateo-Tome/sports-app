import { Text, View } from 'react-native';

export default function GenericStatsCard(props: {
  sportKey: string;
  stats: any;
}) {
  const { sportKey, stats } = props;

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 12,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', marginBottom: 6 }}>
        {sportKey}
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
        {JSON.stringify(stats, null, 2)}
      </Text>
    </View>
  );
}
