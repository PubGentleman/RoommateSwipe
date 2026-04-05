import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, FlatList } from 'react-native';
import { Feather } from './VectorIcons';

interface PinnedMessage {
  id: string;
  pinned_at: string;
  pinned_by: string;
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  } | null;
}

interface Props {
  visible: boolean;
  pinnedMessages: PinnedMessage[];
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  isAdmin: boolean;
}

export function PinnedMessagesSheet({ visible, pinnedMessages, onClose, onJumpToMessage, onUnpin, isAdmin }: Props) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Pinned Messages</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          {pinnedMessages.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bookmark" size={36} color="rgba(255,255,255,0.12)" />
              <Text style={styles.emptyText}>No pinned messages</Text>
            </View>
          ) : (
            <FlatList
              data={pinnedMessages}
              keyExtractor={item => item.id}
              style={styles.list}
              renderItem={({ item }) => (
                <View style={styles.pinnedItem}>
                  <View style={styles.pinnedContent}>
                    <Text style={styles.pinnedMessage} numberOfLines={2}>
                      {item.message?.content || 'Message unavailable'}
                    </Text>
                    <Text style={styles.pinnedDate}>
                      Pinned {formatDate(item.pinned_at)}
                    </Text>
                  </View>
                  <View style={styles.pinnedActions}>
                    {item.message ? (
                      <Pressable
                        style={styles.jumpBtn}
                        onPress={() => { onJumpToMessage(item.message!.id); onClose(); }}
                      >
                        <Text style={styles.jumpText}>Jump</Text>
                      </Pressable>
                    ) : null}
                    {isAdmin ? (
                      <Pressable
                        style={styles.unpinBtn}
                        onPress={() => onUnpin(item.message?.id || '')}
                      >
                        <Feather name="x-circle" size={16} color="rgba(255,255,255,0.3)" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

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
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    maxHeight: 300,
  },
  pinnedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  pinnedContent: {
    flex: 1,
    gap: 4,
  },
  pinnedMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  pinnedDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  pinnedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jumpBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
  },
  jumpText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  unpinBtn: {
    padding: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
