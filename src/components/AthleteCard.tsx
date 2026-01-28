// src/components/AthleteCard.tsx

import { useMemo, useState } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Image,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export type Athlete = { id: string; name: string; photoUri?: string | null };

type Props = {
  a: Athlete;
  isWide: boolean;

  onRecord: (athleteName: string) => void;
  onStats: (athleteName: string) => void;

  onSetPhoto: (athleteId: string) => void;
  onRename: (athleteId: string, newName: string) => void;
  onDelete: (athleteId: string) => void;
};

export default function AthleteCard({
  a,
  isWide,
  onRecord,
  onStats,
  onSetPhoto,
  onRename,
  onDelete,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [renameInput, setRenameInput] = useState(a.name);

  const styles = useMemo(() => {
    const base = {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      marginRight: 8,
      marginTop: 8,
      borderWidth: 1 as const,
    };

    return {
      btnPrimary: { ...base, backgroundColor: '#DC2626', borderColor: '#DC2626' },
      btnSecondary: {
        ...base,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderColor: 'rgba(255,255,255,0.35)',
      },
      btnDanger: { ...base, backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.35)' },
      btnStats: {
        ...base,
        backgroundColor: 'rgba(34,211,238,0.14)',
        borderColor: 'rgba(34,211,238,0.55)',
      },
      txtWhite: { color: 'white', fontWeight: '800' as const },
      txtStats: { color: 'rgba(224,251,255,1)', fontWeight: '900' as const },
    };
  }, []);

  const openMore = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          userInterfaceStyle: 'dark',
          title: a.name,
        },
        (idx) => {
          if (idx === 1) onDelete(a.id);
        }
      );
    } else {
      Alert.alert(a.name, undefined, [
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(a.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const ActionBtn = ({
    label,
    onPress,
    kind = 'secondary',
  }: {
    label: string;
    onPress: () => void;
    kind?: 'primary' | 'secondary' | 'danger' | 'stats';
  }) => {
    const style =
      kind === 'primary'
        ? styles.btnPrimary
        : kind === 'danger'
          ? styles.btnDanger
          : kind === 'stats'
            ? styles.btnStats
            : styles.btnSecondary;

    const textStyle = kind === 'stats' ? styles.txtStats : styles.txtWhite;

    return (
      <TouchableOpacity onPress={onPress} style={style}>
        <Text style={textStyle}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        padding: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {a.photoUri ? (
          <Image
            source={{ uri: a.photoUri }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', opacity: 0.7, fontSize: 22 }}>👤</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
            Record or manage athlete
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        <ActionBtn label="Record" kind="primary" onPress={() => onRecord(a.name)} />
        <ActionBtn label="Stats" kind="stats" onPress={() => onStats(a.name)} />
        <ActionBtn
          label={a.photoUri ? 'Change Photo' : 'Set Photo'}
          onPress={() => onSetPhoto(a.id)}
        />
        <ActionBtn label="Rename" onPress={() => setEditOpen(true)} />
        {isWide ? (
          <ActionBtn label="Delete" kind="danger" onPress={() => onDelete(a.id)} />
        ) : (
          <ActionBtn label="More" onPress={openMore} />
        )}
      </View>

      <Modal transparent visible={editOpen} animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              backgroundColor: '#121212',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Rename Athlete</Text>

            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={{
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
                color: 'white',
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await onRename(a.id, renameInput);
                  setEditOpen(false);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: 'white',
                }}
              >
                <Text style={{ color: 'black', fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
