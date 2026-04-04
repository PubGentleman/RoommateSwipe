import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Feather } from './VectorIcons';

interface ChatFileMessageProps {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isMine: boolean;
  timestamp: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'file-text';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  if (mimeType.includes('image')) return 'image';
  return 'file';
}

const ChatFileMessage: React.FC<ChatFileMessageProps> = ({
  url, filename, mimeType, sizeBytes, isMine, timestamp,
}) => {
  const handleOpen = () => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Pressable onPress={handleOpen}>
      <View style={[styles.container, isMine ? styles.mine : styles.theirs]}>
        <View style={styles.iconBox}>
          <Feather name={getFileIcon(mimeType) as any} size={20} color="#ff6b5b" />
        </View>
        <View style={styles.info}>
          <Text style={styles.filename} numberOfLines={1}>{filename}</Text>
          <Text style={styles.meta}>
            {formatFileSize(sizeBytes)} · Tap to open
          </Text>
        </View>
        <Feather name="download" size={16} color="rgba(255,255,255,0.3)" />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    maxWidth: 280,
  },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  filename: { fontSize: 13, fontWeight: '600', color: '#fff' },
  meta: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
});

export default ChatFileMessage;
