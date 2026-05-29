import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';

import ShareButton from './ShareButton';
import * as SportCardRegistry from './SportCardRegistry';
import { UploadButton } from './UploadButton';

type FinalScore = { home: number; opponent: number };
type Outcome = 'W' | 'L' | 'T';

export type LibraryStyle = {
  edgeColor?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  highlight?: boolean | null;
};

export type LibraryRow = {
  uri: string;
  displayName: string;
  athlete: string;
  athleteId?: string | null;

  gameId?: string | null;
  gameTitle?: string | null;
  sport: string;
  size: number | null;
  mtime: number | null;
  thumbUri?: string | null;
  assetId?: string | undefined;

  finalScore?: FinalScore | null;
  homeIsAthlete?: boolean | null;
  outcome?: Outcome | null | undefined;
  myScore?: number | null;
  oppScore?: number | null;

  highlightGold?: boolean | null;
  edgeColor?: string | null;
  libraryStyle?: LibraryStyle | null;

  videoId?: string;
  shareId?: string | null;
  storageKey?: string | null;
  b2VideoKey?: string | null;
  b2SidecarKey?: string | null;
};

type Props = {
  row: LibraryRow;
  uploaded: boolean;
  onPressPlay: () => void;
  onPressDelete: () => void;
  onPressEditAthlete: () => void;
  onPressEditTitle: () => void;
  onPressAddToGame: () => void;
  onPressSaveToPhotos: () => void;
  onUploaded: (key: string, url: string) => void;
};

const bytesToMB = (b?: number | null) =>
  b == null ? '—' : (b / (1024 * 1024)).toFixed(2) + ' MB';

const outcomeColor = (o?: Outcome | null) =>
  o === 'W'
    ? '#16a34a'
    : o === 'L'
      ? '#dc2626'
      : o === 'T'
        ? '#eab308'
        : 'rgba(255,255,255,0.25)';

