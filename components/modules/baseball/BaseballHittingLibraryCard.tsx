// components/modules/baseball/BaseballHittingLibraryCard.tsx

import React from 'react';
import { Text, View } from 'react-native';

type RowLike = {
  displayName: string;
  sport: string;
  athlete?: string;
  size?: number | null;

  // optional
  highlightGold?: boolean | null;

  // style + label
  edgeColor?: string | null;
  hittingLabel?: string | null; // e.g. "BB", "K", "1B", "HR"
};

export type BaseballHittingLibraryCardProps = {
  row: RowLike;
  subtitle: string;

  // NOTE: we accept chip to match the registry signature,
  // but we intentionally ignore it for baseball (no W/L pill here).
  chip?: any;
};

export const BaseballHittingLibraryCard: React.FC<BaseballHittingLibraryCardProps> = ({
  row,
  subtitle,
}) => {
  const label = (row.hittingLabel ?? '').trim() || 'Hitting';

  const pillBorderColor = (row.edgeColor ?? '').trim() || 'rgba(59,130,246,0.65)';
  const pillBgColor = (row.edgeColor ?? '').trim()
    ? 'rgba(0,0,0,0.55)'
    : 'rgba(59,130,246,0.18)';

  return (
    <View>
      {/* Title row + baseball label pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{ color: 'white', fontWeight: '700', flexShrink: 1 }}
          numberOfLines={2}
        >
          {row.displayName}
        </Text>

        {/* Baseball label pill (K / BB / 1B / HR / etc) */}
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

        {/* Gold HR badge if highlightGold */}
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
