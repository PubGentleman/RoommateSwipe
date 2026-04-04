import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';

interface ChatAttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onPickDocument: () => void;
}

const ChatAttachmentPicker: React.FC<ChatAttachmentPickerProps> = ({
  visible, onClose, onPickImage, onTakePhoto, onPickDocument,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Send Attachment</Text>

          <Pressable style={styles.option} onPress={() => { onPickImage(); onClose(); }}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
              <Feather name="image" size={20} color="#6366f1" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Photo Library</Text>
              <Text style={styles.optionDesc}>Choose from your photos</Text>
            </View>
          </Pressable>

          <Pressable style={styles.option} onPress={() => { onTakePhoto(); onClose(); }}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Feather name="camera" size={20} color="#22c55e" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Take Photo</Text>
              <Text style={styles.optionDesc}>Use your camera</Text>
            </View>
          </Pressable>

          <Pressable style={styles.option} onPress={() => { onPickDocument(); onClose(); }}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,107,91,0.1)' }]}>
              <Feather name="file-text" size={20} color="#ff6b5b" />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Document</Text>
              <Text style={styles.optionDesc}>PDF, Word, or other files</Text>
            </View>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  optionDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  cancelBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});

export default ChatAttachmentPicker;
