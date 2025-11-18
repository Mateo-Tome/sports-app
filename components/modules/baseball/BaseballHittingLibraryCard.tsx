// components/modules/baseball/BaseballHittingLibraryCard.tsx

import React from 'react';
import { Text, View } from 'react-native';

type Outcome = 'W' | 'L' | 'T';

type SportChip = { text: string; color: string };

type RowLike = {
  displayName: string;
  sport: string;
  athlete?: string;
  size?: number | null;
  outcome?: Outcome | null;
  myScore?: number | null;
  oppScore?: number | null;
  highlightGold?: boolean;
};

export type BaseballHittingLibraryCardProps = {
  row: RowLike;
  subtitle: string;
  chip?: SportChip | null;
};

export const BaseballHittingLibraryCard: React.FC<
  BaseballHittingLibraryCardProps
> = ({ row, subtitle, chip }) => {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text
          style={{
            color: 'white',
            fontWeight: '700',
            flexShrink: 1,
          }}
          numberOfLines={2}
        >
          {row.displayName}
        </Text>

        {chip && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: `${chip.color}22`,
              borderWidth: 1,
              borderColor: `${chip.color}66`,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              {chip.text}
            </Text>
          </View>
        )}

        {row.highlightGold && (
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
            <Text style={{ color: 'white', fontWeight: '900' }}>
              PIN / HR / SUB
            </Text>
          </View>
        )}
      </View>

      <Text
        style={{
          color: 'white',
          opacity: 0.85,
          marginTop: 4,
        }}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </View>
  );
};
