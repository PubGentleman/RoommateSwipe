import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from './VectorIcons';
import { Image } from 'expo-image';

interface Props {
  uploading: boolean;
  sent: number;
  total: number;
  imageUri?: string;
  onCancel: () => void;
}

export function MediaUploadProgress({ uploading, sent, total, imageUri, onCancel }: Props) {
  if (!uploading) return null;

  const label = total > 1 ? `Sending ${sent} of ${total} photos...` : 'Sending photo...';

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" />
      ) : null}
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: total > 0 ? `${(sent / total) * 100}%` : '0%' }]} />
        </View>
      </View>
      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
      </Pressable>
      <ActivityIndicator size="small" color="#ff6b5b" style={{ marginLeft: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,107,91,0.15)',
    gap: 10,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    opacity: 0.7,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff6b5b',
    borderRadius: 2,
  },
  cancelBtn: {
    padding: 4,
  },
});
