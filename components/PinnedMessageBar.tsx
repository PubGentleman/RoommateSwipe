import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from './VectorIcons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

interface PinnedMessage {
  id: string;
  pinned_at: string;
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  } | null;
}

interface Props {
  pinnedMessages: PinnedMessage[];
  onPress: () => void;
}

export function PinnedMessageBar({ pinnedMessages, onPress }: Props) {
  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  const latest = pinnedMessages[0];
  const preview = latest?.message?.content || '';
  const count = pinnedMessages.length;

  return (
    <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(150)}>
      <Pressable style={styles.container} onPress={onPress}>
        <Feather name="bookmark" size={14} color="#ff6b5b" />
        <Text style={styles.content} numberOfLines={1}>
          {count > 1 ? `${count} pinned messages` : preview}
        </Text>
        <Feather name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  content: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});