function formatWhen(ms?: number | null) {
  if (!ms) return '—';
  const d = new Date(ms);
  const month = d.toLocaleString(undefined, { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${month} ${day} at ${time}`;
}

function clean(str?: string | null) {
  const s = (str ?? '').trim();
  return s.length ? s : '';
}

function formatSportLabel(raw?: string | null) {
  const value = clean(raw).toLowerCase();
  if (!value) return 'Unknown Sport';

  const [sportRaw, styleRaw] = value.split(':');
  const sport = sportRaw || value;
  const style = styleRaw || '';

  const title = (s: string) =>
    s
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  if (sport === 'baseball') {
    if (!style || style === 'default') return 'Baseball';
    if (style === 'hitting') return 'Baseball Hitting';
    if (style === 'pitching') return 'Baseball Pitching';
  }

  if (sport === 'softball') {
    if (!style || style === 'default') return 'Softball';
    if (style === 'hitting') return 'Softball Hitting';
    if (style === 'pitching') return 'Softball Pitching';
  }

  if (sport === 'wrestling') {
    if (!style || style === 'default') return 'Wrestling';
    if (style === 'folkstyle') return 'Folkstyle Wrestling';
    if (style === 'freestyle') return 'Freestyle Wrestling';
    if (style === 'greco' || style === 'greco-roman' || style === 'greco roman') {
      return 'Greco-Roman Wrestling';
    }
  }

  if (sport === 'bjj') {
    if (!style || style === 'default') return 'BJJ';
    if (style === 'gi') return 'BJJ Gi';
    if (style === 'nogi' || style === 'no-gi' || style === 'no gi') return 'BJJ No-Gi';
  }

  if (sport === 'basketball') return 'Basketball';
  if (sport === 'volleyball') return 'Volleyball';

  if (!style || style === 'default') return title(sport);

  return `${title(sport)} ${title(style)}`;
}

function formatRowTitle(row: LibraryRow) {
  const athlete = clean(row.athlete) || 'Unassigned';
  const sport = formatSportLabel(row.sport);
  const name = clean(row.displayName) || 'clip';
  const when = formatWhen(row.mtime);

  return {
    primary: `${athlete} • ${sport}`,
    secondary: `${name} • ${when}`,
  };
}

type Chip = { text: string; color: string };

type SportCardProps = {
  row: {
    displayName: string;
    athlete: string;
    sport: string;
    highlightGold?: boolean;
    outcome?: Outcome | null;
    myScore?: number | null;
    oppScore?: number | null;
    [k: string]: any;
  };
  subtitle: string;
  chip: Chip | null;
};

const DefaultSportCard = ({ row, subtitle, chip }: SportCardProps) => {
  const t = formatRowTitle(row as any);

  return (
    <View>
      <Text style={{ color: 'white', fontWeight: '900' }} numberOfLines={1}>
        {t.primary}
      </Text>

      <Text
        style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6 }}
        numberOfLines={1}
      >
        {t.secondary}
      </Text>

      {!!subtitle && (
        <Text
          style={{ color: 'rgba(255,255,255,0.55)', marginTop: 6 }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}

      {chip && (
        <View
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderWidth: 1,
            borderColor: chip.color,
          }}
        >
          <Text style={{ color: chip.color, fontWeight: '900' }}>{chip.text}</Text>
        </View>
      )}
    </View>
  );
};

function resolveShareId(row: LibraryRow, uploaded: boolean): string {
  const direct = (row.shareId ?? '').trim();
  if (direct) return direct;

  if (uploaded) {
    const uri = String(row.uri ?? '');
    if (uri.startsWith('cloud:')) {
      const sid = uri.replace(/^cloud:/, '').trim();
      if (sid) return sid;
    }
  }

  return '';
}

function UploadedStatus() {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#16a34a', fontWeight: '900', fontSize: 14 }}>✓</Text>
    </View>
  );
}

function LibraryVideoRowComponent({
  row,
  uploaded,
  onPressPlay,
  onPressDelete,
  onPressEditAthlete,
  onPressEditTitle,
  onPressAddToGame,
  onPressSaveToPhotos,
  onUploaded,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const subtitleBits = [
    clean(row.athlete) ? `Athlete: ${clean(row.athlete)}` : null,
    clean(row.sport) ? `Sport: ${formatSportLabel(row.sport)}` : null,
    clean(row.gameTitle) ? `Event: ${clean(row.gameTitle)}` : null,
    `Size: ${bytesToMB(row.size)}`,
  ].filter(Boolean);

  const subtitle = subtitleBits.join(' • ');

  const chip: Chip | null =
    row.sport !== 'highlights' &&
    row.outcome &&
    row.myScore != null &&
    row.oppScore != null
      ? {
          text: `${row.outcome} ${row.myScore}–${row.oppScore}`,
          color: outcomeColor(row.outcome),
        }
      : null;

  const safeRow = {
    ...row,
    highlightGold: row.highlightGold ?? undefined,
    outcome: row.outcome ?? undefined,
  };

  const rowEdgeColor =
    (row.libraryStyle?.edgeColor?.trim() ? row.libraryStyle.edgeColor : null) ??
    (row.edgeColor?.trim() ? row.edgeColor : null) ??
    outcomeColor(row.outcome ?? null);

  const badgeText = row.libraryStyle?.badgeText?.trim() || '';
  const badgeColor =
    row.libraryStyle?.badgeColor?.trim() ||
    row.libraryStyle?.edgeColor?.trim() ||
    'rgba(255,255,255,0.35)';

  const isLongBadge = badgeText.length > 18 || badgeText.includes(' • ');
  const showInlineBadge = badgeText && !isLongBadge;
  const showDetailsButton = badgeText && isLongBadge;

  const SportCard =
    (SportCardRegistry as any).getSportCardComponent?.(safeRow as any) ??
    (SportCardRegistry as any).getSportCard?.(safeRow as any) ??
    (SportCardRegistry as any).getCardComponent?.(safeRow as any) ??
    null;

  const SportCardComponent = (SportCard ?? DefaultSportCard) as any;
  const shareId = resolveShareId(row, uploaded);

  const ActionButton = ({
    label,
    onPress,
    danger,
    light,
  }: {
    label: string;
    onPress: () => void;
    danger?: boolean;
    light?: boolean;
  }) => (
    <TouchableOpacity
      onPress={(e: any) => {
        e?.stopPropagation?.();
        setActionsOpen(false);
        onPress();
      }}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: danger
          ? 'rgba(220,0,0,0.9)'
          : light
            ? 'white'
            : 'rgba(255,255,255,0.12)',
        borderWidth: light || danger ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.45)',
      }}
    >
      <Text
        style={{
          color: light ? 'black' : 'white',
          fontWeight: danger ? '900' : '800',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Pressable
      onPress={onPressPlay}
      style={{
        padding: 0,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: row.highlightGold ? 0 : 2,
        borderColor: row.highlightGold ? 'transparent' : rowEdgeColor,
        backgroundColor: row.highlightGold ? 'transparent' : 'rgba(255,255,255,0.06)',
      }}
    >
      {row.highlightGold && (
        <>
          <LinearGradient
            colors={['#f7d774', '#d4a017', '#b88912']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.08)',
            }}
          />
        </>
      )}

      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {row.thumbUri ? (
            <Image
              key={row.thumbUri || row.uri}
              source={{ uri: row.thumbUri }}
              style={{
                width: 96,
                height: 54,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
              contentFit="cover"
              transition={100}
            />
          ) : (
            <View
              style={{
                width: 96,
                height: 54,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.1)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>
                No preview
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <SportCardComponent row={safeRow} subtitle={subtitle} chip={chip} />
              </View>

              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  setActionsOpen((v) => !v);
                }}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: actionsOpen
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(0,0,0,0.45)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>
                  •••
                </Text>
              </TouchableOpacity>
            </View>

            {(showInlineBadge || showDetailsButton) && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {showInlineBadge ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: 180,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0,0,0,0.45)',
                      borderWidth: 1,
                      borderColor: badgeColor,
                    }}
                  >
                    <Text
                      style={{ color: 'white', fontWeight: '900', fontSize: 12 }}
                      numberOfLines={1}
                    >
                      {badgeText}
                    </Text>
                  </View>
                ) : null}

                {showDetailsButton ? (
                  <TouchableOpacity
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      setDetailsOpen((v) => !v);
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: detailsOpen
                        ? 'rgba(255,255,255,0.18)'
                        : 'rgba(0,0,0,0.45)',
                      borderWidth: 1,
                      borderColor: badgeColor,
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 12 }}>
                      Details
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {showDetailsButton && detailsOpen ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  setDetailsOpen(false);
                }}
                style={{
                  marginTop: 10,
                  alignSelf: 'stretch',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderWidth: 1,
                  borderColor: badgeColor,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '900',
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {badgeText}
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: '700',
                    fontSize: 11,
                    marginTop: 6,
                  }}
                >
                  Tap to close
                </Text>
              </TouchableOpacity>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <ActionButton label="Play" onPress={onPressPlay} />
              </View>

              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onPressAddToGame();
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 22,
                    fontWeight: '900',
                    marginTop: -2,
                  }}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>

            {actionsOpen ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <ActionButton label="Edit Title" onPress={onPressEditTitle} />
                  <ActionButton label="Edit Athlete" onPress={onPressEditAthlete} />
                  <ActionButton label="Save to Photos" onPress={onPressSaveToPhotos} light />
                  <ActionButton label="Delete" onPress={onPressDelete} danger />
                </View>

                <View
                  style={
                    uploaded
                      ? {
                          marginTop: 2,
                          alignItems: 'flex-start',
                        }
                      : {
                          marginTop: 2,
                          width: '100%',
                          alignSelf: 'stretch',
                          alignItems: 'stretch',
                        }
                  }
                >
                  {uploaded ? (
                    shareId ? (
                      <ShareButton shareId={shareId} />
                    ) : (
                      <UploadedStatus />
                    )
                  ) : (
                    <UploadButton
                      localUri={row.uri}
                      uploaded={uploaded}
                      sidecar={{
                        videoPath: row.uri,
                        athlete: row.athlete,
                        sport: row.sport,
                        createdAt: row.mtime ?? Date.now(),
                      }}
                      onUploaded={onUploaded}
                    />
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const MemoLibraryVideoRow = memo(LibraryVideoRowComponent);

export const LibraryVideoRow = MemoLibraryVideoRow;
export default MemoLibraryVideoRow;