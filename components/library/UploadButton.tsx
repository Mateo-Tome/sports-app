// components/library/UploadButton.tsx
import { Pressable, Text } from 'react-native';

// ✅ FIXED PATHS:

type Props = {
  localUri: string;
  uploaded: boolean;
  sidecar: {
    videoPath: string;
    athlete: string;
    sport: string;
    createdAt: number;
  };
  onUploaded: (key: string, url: string) => void;
};

// ✅ IMPORTANT: named export so `import { UploadButton } from './UploadButton'` works
export function UploadButton({ localUri, uploaded, sidecar, onUploaded }: Props) {
  // ------------------------------------------------------------
  // PASTE YOUR EXISTING UPLOAD LOGIC HERE (state, handlers, etc.)
  // ------------------------------------------------------------

  // Minimal UI fallback that compiles
  const disabled = uploaded;

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        // If you already had an upload function, call it here.
        // This is just a placeholder so nothing crashes.
      }}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: disabled ? 'rgba(255,255,255,0.15)' : 'white',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        minWidth: 140,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: disabled ? 'white' : 'black', fontWeight: '900' }}>
        {disabled ? 'Uploaded' : 'Upload'}
      </Text>
    </Pressable>
  );
}

// optional default export (harmless)
export default UploadButton;
