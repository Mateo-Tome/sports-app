import {
    Image,
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
  
  export type PickerAthlete = {
    id: string;
    name: string;
    photoUri?: string | null;
    photoLocalUri?: string | null;
    photoUrl?: string | null;
    photoKey?: string | null;
    photoUpdatedAt?: number | null;
    cachedPhotoLocalUri?: string | null;
  };
  
  type Props = {
    visible: boolean;
    athletes: PickerAthlete[];
    selectedAthlete: string;
    newName: string;
    onChangeNewName: (v: string) => void;
    onClose: () => void;
    onSelectAthlete: (name: string) => void;
    onAddAthlete: () => void;
  };
  
  function initials(name: string) {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('') || 'U'
    );
  }
  
  function photoFor(a: PickerAthlete) {
    return (
      a.photoLocalUri ||
      a.cachedPhotoLocalUri ||
      a.photoUri ||
      a.photoUrl ||
      null
    );
  }
  
  export default function AthletePickerOverlay({
    visible,
    athletes,
    selectedAthlete,
    newName,
    onChangeNewName,
    onClose,
    onSelectAthlete,
    onAddAthlete,
  }: Props) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
            }}
          />
  
          <View
            style={{
              marginHorizontal: 14,
              marginBottom: Platform.OS === 'ios' ? 18 : 14,
              borderRadius: 22,
              overflow: 'hidden',
              backgroundColor: '#101010',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.10)',
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 20,
                  fontWeight: '900',
                }}
              >
                Choose Athlete
              </Text>
  
              <Text
                style={{
                  color: 'rgba(255,255,255,0.62)',
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                Pick who this recording belongs to.
              </Text>
            </View>
  
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{
                maxHeight: 330,
              }}
              contentContainerStyle={{
                padding: 12,
              }}
            >
              <Pressable
                onPress={() => onSelectAthlete('Unassigned')}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 8,
                  backgroundColor:
                    selectedAthlete === 'Unassigned'
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(255,255,255,0.07)',
                  borderWidth: 1,
                  borderColor:
                    selectedAthlete === 'Unassigned'
                      ? 'rgba(255,255,255,0.55)'
                      : 'rgba(255,255,255,0.10)',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: '900',
                  }}
                >
                  Unassigned
                </Text>
              </Pressable>
  
              {athletes.map((a) => {
                const photo = photoFor(a);
                const selected = selectedAthlete === a.name;
  
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => onSelectAthlete(a.name)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: selected
                        ? 'rgba(34,211,238,0.18)'
                        : 'rgba(255,255,255,0.07)',
                      borderWidth: 1,
                      borderColor: selected
                        ? 'rgba(34,211,238,0.7)'
                        : 'rgba(255,255,255,0.10)',
                    }}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: photo }}
                        resizeMode="cover"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          marginRight: 10,
                          backgroundColor: 'rgba(255,255,255,0.12)',
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          marginRight: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(255,255,255,0.14)',
                        }}
                      >
                        <Text
                          style={{
                            color: 'white',
                            fontWeight: '900',
                            fontSize: 12,
                          }}
                        >
                          {initials(a.name)}
                        </Text>
                      </View>
                    )}
  
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: 'white',
                        fontWeight: selected ? '900' : '700',
                      }}
                    >
                      {a.name}
                    </Text>
  
                    {selected && (
                      <Text
                        style={{
                          color: 'rgba(224,251,255,1)',
                          fontWeight: '900',
                          fontSize: 12,
                        }}
                      >
                        SELECTED
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
  
            <View
              style={{
                padding: 14,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.10)',
                backgroundColor: '#151515',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '900',
                  marginBottom: 8,
                }}
              >
                Add new athlete
              </Text>
  
              <TextInput
                placeholder="Enter new athlete name"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={newName}
                onChangeText={onChangeNewName}
                blurOnSubmit={false}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={onAddAthlete}
                style={{
                  color: 'white',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.24)',
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontWeight: '800',
                }}
              />
  
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontWeight: '800',
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
  
                <TouchableOpacity
                  onPress={onAddAthlete}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    backgroundColor: 'white',
                  }}
                >
                  <Text
                    style={{
                      color: 'black',
                      fontWeight: '900',
                    }}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }