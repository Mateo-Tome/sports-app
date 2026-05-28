import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as FileSystem from 'expo-file-system';
import { getAuth } from 'firebase/auth';

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
  onRecord: (athlete: Athlete) => void;
  onStats: (athlete: Athlete) => void;
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
  return `${FileSystem.documentDirectory}athlete_photos/${athleteId}/profile_${ver || 'v0'}.jpg`;
}

async function ensureDir(dirUri: string) {
  try {
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
  } catch {}
}

async function fileInfo(uri: string) {
  try {
    return await FileSystem.getInfoAsync(uri);
  } catch {
    return { exists: false } as any;
  }
}

async function getSignedPhotoUrl(photoKey: string): Promise<{ photoUrl: string; expiresInSec?: number } | null> {
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

  return {
    photoUrl,
    expiresInSec: typeof j?.expiresInSec === 'number' ? j.expiresInSec : undefined,
  };
}

export default function AthleteCard({
  a,
  onRecord,
  onStats,
  onSetPhoto,
  onRename,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStepTwo, setDeleteStepTwo] = useState(false);
  const [renameInput, setRenameInput] = useState(a.name);
  const [resolvedRemoteUrl, setResolvedRemoteUrl] = useState<string | null>(null);
  const [cachedLocalUri, setCachedLocalUri] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  const photoLocalUri = safeStr((a as any).photoLocalUri);
  const photoKey = safeStr((a as any).photoKey);
  const photoUpdatedAt = safeNum((a as any).photoUpdatedAt);
  const photoUrlLegacy = safeStr((a as any).photoUrl);
  const photoUriLegacy = safeStr((a as any).photoUri);

  const displayUri =
    photoLocalUri ||
    cachedLocalUri ||
    resolvedRemoteUrl ||
    photoUrlLegacy ||
    photoUriLegacy ||
    null;

  const imageVersionKey = `${a.id}:${photoUpdatedAt ?? 0}:${displayUri ?? 'none'}`;

  const initials = useMemo(() => {
    return (
      a.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('') || 'U'
    );
  }, [a.name]);

  useEffect(() => {
    setRenameInput(a.name);
  }, [a.name]);

  useEffect(() => {
    let cancelled = false;
    const myReq = ++reqIdRef.current;

    async function run() {
      if (photoLocalUri) {
        setResolvedRemoteUrl(null);
        setCachedLocalUri(null);
        return;
      }

      setResolvedRemoteUrl(null);
      setCachedLocalUri(null);

      if (!photoKey) return;

      const cacheUri = cachePathForAthlete(a.id, photoUpdatedAt);
      const cacheDir = cacheUri.replace(/[^/]+$/, '');

      const pre = await fileInfo(cacheUri);
      if (pre?.exists && typeof pre.size === 'number' && pre.size > 2000) {
        if (!cancelled && reqIdRef.current === myReq) setCachedLocalUri(cacheUri);
        return;
      }

      const signed = await getSignedPhotoUrl(photoKey);
      if (!signed?.photoUrl) return;

      if (cancelled || reqIdRef.current !== myReq) return;
      setResolvedRemoteUrl(signed.photoUrl);

      try {
        await ensureDir(cacheDir);
        await FileSystem.downloadAsync(signed.photoUrl, cacheUri);

        const post = await fileInfo(cacheUri);
        if (post?.exists && typeof post.size === 'number' && post.size > 2000) {
          if (!cancelled && reqIdRef.current === myReq) setCachedLocalUri(cacheUri);
        } else {
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
  }, [a.id, a.name, photoKey, photoUpdatedAt, photoLocalUri]);

  const closeMenu = () => setMenuOpen(false);

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteStepTwo(false);
  };

  const menuPhotoLabel = displayUri ? 'Change Photo' : 'Set Photo';

  const MenuButton = ({
    title,
    subtitle,
    variant = 'default',
    onPress,
  }: {
    title: string;
    subtitle: string;
    variant?: 'default' | 'photo' | 'rename' | 'danger';
    onPress: () => void;
  }) => {
    const isDanger = variant === 'danger';

    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          paddingVertical: 13,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor:
            variant === 'photo'
              ? 'rgba(34,211,238,0.18)'
              : variant === 'rename'
                ? 'rgba(255,255,255,0.14)'
                : isDanger
                  ? '#DC2626'
                  : 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor:
            variant === 'photo'
              ? 'rgba(34,211,238,0.65)'
              : variant === 'rename'
                ? 'rgba(255,255,255,0.22)'
                : isDanger
                  ? '#DC2626'
                  : 'rgba(255,255,255,0.16)',
          marginTop: 9,
        }}
      >
        <Text style={{ color: 'white', fontSize: 15, fontWeight: '900' }}>{title}</Text>
        <Text
          style={{
            color: isDanger ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.62)',
            fontSize: 12,
            fontWeight: '700',
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        padding: 13,
        marginHorizontal: 16,
        marginVertical: 7,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.055)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {displayUri ? (
          <Image
            key={imageVersionKey}
            source={{ uri: displayUri }}
            resizeMode="cover"
            onError={(e) => {
              const native = (e as any)?.nativeEvent;
              console.log('[AthleteCard] image load failed:', {
                id: a.id,
                name: a.name,
                uri: displayUri,
                nativeEvent: native,
              });

              if (resolvedRemoteUrl && displayUri === resolvedRemoteUrl) setResolvedRemoteUrl(null);
              if (cachedLocalUri && displayUri === cachedLocalUri) setCachedLocalUri(null);
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
            <Text style={{ color: 'white', opacity: 0.82, fontSize: 16, fontWeight: '900' }}>
              {initials}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.54)', fontSize: 12, marginTop: 2 }}>
            Athlete profile
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.09)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Text style={{ color: 'white', fontSize: 23, fontWeight: '900', marginTop: -5 }}>
            ⋯
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => onRecord(a)}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#DC2626',
          }}
        >
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>Record</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onStats(a)}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(34,211,238,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(34,211,238,0.50)',
          }}
        >
          <Text style={{ color: 'rgba(224,251,255,1)', fontSize: 14, fontWeight: '900' }}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={closeMenu}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeMenu}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />

          <View
            style={{
              marginHorizontal: 14,
              marginBottom: 16,
              borderRadius: 22,
              padding: 14,
              backgroundColor: '#101010',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              {displayUri ? (
                <Image
                  source={{ uri: displayUri }}
                  resizeMode="cover"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    marginRight: 10,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    marginRight: 10,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>{initials}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 17, fontWeight: '900' }} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12, marginTop: 2 }}>
                  Manage athlete
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeMenu}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.10)',
                }}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>×</Text>
              </TouchableOpacity>
            </View>

            <MenuButton
              title={menuPhotoLabel}
              subtitle="Update this athlete’s profile picture"
              variant="photo"
              onPress={() => {
                closeMenu();
                onSetPhoto(a.id);
              }}
            />

            <MenuButton
              title="Rename"
              subtitle="Edit the athlete name"
              variant="rename"
              onPress={() => {
                closeMenu();
                setEditOpen(true);
              }}
            />

            <MenuButton
              title="Delete"
              subtitle="Requires two confirmations"
              variant="danger"
              onPress={() => {
                closeMenu();
                setDeleteStepTwo(false);
                setDeleteOpen(true);
              }}
            />

            <TouchableOpacity
              onPress={closeMenu}
              style={{
                marginTop: 11,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={deleteOpen} animationType="fade" onRequestClose={closeDelete}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              backgroundColor: '#121212',
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: deleteStepTwo ? 'rgba(248,113,113,0.65)' : 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: 'white', fontSize: 19, fontWeight: '900' }}>
              {deleteStepTwo ? 'Final confirmation' : 'Delete athlete?'}
            </Text>

            <Text style={{ color: 'rgba(255,255,255,0.70)', marginTop: 8, lineHeight: 20 }}>
              {deleteStepTwo
                ? `This will delete “${a.name}” from your athlete list. Tap Confirm Delete to finish.`
                : `Are you sure you want to delete “${a.name}”? This is meant to prevent accidental taps.`}
            </Text>

            <View style={{ marginTop: 16, gap: 10 }}>
              {!deleteStepTwo ? (
                <TouchableOpacity
                  onPress={() => setDeleteStepTwo(true)}
                  style={{
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: '#DC2626',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>Yes, Continue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    closeDelete();
                    onDelete(a.id);
                  }}
                  style={{
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: '#DC2626',
                    borderWidth: 1,
                    borderColor: 'rgba(248,113,113,0.9)',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>Confirm Delete</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={closeDelete}
                style={{
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.14)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={editOpen} animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              backgroundColor: '#121212',
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>Rename Athlete</Text>

            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCorrect={false}
              style={{
                marginTop: 12,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
                color: 'white',
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => {
                  setRenameInput(a.name);
                  setEditOpen(false);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
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
                <Text style={{ color: 'black', fontWeight: '900' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}