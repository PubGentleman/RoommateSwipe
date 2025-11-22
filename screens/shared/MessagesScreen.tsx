import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Conversation, Match, RoommateProfile } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';

type MessagesScreenProps = {
  navigation: any;
};

export const MessagesScreen = ({ navigation }: MessagesScreenProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadConversations();
    }, [user])
  );

  const loadConversations = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      let existingConversations = await StorageService.getConversations();
      const matches = await StorageService.getMatches();
      const profiles = await StorageService.getRoommateProfiles();

      for (const match of matches) {
        if (match.userId1 !== user.id && match.userId2 !== user.id) {
          continue;
        }

        const otherUserId = match.userId1 === user.id ? match.userId2 : match.userId1;
        const conversationExists = existingConversations.some(
          c => c.participant.id === otherUserId
        );

        if (!conversationExists) {
          const otherProfile = profiles.find(p => p.id === otherUserId);
          if (otherProfile) {
            const newConversation: Conversation = {
              id: `conv_${match.id}`,
              participant: {
                id: otherProfile.id,
                name: otherProfile.name,
                photo: otherProfile.photos?.[0],
                online: Math.random() > 0.5,
              },
              lastMessage: 'You matched!',
              timestamp: match.matchedAt,
              unread: 0,
              messages: [],
            };
            existingConversations.push(newConversation);
          }
        }
      }

      const userConversations = existingConversations.filter(
        c => matches.some(match => 
          (match.userId1 === user.id && match.userId2 === c.participant.id) ||
          (match.userId2 === user.id && match.userId1 === c.participant.id)
        )
      );

      userConversations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      await StorageService.setConversations(existingConversations);
      setConversations(userConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        { backgroundColor: item.unread > 0 ? theme.backgroundSecondary : theme.backgroundRoot },
      ]}
      onPress={() => {
        navigation.navigate('Chat', {
          conversationId: item.id,
          otherUser: item.participant,
        });
      }}
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.participant.photo }} style={styles.avatar} />
        {item.participant.online ? <View style={[styles.onlineIndicator, { backgroundColor: theme.success }]} /> : null}
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <ThemedText style={[Typography.body, { fontWeight: item.unread > 0 ? '600' : '400' }]}>
            {item.participant.name}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>
        <View style={styles.messageRow}>
          <ThemedText
            style={[
              Typography.caption,
              {
                color: item.unread > 0 ? theme.text : theme.textSecondary,
                flex: 1,
                fontWeight: item.unread > 0 ? '500' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </ThemedText>
          {item.unread > 0 ? (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontSize: 10 }]}>
                {item.unread}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="message-circle" size={64} color={theme.textSecondary} />
      <ThemedText style={[Typography.h2, styles.emptyTitle]}>No Messages Yet</ThemedText>
      <ThemedText style={[Typography.body, styles.emptySubtitle, { color: theme.textSecondary }]}>
        Match with roommates on the Roommates tab to start chatting
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
        <Pressable style={styles.searchButton} onPress={() => {}}>
          <Feather name="search" size={24} color={theme.text} />
        </Pressable>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100, flexGrow: 1 },
        ]}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
