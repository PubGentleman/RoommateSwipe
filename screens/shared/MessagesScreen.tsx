import React, { useState } from 'react';
import { View, StyleSheet, Pressable, FlatList, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { mockConversations } from '../../utils/mockData';
import { Conversation } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MessagesScreen = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Pressable
      style={[
        styles.conversationItem,
        { backgroundColor: item.unread > 0 ? Colors[theme].backgroundSecondary : Colors[theme].backgroundRoot },
      ]}
      onPress={() => {}}
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.participant.photo }} style={styles.avatar} />
        {item.participant.online ? <View style={[styles.onlineIndicator, { backgroundColor: Colors[theme].success }]} /> : null}
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <ThemedText style={[Typography.body, { fontWeight: item.unread > 0 ? '600' : '400' }]}>
            {item.participant.name}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: Colors[theme].textSecondary }]}>
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>
        <View style={styles.messageRow}>
          <ThemedText
            style={[
              Typography.caption,
              {
                color: item.unread > 0 ? Colors[theme].text : Colors[theme].textSecondary,
                flex: 1,
                fontWeight: item.unread > 0 ? '500' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </ThemedText>
          {item.unread > 0 ? (
            <View style={[styles.unreadBadge, { backgroundColor: Colors[theme].primary }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontSize: 10 }]}>
                {item.unread}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
        <Pressable style={styles.searchButton} onPress={() => {}}>
          <Feather name="search" size={24} color={Colors[theme].text} />
        </Pressable>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  searchButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
});
