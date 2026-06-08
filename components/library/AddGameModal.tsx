import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export type RecentGameOption = {
  gameId: string;
  gameTitle: string;
  clipCount?: number;
  latestAt?: number | null;
  updatedAt?: number | null;
  createdAt?: number | null;
};

type Props = {
  visible: boolean;
  recentGames: RecentGameOption[];
  currentGameTitle?: string | null;
  onClose: () => void;
  onSubmit: (gameTitle: string, existingGameId?: string | null) => void;
  onRemoveFromEvent?: () => void;
};

function clean(v?: string | null) {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

function timeForGame(g: RecentGameOption) {
  return Number(g.latestAt ?? g.updatedAt ?? g.createdAt ?? 0) || 0;
}

export default function AddGameModal({
  visible,
  recentGames,
  currentGameTitle,
  onClose,
  onSubmit,
  onRemoveFromEvent,
}: Props) {
  const [newGameTitle, setNewGameTitle] = useState('');
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewGameTitle('');
      setShowAllEvents(false);
    }
  }, [visible]);

  const allRecentGames = useMemo(() => {
    const seen = new Set<string>();

    return [...recentGames]
      .filter((g) => clean(g.gameId) && clean(g.gameTitle))
      .sort((a, b) => timeForGame(b) - timeForGame(a))
      .filter((g) => {
        const key = clean(g.gameId);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [recentGames]);

  const cleanRecentGames = useMemo(() => {
    return showAllEvents ? allRecentGames : allRecentGames.slice(0, 5);
  }, [allRecentGames, showAllEvents]);

  const handleCreate = () => {
    const title = clean(newGameTitle);
    if (!title) return;
    onSubmit(title, null);
  };

  const hasOlderEvents = allRecentGames.length > 5;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={{ flex: 1 }}
      >
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
              paddingBottom: Platform.OS === 'ios' ? 26 : 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              maxHeight: '88%',
            }}
          >
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>
              {clean(currentGameTitle) ? 'Change Event' : 'Add to Event'}
            </Text>

            {clean(currentGameTitle) ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '800' }}>
                  Current Event
                </Text>

                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, marginTop: 4 }}>
                  {clean(currentGameTitle)}
                </Text>
              </View>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                Pick a recent event or create a new one.
              </Text>
            )}

            {cleanRecentGames.length > 0 ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
                  Recent Events
                </Text>

                <ScrollView
                  style={{
                    marginTop: 10,
                    maxHeight: showAllEvents ? 300 : 260,
                  }}
                  contentContainerStyle={{ gap: 10 }}
                  showsVerticalScrollIndicator={showAllEvents}
                  keyboardShouldPersistTaps="handled"
                >
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
                      <Text style={{ color: 'white', fontWeight: '900' }} numberOfLines={1}>
                        {game.gameTitle}
                      </Text>

                      {typeof game.clipCount === 'number' ? (
                        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                          {game.clipCount} clip{game.clipCount === 1 ? '' : 's'}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {hasOlderEvents ? (
                  <TouchableOpacity
                    onPress={() => setShowAllEvents((v) => !v)}
                    style={{
                      alignSelf: 'center',
                      marginTop: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.14)',
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '900' }}>
                      {showAllEvents ? 'Show Less' : 'Show Older Events'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
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
                selectionColor="white"
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
                flexWrap: 'wrap',
              }}
            >
              {clean(currentGameTitle) ? (
                <TouchableOpacity
                  onPress={onRemoveFromEvent}
                  style={{
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    backgroundColor: 'rgba(239,68,68,0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.55)',
                  }}
                >
                  <Text style={{ color: '#fecaca', fontWeight: '900' }}>
                    Remove from Event
                  </Text>
                </TouchableOpacity>
              ) : null}

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
      </KeyboardAvoidingView>
    </Modal>
  );
}