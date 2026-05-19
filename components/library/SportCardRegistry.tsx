import React from 'react';
import { Text, View } from 'react-native';

import { BaseballHittingLibraryCard } from '../modules/baseball/BaseballHittingLibraryCard';
import { BaseballPitchingLibraryCard } from '../modules/baseball/BaseballPitchingLibraryCard';
import { SwimmingLibraryCard } from '../modules/swimming/SwimmingLibraryCard';
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
    edgeColor?: string | null;
    libraryStyle?: {
      edgeColor?: string | null;
      badgeText?: string | null;
      badgeColor?: string | null;
    } | null;
    hittingLabel?: string | null;
    pitchingLabel?: string | null;
    [k: string]: any;
  };
  subtitle: string;
  chip?: SportChip | null;
};

export const DefaultLibraryCard: React.FC<SportCardProps> = ({ row, subtitle, chip }) => (
  <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ color: 'white', fontWeight: '700', flexShrink: 1 }} numberOfLines={2}>
        {row.displayName}
      </Text>

      {chip ? (
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
          <Text style={{ color: 'white', fontWeight: '900' }}>{chip.text}</Text>
        </View>
      ) : null}
    </View>

    <Text style={{ color: 'white', opacity: 0.85, marginTop: 4 }} numberOfLines={1}>
      {subtitle}
    </Text>
  </View>
);

export function getSportCardComponent(row: SportCardProps['row']): React.ComponentType<SportCardProps> {
  const s = String(row.sport || '').toLowerCase();

  if (s.startsWith('swimming')) return SwimmingLibraryCard as any;

  if (s.includes('baseball') && s.includes('pitching')) return BaseballPitchingLibraryCard as any;
  if (s.includes('baseball') && s.includes('hitting')) return BaseballHittingLibraryCard as any;

  if (s.includes('softball') && s.includes('pitching')) return BaseballPitchingLibraryCard as any;
  if (s.includes('softball') && s.includes('hitting')) return BaseballHittingLibraryCard as any;

  if (s.startsWith('wrestling')) return WrestlingFolkstyleLibraryCard as any;

  return DefaultLibraryCard;
}