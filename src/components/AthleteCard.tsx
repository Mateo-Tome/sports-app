import { useEffect, useMemo, useRef, useState } from 'react';
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

import * as FileSystem from 'expo-file-system';
import { getAuth } from 'firebase/auth';

// IMPORTANT: adjust this relative import if your AthleteCard is in a different folder.
// This should point to your existing ensureAnonymous() helper.
import { ensureAnonymous } from '../../lib/firebase';

import type { Athlete } from '../lib/athleteTypes';
export type { Athlete };

const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

function mustBaseUrl() {
  if (!FUNCTIONS_BASE_URL) throw new Error('Missing EXPO_PUBLIC_FUNCTIONS_BASE_URL');
  return FUNCTIONS_BASE_URL.replace(/\/+$/, '');
}

type Props = {
  a: Athlete;
  isWide: boolean;

  onRecord: (athleteName: string) => void;
  onStats: (athleteName: string) => void;

  onSetPhoto: (athleteId: string) => void;
  onRename: (athleteId: string, newName: string) => void;
  onDelete: (athleteId: string) => void;
};

function safeStr(v: any): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

function safeNum(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cachePathForAthlete(athleteId: string, photoUpdatedAt?: number | null) {
  const ver = safeNum(photoUpdatedAt) ?? 0;
  // ✅ stable file path per athlete + version
  return `${FileSystem.documentDirectory}athlete_photos/${athleteId}/profile_${ver || 'v0'}.jpg`;
}

async function ensureDir(dirUri: string) {
  try {
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
  } catch {
    // ignore
  }
}

async function fileInfo(uri: string) {
  try {
    return await FileSystem.getInfoAsync(uri);
  } catch {
    return { exists: false } as any;
  }
}

async function getSignedPhotoUrl(photoKey: string): Promise<{ photoUrl: string; expiresInSec?: number } | null> {
  // ✅ guarantee auth user exists (anon ok)
  await ensureAnonymous();

  const user = getAuth().currentUser;
  const idToken = user ? await user.getIdToken() : null;
  if (!idToken) return null;

  const base = mustBaseUrl();
  const url = `${base}/getAthletePhotoViewUrl?path=${encodeURIComponent(photoKey)}`;

  const r = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) return null;

  const photoUrl = safeStr(j?.photoUrl);
  if (!photoUrl) return null;

  return { photoUrl, expiresInSec: typeof j?.expiresInSec === 'number' ? j.expiresInSec : undefined };
}

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

  // ✅ we resolve remote signed URL into a permanent cached local file
  const [resolvedRemoteUrl, setResolvedRemoteUrl] = useState<string | null>(null);
  const [cachedLocalUri, setCachedLocalUri] = useState<string | null>(null);

  // avoids race conditions when scrolling list fast
  const reqIdRef = useRef(0);

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

  const photoLocalUri = safeStr((a as any).photoLocalUri);
  const photoKey = safeStr((a as any).photoKey);
  const photoUpdatedAt = safeNum((a as any).photoUpdatedAt);

  // legacy values kept but NOT trusted (can 401)
  const photoUrlLegacy = safeStr((a as any).photoUrl);
  const photoUriLegacy = safeStr((a as any).photoUri);

  /**
   * ✅ Display priority:
   * 1) device-local
   * 2) cached local from signed url
   * 3) signed remote url
   * 4) legacy (may 401)
   */
  const displayUri =
    photoLocalUri ||
    cachedLocalUri ||
    resolvedRemoteUrl ||
    photoUrlLegacy ||
    photoUriLegacy ||
    null;

  // ✅ When athlete has photoKey but no local file, fetch signed url and cache it locally
  useEffect(() => {
    let cancelled = false;
    const myReq = ++reqIdRef.current;

    async function run() {
      // If we have a local photo, we don't need cache/remote.
      if (photoLocalUri) {
        setResolvedRemoteUrl(null);
        setCachedLocalUri(null);
        return;
      }

      // cross-device requires photoKey
      if (!photoKey) return;

      const cacheUri = cachePathForAthlete(a.id, photoUpdatedAt);
      const cacheDir = cacheUri.replace(/[^/]+$/, '');

      // If cache already exists (and is non-trivial), use it.
      const pre = await fileInfo(cacheUri);
      if (pre?.exists && typeof pre.size === 'number' && pre.size > 2000) {
        if (!cancelled && reqIdRef.current === myReq) setCachedLocalUri(cacheUri);
        return;
      }

      // Get signed URL
      const signed = await getSignedPhotoUrl(photoKey);
      if (!signed?.photoUrl) return;

      if (cancelled || reqIdRef.current !== myReq) return;
      setResolvedRemoteUrl(signed.photoUrl);

      // Cache permanently on this device
      try {
        await ensureDir(cacheDir);

        await FileSystem.downloadAsync(signed.photoUrl, cacheUri);

        const post = await fileInfo(cacheUri);
        // Basic sanity check: image should be > ~2KB
        if (post?.exists && typeof post.size === 'number' && post.size > 2000) {
          if (!cancelled && reqIdRef.current === myReq) {
            setCachedLocalUri(cacheUri);
          }
        } else {
          // if we cached junk, remove it
          try {
            await FileSystem.deleteAsync(cacheUri, { idempotent: true });
          } catch {}
        }
      } catch (e) {
        console.log('[AthleteCard] cache download failed:', { id: a.id, name: a.name, e });
      }
    }

    run().catch((e) => {
      console.log('[AthleteCard] resolve remote photo failed:', { id: a.id, name: a.name, e });
    });

    return () => {
      cancelled = true;
    };
  }, [a.id, photoKey, photoUpdatedAt, photoLocalUri]);

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
        {displayUri ? (
          <Image
            source={{ uri: displayUri }}
            onError={(e) => {
              const native = (e as any)?.nativeEvent;
              console.log('[AthleteCard] image load failed:', {
                id: a.id,
                name: a.name,
                uri: displayUri,
                nativeEvent: native,
              });

              // If signed url fails (expired), clear it and let effect refetch later
              if (resolvedRemoteUrl && displayUri === resolvedRemoteUrl) {
                setResolvedRemoteUrl(null);
              }

              // If cached local file got deleted or was bad, clear and refetch/cache again
              if (cachedLocalUri && displayUri === cachedLocalUri) {
                setCachedLocalUri(null);
              }
            }}
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
        <ActionBtn label={displayUri ? 'Change Photo' : 'Set Photo'} onPress={() => onSetPhoto(a.id)} />
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
