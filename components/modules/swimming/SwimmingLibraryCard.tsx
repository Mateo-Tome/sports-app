import React from 'react';
import { Text, View } from 'react-native';

type RowLike = {
  displayName: string;
  sport: string;
  athlete?: string;
  size?: number | null;

  edgeColor?: string | null;
  libraryStyle?: {
    badgeText?: string | null;
    badgeColor?: string | null;
    edgeColor?: string | null;
  } | null;
};

export type SwimmingLibraryCardProps = {
  row: RowLike;
  subtitle: string;
  chip?: any;
};

export const SwimmingLibraryCard: React.FC<SwimmingLibraryCardProps> = ({
  row,
  subtitle,
}) => {
  const badgeText = row.libraryStyle?.badgeText?.trim() || 'Swimming Race';

  const pillBorderColor =
    row.libraryStyle?.badgeColor?.trim() ||
    row.edgeColor?.trim() ||
    'rgba(14,165,233,0.85)';

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
            backgroundColor: 'rgba(14,165,233,0.18)',
            borderWidth: 1,
            borderColor: pillBorderColor,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>SWIM</Text>
        </View>
      </View>

      <Text
        style={{
          color: 'rgba(125,211,252,0.98)',
          fontWeight: '900',
          marginTop: 5,
        }}
        numberOfLines={1}
      >
        {badgeText}
      </Text>

      <Text
        style={{ color: 'white', opacity: 0.75, marginTop: 4 }}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </View>
  );
};