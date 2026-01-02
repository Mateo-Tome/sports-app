// components/library/LibraryVideoRow.tsx
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import UploadButton from './UploadButton';

// ✅ IMPORTANT: use your real domain types (FinalScore, Outcome)
import type { FinalScore, Outcome } from '../../lib/library/sidecars';

export type LibraryRow = {
  uri: string;
  displayName: string;
  athlete: string;
  sport: string;

  assetId?: string | undefined; // ✅ (no null)
  size?: number | null;
  mtime?: number | null;
  thumbUri?: string | null;

  finalScore?: FinalScore | null;
  homeIsAthlete?: boolean | null;
  outcome?: Outcome | undefined;
  myScore?: number | null;
  oppScore?: number | null;
  highlightGold?: boolean | null;
  edgeColor?: string | null;
};

type Props = {
  row: LibraryRow;
  uploaded: boolean;

  onPressPlay: () => void;
  onPressDelete: () => void;
  onPressEditAthlete: () => void;
  onPressEditTitle: () => void;
  onPressSaveToPhotos: () => void;

  onUploaded: (storageKey: string, url: string) => void;
};

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
  const mapKey = row.assetId ?? row.uri;

  return (
    <View style={styles.card}>
      <Pressable onPress={onPressPlay} style={styles.left}>
        {row.thumbUri ? (
          <Image source={{ uri: row.thumbUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {row.displayName}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {row.athlete} • {row.sport}
          </Text>
          {uploaded ? <Text style={styles.badge}>Uploaded</Text> : null}
        </View>
      </Pressable>

      <View style={styles.right}>
        <UploadButton row={row} mapKey={mapKey} onUploaded={onUploaded} />

        <View style={{ height: 8 }} />

        <Pressable onPress={onPressEditTitle} style={styles.smallBtn}>
          <Text style={styles.smallTxt}>Title</Text>
        </Pressable>

        <Pressable onPress={onPressEditAthlete} style={styles.smallBtn}>
          <Text style={styles.smallTxt}>Athlete</Text>
        </Pressable>

        <Pressable onPress={onPressSaveToPhotos} style={styles.smallBtn}>
          <Text style={styles.smallTxt}>Save</Text>
        </Pressable>

        <Pressable onPress={onPressDelete} style={[styles.smallBtn, styles.danger]}>
          <Text style={styles.smallTxt}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const LibraryVideoRow = memo(LibraryVideoRowComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 14,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  left: { flex: 1, flexDirection: 'row', gap: 10 },
  thumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#222' },
  thumbEmpty: { opacity: 0.5 },
  meta: { flex: 1, justifyContent: 'center' },
  title: { color: 'white', fontSize: 15, fontWeight: '700' },
  sub: { color: '#bbb', fontSize: 12, marginTop: 2 },
  badge: { color: '#7CFF7C', fontSize: 12, marginTop: 6, fontWeight: '700' },
  right: { width: 110, alignItems: 'stretch' },
  smallBtn: {
    backgroundColor: '#222',
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  danger: { backgroundColor: '#3a1414' },
  smallTxt: { color: 'white', fontSize: 12, fontWeight: '700' },
});
