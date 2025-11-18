// components/modules/wrestling/WrestlingFolkstyleLibraryCard.tsx

import React from 'react';
import { Text, View } from 'react-native';

// These types are kept local so we don't create an import cycle with library.tsx.
type Outcome = 'W' | 'L' | 'T';

type SportChip = { text: string; color: string };

type SportStyleDecision = {
  edgeColor?: string | null;
  highlightGold?: boolean;
};

type RowLike = {
  displayName: string;
  sport: string;
  athlete?: string;
  size?: number | null;
  outcome?: Outcome | null;
  myScore?: number | null;
  oppScore?: number | null;
  highlightGold?: boolean;
  edgeColor?: string | null;
};

export type WrestlingFolkstyleCardProps = {
  row: RowLike;
  subtitle: string;
  chip?: SportChip | null;
  // IMPORTANT: make this optional so callers that don't pass it don't crash
  styleDecision?: SportStyleDecision;
};

export const WrestlingFolkstyleLibraryCard: React.FC<
  WrestlingFolkstyleCardProps
> = ({
  row,
  subtitle,
  chip,
  // default to empty object so we never get undefined at runtime
  styleDecision = {},
}) => {
  // Prefer the styleDecision coming from sidecar logic, fall back to row.highlightGold
  const showGold =
    (styleDecision?.highlightGold ?? row.highlightGold) ?? false;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Title */}
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

        {/* W / L / T + score chip coming from Library */}
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

        {/* PIN tag for folkstyle pin wins */}
        {showGold && (
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
            <Text style={{ color: 'white', fontWeight: '900' }}>PIN</Text>
          </View>
        )}
      </View>

      {/* Subtitle from Library (athlete • sport • file size) */}
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

/**
 * Module wrapper used by app/(tabs)/library.tsx via getSportCardModule.
 * It feeds a Card + decideStyles(row) into the Library renderer.
 */
export const WrestlingFolkstyleModule = {
  Card: WrestlingFolkstyleLibraryCard,
  decideStyles: (row: RowLike): SportStyleDecision => {
    return {
      // Use whatever the sidecar logic already computed on the row.
      edgeColor: row.edgeColor ?? null,
      highlightGold: row.highlightGold ?? false,
    };
  },
};
