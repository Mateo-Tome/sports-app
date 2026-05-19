import * as ImagePicker from 'expo-image-picker';

export type PickedImportVideo = {
  uri: string;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;
};

export default async function pickVideoFromPhotos(): Promise<PickedImportVideo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Photos permission is required to import a video.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    duration: asset.duration ?? null,
  };
}