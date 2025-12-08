// components/library/EditAthleteModal.tsx

import { useEffect, useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { LibraryRow } from './LibraryVideoRow';

type Athlete = { id: string; name: string; photoUri?: string | null };

type EditAthleteModalProps = {
  visible: boolean;
  row: LibraryRow | null;
  athleteList: Athlete[];
  onClose: () => void;
  onSelectExisting: (athleteName: string) => void;
  onSubmitNewAthlete: (newName: string) => void;
};

export default function EditAthleteModal({
  visible,
  row,
  athleteList,
  onClose,
  onSelectExisting,
  onSubmitNewAthlete,
}: EditAthleteModalProps) {
  const [localName, setLocalName] = useState('');

  useEffect(() => {
    // reset input whenever we open or change row
    if (visible) {
      setLocalName('');
    }
  }, [visible, row]);

  const handlePressExisting = (name: string) => {
    onSelectExisting(name);
  };

  const handleAddAndApply = () => {
    onSubmitNewAthlete(localName);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 480,
            borderRadius: 16,
            padding: 16,
            backgroundColor: '#121212',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Text
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 18,
              marginBottom: 4,
              textAlign: 'center',
            }}
          >
            Change Athlete
          </Text>

          {row && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Current:{' '}
              <Text style={{ fontWeight: '800', color: '#F97316' }}>
                {row.athlete || 'Unassigned'}
              </Text>
            </Text>
          )}

          {/* Pick existing athlete */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 13,
              marginTop: 4,
              marginBottom: 4,
            }}
          >
            Pick an athlete
          </Text>

          <ScrollView
            style={{ maxHeight: 260, marginBottom: 8 }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {/* Unassigned */}
            <Pressable
              onPress={() => handlePressExisting('Unassigned')}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.08)',
                marginBottom: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ color: 'white', fontSize: 16, fontWeight: '800' }}
                >
                  –
                </Text>
              </View>
              <Text
                style={{
                  color: 'white',
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                Unassigned
              </Text>
            </Pressable>

            {athleteList.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => handlePressExisting(a.name)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  marginBottom: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {a.photoUri ? (
                  <Image
                    source={{ uri: a.photoUri }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 16,
                        fontWeight: '700',
                      }}
                    >
                      {a.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <Text
                  style={{
                    color: 'white',
                    fontWeight: '700',
                    fontSize: 14,
                    flexShrink: 1,
                  }}
                >
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View
            style={{
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.12)',
              marginVertical: 8,
            }}
          />

          {/* New athlete entry */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            Or add a new athlete
          </Text>

          <TextInput
            value={localName}
            onChangeText={setLocalName}
            placeholder="Type athlete name"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              paddingHorizontal: 10,
              paddingVertical: 8,
              color: 'white',
              marginBottom: 10,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
            returnKeyType="done"
            onSubmitEditing={handleAddAndApply}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 4,
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleAddAndApply}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: 'white',
              }}
            >
              <Text
                style={{
                  color: 'black',
                  fontWeight: '800',
                  fontSize: 13,
                }}
              >
                Add & Apply
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
