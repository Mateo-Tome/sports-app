import type React from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import type { Insets, OverlayMode } from './PlaybackChrome';

const SAFE_MARGIN = 12;
const MENU_W = 260;

function MenuText({ children, style, min = 0.8 }: { children: React.ReactNode; style?: any; min?: number }) {
  return (
    <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={min} style={style}>
      {children}
    </Text>
  );
}

function MenuButton({ children, onPress, active }: { children: React.ReactNode; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        justifyContent: 'center',
        backgroundColor: active ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)',
        borderWidth: active ? 1 : 0,
        borderColor: active ? 'rgba(96,165,250,0.8)' : 'transparent',
      }}
    >
      <MenuText style={{ color: '#fff', fontWeight: '900', fontSize: 13, textAlign: 'center' }}>
        {children}
      </MenuText>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <MenuText
      min={0.85}
      style={{
        color: 'rgba(255,255,255,0.62)',
        fontWeight: '800',
        fontSize: 11,
        letterSpacing: 0.6,
        marginBottom: 6,
        paddingHorizontal: 6,
      }}
    >
      {children}
    </MenuText>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 8 }} />;
}

export function OverlayModeMenu(props: {
  visible: boolean;
  mode: OverlayMode;
  onSelect: (m: OverlayMode) => void;
  onClose: () => void;
  insets: Insets;
  canEditOrientation?: boolean;
  rotationLabel?: string;
  orientationDirty?: boolean;
  orientationSaving?: boolean;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onResetOrientation?: () => void;
  onRevertOrientation?: () => void;
  onSaveOrientation?: () => void;
  extraContent?: React.ReactNode;
}) {
  const {
    visible,
    mode,
    onSelect,
    onClose,
    insets,
    canEditOrientation = false,
    rotationLabel = '0°',
    orientationDirty = false,
    orientationSaving = false,
    onRotateLeft,
    onRotateRight,
    onResetOrientation,
    onRevertOrientation,
    onSaveOrientation,
    extraContent,
  } = props;

  const { height: screenH } = useWindowDimensions();

  const menuTop = insets.top + SAFE_MARGIN + 36;
  const menuMaxH = Math.max(220, screenH - menuTop - insets.bottom - SAFE_MARGIN - 8);

  const options: { key: OverlayMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'noBelt', label: 'Score Only' },
    { key: 'noScore', label: 'Belt Only' },
    { key: 'off', label: 'Overlay Off' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            position: 'absolute',
            top: menuTop,
            right: insets.right + SAFE_MARGIN,
            width: MENU_W,
            maxHeight: menuMaxH,
            borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.94)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.25)',
            overflow: 'hidden',
          }}
        >
          <ScrollView
            style={{ maxHeight: menuMaxH }}
            contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 8, paddingBottom: 18 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            bounces
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MenuText style={{ color: '#fff', fontWeight: '900', fontSize: 13, flex: 1, paddingHorizontal: 6 }}>
                Playback Settings
              </MenuText>

              <Pressable
                onPress={onClose}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <MenuText style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Close</MenuText>
              </Pressable>
            </View>

            <SectionLabel>DISPLAY</SectionLabel>

            <View style={{ gap: 2 }}>
              {options.map((opt) => (
                <MenuButton key={opt.key} active={opt.key === mode} onPress={() => onSelect(opt.key)}>
                  {opt.label}
                </MenuButton>
              ))}
            </View>

            <Divider />

            {extraContent ? <View>{extraContent}</View> : null}

            {canEditOrientation ? (
              <>
                <Divider />
                <SectionLabel>ORIENTATION</SectionLabel>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 6, gap: 8 }}>
                  <MenuText style={{ color: '#fff', fontWeight: '800', fontSize: 13, flex: 1 }}>Current</MenuText>
                  <MenuText style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{rotationLabel}</MenuText>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                  <View style={{ flex: 1 }}>
                    <MenuButton onPress={onRotateLeft}>↺ Left</MenuButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <MenuButton onPress={onRotateRight}>Right ↻</MenuButton>
                  </View>
                </View>

                <View style={{ marginBottom: orientationDirty ? 6 : 0 }}>
                  <MenuButton onPress={onResetOrientation}>Reset to 0°</MenuButton>
                </View>

                {orientationDirty ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <MenuButton onPress={onRevertOrientation}>Cancel</MenuButton>
                    </View>
                    <View style={{ flex: 1 }}>
                      <MenuButton onPress={onSaveOrientation}>
                        {orientationSaving ? 'Saving…' : 'Save'}
                      </MenuButton>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}