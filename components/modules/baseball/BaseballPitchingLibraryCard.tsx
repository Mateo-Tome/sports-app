import React from 'react';
import { Text, View } from 'react-native';

type RowLike = {
  displayName: string;
  sport: string;
  athlete?: string;
  size?: number | null;
  highlightGold?: boolean | null;

  edgeColor?: string | null;
  pitchingLabel?: string | null; // e.g. "K", "BB", "1B", "HR", "GO"
};

export type BaseballPitchingLibraryCardProps = {
  row: RowLike;
  subtitle: string;
  chip?: any;
};

export const BaseballPitchingLibraryCard: React.FC<BaseballPitchingLibraryCardProps> = ({
  row,
  subtitle,
}) => {
  const label = (row.pitchingLabel ?? '').trim() || 'Pitching';

  const pillBorderColor = (row.edgeColor ?? '').trim() || 'rgba(245,158,11,0.65)';
  const pillBgColor = (row.edgeColor ?? '').trim()
    ? 'rgba(0,0,0,0.55)'
    : 'rgba(245,158,11,0.18)';

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{ color: 'white', fontWeight: '700', flexShrink: 1 }}
          numberOfLines={2}
        >
          {row.displayName}
        </Text>

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: pillBgColor,
            borderWidth: 1,
            borderColor: pillBorderColor,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>{label}</Text>
        </View>

        {!!row.highlightGold && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: '#00000033',
              borderWidth: 1,
              borderColor: '#ffffff55',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>HR</Text>
          </View>
        )}
      </View>

      <Text
        style={{ color: 'white', opacity: 0.85, marginTop: 4 }}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </View>
  );
};

export default BaseballPitchingLibraryCard;