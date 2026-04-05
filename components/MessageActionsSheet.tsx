import React from 'react';
import { View, Pressable, StyleSheet, Text, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from './VectorIcons';
import * as Haptics from 'expo-haptics';

type Action = {
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  messageText: string;
  isOwnMessage: boolean;
  actions: Action[];
};

export default function MessageActionsSheet({ visible, onClose, messageText, isOwnMessage, actions }: Props) {
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={localStyles.backdrop} onPress={onClose}>
        <View style={localStyles.sheet}>
          <View style={localStyles.preview}>
            <Text style={localStyles.previewText} numberOfLines={3}>{messageText}</Text>
          </View>
          <View style={localStyles.divider} />
          {actions.map((action, i) => (
            <Pressable
              key={i}
              style={localStyles.actionRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                action.onPress();
                onClose();
              }}
            >
              <Feather
                name={action.icon as any}
                size={18}
                color={action.destructive ? '#ef4444' : 'rgba(255,255,255,0.7)'}
              />
              <Text style={[localStyles.actionLabel, action.destructive ? { color: '#ef4444' } : null]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  preview: {
    padding: 16,
  },
  previewText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
});
