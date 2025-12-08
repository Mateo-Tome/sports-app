// components/library/EditTitleModal.tsx

import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { LibraryRow } from './LibraryVideoRow';

type EditTitleModalProps = {
  visible: boolean;
  row: LibraryRow | null;
  onClose: () => void;
  onSubmit: (newTitle: string) => void | Promise<void>;
};

export default function EditTitleModal({
  visible,
  row,
  onClose,
  onSubmit,
}: EditTitleModalProps) {
  const [localTitle, setLocalTitle] = useState('');

  useEffect(() => {
    if (visible && row) {
      setLocalTitle(row.displayName || '');
    }
    if (!visible) {
      setLocalTitle('');
    }
  }, [visible, row]);

  const handleSave = () => {
    onSubmit(localTitle);
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
            Edit Title
          </Text>

          {row && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 13,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Current:{' '}
              <Text style={{ fontWeight: '800', color: '#F97316' }}>
                {row.displayName}
              </Text>
            </Text>
          )}

          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            New title
          </Text>

          <TextInput
            value={localTitle}
            onChangeText={setLocalTitle}
            placeholder="Type video title"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={{
              marginTop: 4,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
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
              onPress={handleSave}
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
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
