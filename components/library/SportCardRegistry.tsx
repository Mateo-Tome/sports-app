// components/library/SportCardRegistry.tsx
import React from 'react';
import { Text, View } from 'react-native';

// Sport-specific Library cards
import { BaseballHittingLibraryCard } from '../modules/baseball/BaseballHittingLibraryCard';
import { WrestlingFolkstyleLibraryCard } from '../modules/wrestling/WrestlingFolkstyleLibraryCard';

export type SportChip = { text: string; color: string };

export type SportCardProps = {
  row: {
    displayName: string;
    athlete: string;
    sport: string;
    highlightGold?: boolean;
    outcome?: 'W' | 'L' | 'T' | null;
    myScore?: number | null;
    oppScore?: number | null;
  };
  subtitle: string;
  chip?: SportChip | null;
};

// default / generic card (used for highlights or unknown sports)
export const DefaultLibraryCard: React.FC<SportCardProps> = ({
  row,
  subtitle,
  chip,
}) => {
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

export function getSportCardComponent(
  row: SportCardProps['row'],
): React.ComponentType<SportCardProps> {
  const s = (row.sport || '').toLowerCase();

  if (s.includes('baseball') && s.includes('hitting')) {
    return BaseballHittingLibraryCard as React.ComponentType<SportCardProps>;
  }

  if (s.startsWith('wrestling')) {
    return WrestlingFolkstyleLibraryCard as React.ComponentType<SportCardProps>;
  }

  // fallback: generic
  return DefaultLibraryCard;
}
