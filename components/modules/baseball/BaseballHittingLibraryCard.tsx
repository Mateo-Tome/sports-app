// components/modules/baseball/BaseballHittingLibraryCard.tsx

import React from 'react';
import { Text, View } from 'react-native';

type SportChip = { text: string; color: string };

type RowLike = {
  displayName: string;
  sport: string;
  athlete?: string;
  size?: number | null;
  highlightGold?: boolean;

  // NEW: extra fields coming from Library
  edgeColor?: string | null;
  hittingLabel?: string | null; // e.g. "BB", "K", "HR", etc.
};

export type BaseballHittingLibraryCardProps = {
  row: RowLike;
  subtitle: string;
  chip?: SportChip | null; // still here if we ever want it, but unused for now
};

export const BaseballHittingLibraryCard: React.FC<
  BaseballHittingLibraryCardProps
> = ({ row, subtitle }) => {
  // Text for the little pill
  const label = row.hittingLabel ?? 'Hitting';

  // Color for the pill: match the edgeColor if we have one (green/red/yellow)
  const pillBorderColor =
    row.edgeColor ?? 'rgba(59, 130, 246, 0.65)'; // fallback blue
  const pillBgColor = row.edgeColor
    ? 'rgba(0, 0, 0, 0.55)'
    : 'rgba(59, 130, 246, 0.18)';

  return (
    <View>
      {/* Top row: title + result pill + optional HR marker */}
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

        {/* Result / count pill: uses hittingLabel + edgeColor */}
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

        {/* Gold HR badge if this clip is marked highlightGold */}
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
            <Text style={{ color: 'white', fontWeight: '900' }}>HR</Text>
          </View>
        )}
      </View>

      {/* Subtitle still comes from Library: "👤 athlete • 🏷️ sport • 123 MB" */}
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
