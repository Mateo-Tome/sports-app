import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { getSportCardComponent } from './SportCardRegistry';
import { UploadButton } from './UploadButton';

type FinalScore = { home: number; opponent: number };
type Outcome = 'W' | 'L' | 'T';

export type LibraryRow = {
  uri: string;
  displayName: string;
  athlete: string;
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

  // Optional cloud-ish fields (safe to ignore if missing)
  shareId?: string | null;
  storageKey?: string | null;
};

type Props = {
  row: LibraryRow;
  uploaded: boolean;
  onPressPlay: () => void;
  onPressDelete: () => void;
  onPressEditAthlete: () => void;
  onPressEditTitle: () => void;
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

  const month = d.toLocaleString(undefined, { month: 'short' }); // Jan
  const day = d.getDate(); // 11
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); // 5:52 PM
  return `${month} ${day} at ${time}`;
}

function clean(str?: string | null) {
  const s = (str ?? '').trim();
  return s.length ? s : '';
}

function formatRowTitle(row: LibraryRow) {
  const athlete = clean(row.athlete) || 'Unassigned';
  const sport = clean(row.sport) || 'unknown';
  const name = clean(row.displayName) || 'clip';
  const when = formatWhen(row.mtime);

  // If your displayName is already a good “event name”, keep it.
  // This yields: "Anakin • wrestling • Jan 11 at 5:52 PM"
  // And a secondary smaller line can show name if needed.
  return {
    primary: `${athlete} • ${sport} • ${when}`,
    secondary: name,
  };
}

// ----- SportCard types + default fallback -----
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

// ----- Main row component -----
function LibraryVideoRowComponent({
  row,
  uploaded,
  onPressPlay,
  onPressDelete,
  onPressEditAthlete,
  onPressEditTitle,
  onPressSaveToPhotos,
  onUploaded,
}: Props) {
  const subtitleBits = [
    // Clean meta line (no emojis)
    clean(row.athlete) ? `Athlete: ${clean(row.athlete)}` : null,
    clean(row.sport) ? `Sport: ${clean(row.sport)}` : null,
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
    (row.edgeColor?.trim() ? row.edgeColor : null) ??
    outcomeColor(row.outcome ?? null);

  const SportCard = getSportCardComponent(safeRow as any);
  const SportCardComponent = (SportCard ?? DefaultSportCard) as any;

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
        backgroundColor: row.highlightGold
          ? 'transparent'
          : 'rgba(255,255,255,0.06)',
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
        {/* Header row: Edit Title */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginBottom: 8,
          }}
        >
          <TouchableOpacity
            onPress={(e: any) => {
              e?.stopPropagation?.();
              onPressEditTitle();
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'white',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>Edit Title</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Thumbnail */}
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
            <SportCardComponent row={safeRow} subtitle={subtitle} chip={chip} />

            {/* actions row */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onPressSaveToPhotos();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'white',
                }}
              >
                <Text style={{ color: 'black', fontWeight: '700' }}>Save to Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onPressPlay();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'white',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Play</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onPressDelete();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(220,0,0,0.9)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  onPressEditAthlete();
                }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'white',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Edit Athlete</Text>
              </TouchableOpacity>

              <View style={{ marginTop: 8, alignItems: 'center' }}>
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
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const MemoLibraryVideoRow = memo(LibraryVideoRowComponent);

export const LibraryVideoRow = MemoLibraryVideoRow;
export default MemoLibraryVideoRow;
