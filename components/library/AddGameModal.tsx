import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export type RecentGameOption = {
  gameId: string;
  gameTitle: string;
  clipCount?: number;
};

type Props = {
  visible: boolean;
  recentGames: RecentGameOption[];
  currentGameTitle?: string | null;
  onClose: () => void;
  onSubmit: (gameTitle: string, existingGameId?: string | null) => void;
};

function clean(v?: string | null) {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

export default function AddGameModal({
  visible,
  recentGames,
  currentGameTitle,
  onClose,
  onSubmit,
}: Props) {
  const [newGameTitle, setNewGameTitle] = useState('');

  useEffect(() => {
    if (visible) setNewGameTitle('');
  }, [visible]);

  const cleanRecentGames = useMemo(() => {
    const seen = new Set<string>();

    return recentGames
      .filter((g) => clean(g.gameId) && clean(g.gameTitle))
      .filter((g) => {
        const key = clean(g.gameId);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }, [recentGames]);

  const handleCreate = () => {
    const title = clean(newGameTitle);
    if (!title) return;
    onSubmit(title, null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.72)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e: any) => e?.stopPropagation?.()}
          style={{
            backgroundColor: '#111',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 18,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>
            Add to Event
          </Text>

          {clean(currentGameTitle) ? (
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
              Current event: {clean(currentGameTitle)}
            </Text>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
              Pick a recent event or create a new one.
            </Text>
          )}

          {cleanRecentGames.length > 0 ? (
            <View style={{ marginTop: 18, gap: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
                Recent Events
              </Text>

              {cleanRecentGames.map((game) => (
                <TouchableOpacity
                  key={game.gameId}
                  onPress={() => onSubmit(game.gameTitle, game.gameId)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.16)',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>
                    {game.gameTitle}
                  </Text>

                  {typeof game.clipCount === 'number' ? (
                    <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                      {game.clipCount} clip{game.clipCount === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
              Create New Event
            </Text>

            <TextInput
              value={newGameTitle}
              onChangeText={setNewGameTitle}
              placeholder="Example: Game vs Tigers, State Tournament, Weekend Meet"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              style={{
                marginTop: 10,
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                fontWeight: '700',
              }}
            />
          </View>

          <View
            style={{
              marginTop: 18,
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreate}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: 'white',
                opacity: clean(newGameTitle) ? 1 : 0.45,
              }}
            >
              <Text style={{ color: 'black', fontWeight: '900' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}