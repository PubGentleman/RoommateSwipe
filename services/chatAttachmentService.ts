import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const BUCKET = 'chat-attachments';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1024;
const THUMBNAIL_SIZE = 300;

export interface ChatAttachment {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export async function compressImage(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_DIMENSION } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

async function generateThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: THUMBNAIL_SIZE } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function pickImage(): Promise<ImagePicker.ImagePickerResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Photo library permission is required to send images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 0.7,
    exif: false,
  });

  if (result.canceled) return null;
  return result;
}

export async function takePhoto(): Promise<ImagePicker.ImagePickerResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission is required to take photos.');
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    exif: false,
  });

  if (result.canceled) return null;
  return result;
}

export async function pickDocument(): Promise<DocumentPicker.DocumentPickerResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/*',
    ],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;
  return result;
}

export async function uploadChatAttachment(
  userId: string,
  localUri: string,
  filename: string,
  mimeType: string
): Promise<ChatAttachment> {
  const isImage = mimeType.startsWith('image/');

  let uploadUri = localUri;
  let width: number | undefined;
  let height: number | undefined;
  let thumbnailUrl: string | undefined;

  if (isImage) {
    const compressed = await compressImage(localUri);
    uploadUri = compressed.uri;
    width = compressed.width;
    height = compressed.height;
  }

  const fileInfo = await FileSystem.getInfoAsync(uploadUri);
  if (!fileInfo.exists) throw new Error('File not found');

  const sizeBytes = (fileInfo as any).size || 0;
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

  if (sizeBytes > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    throw new Error(`File is too large. Maximum size is ${maxMB}MB.`);
  }

  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${timestamp}-${safeName}`;

  const base64 = await FileSystem.readAsStringAsync(uploadUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes.buffer, {
      contentType: isImage ? 'image/jpeg' : mimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  if (isImage) {
    try {
      const thumbUri = await generateThumbnail(localUri);
      const thumbPath = `thumbnails/${userId}/${timestamp}-thumb_${safeName}`;
      const thumbBase64 = await FileSystem.readAsStringAsync(thumbUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const thumbBinary = atob(thumbBase64);
      const thumbBytes = new Uint8Array(thumbBinary.length);
      for (let i = 0; i < thumbBinary.length; i++) {
        thumbBytes[i] = thumbBinary.charCodeAt(i);
      }
      await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, thumbBytes.buffer, { contentType: 'image/jpeg', upsert: false });
      const { data: thumbUrlData } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
      thumbnailUrl = thumbUrlData.publicUrl;
    } catch (_e) {}
  }

  return {
    url: urlData.publicUrl,
    filename: safeName,
    mimeType: isImage ? 'image/jpeg' : mimeType,
    sizeBytes,
    width,
    height,
    thumbnailUrl,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getConversationMedia(matchId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, metadata, message_type, created_at, sender_id')
    .eq('match_id', matchId)
    .in('message_type', ['image', 'images'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  const allImages: { url: string; thumbnailUrl?: string; messageId: string; createdAt: string }[] = [];
  (data || []).forEach((msg: any) => {
    if (msg.metadata?.images) {
      msg.metadata.images.forEach((img: any) => {
        allImages.push({ url: img.url, thumbnailUrl: img.thumbnailUrl, messageId: msg.id, createdAt: msg.created_at });
      });
    } else if (msg.metadata?.url) {
      allImages.push({ url: msg.metadata.url, thumbnailUrl: msg.metadata.thumbnailUrl, messageId: msg.id, createdAt: msg.created_at });
    }
  });

  return allImages;
}
