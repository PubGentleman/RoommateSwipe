import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Message, RoommateProfile } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ReportBlockModal } from '../../components/ReportBlockModal';

type ChatScreenProps = {
  route: {
    params: {
      conversationId: string;
      otherUser?: RoommateProfile;
    };
  };
  navigation: any;
};

export const ChatScreen = ({ route, navigation }: ChatScreenProps) => {
  const { conversationId, otherUser: routeOtherUser } = route.params;
  const { theme } = useTheme();
  const { user, incrementMessageCount, canSendMessage, canStartNewChat, incrementActiveChatCount, watchAdForCredit, isBasicUser, blockUser, reportUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showGroupOption, setShowGroupOption] = useState(true);
  const [isOnline, setIsOnline] = useState(Math.random() > 0.5);
  const [otherUser, setOtherUser] = useState<RoommateProfile | null>(routeOtherUser || null);
  const flatListRef = useRef<FlatList>(null);
  const [showReportBlockModal, setShowReportBlockModal] = useState(false);

  // Tab bar height for bottom padding
  const TAB_BAR_HEIGHT = 80;

  const canSeeOnlineStatus = () => {
    const userPlan = user?.subscription?.plan || 'basic';
    const userStatus = user?.subscription?.status || 'active';
    return (userPlan === 'plus' || userPlan === 'elite') && userStatus === 'active';
  };

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  const loadMessages = async () => {
    const conversations = await StorageService.getConversations();
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setMessages(conversation.messages || []);
      
      // Load other user data from conversation if not provided in route params
      if (!otherUser && conversation.participant) {
        const roommateProfiles = await StorageService.getRoommateProfiles();
        const profile = roommateProfiles.find(p => p.id === conversation.participant.id);
        if (profile) {
          setOtherUser(profile);
        } else {
          // Fallback: create minimal profile from conversation participant
          setOtherUser({
            id: conversation.participant.id,
            name: conversation.participant.name,
            photos: conversation.participant.photo ? [conversation.participant.photo] : [],
          } as RoommateProfile);
        }
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user) return;

    if (!canSendMessage()) {
      const alertButtons: any[] = [
        { text: 'Maybe Later', style: 'cancel' },
      ];

      if (isBasicUser()) {
        alertButtons.push({
          text: 'Watch Ad (+5 Messages)',
          onPress: async () => {
            const success = await watchAdForCredit('messages');
            if (success) {
              Alert.alert('Messages Earned', 'You earned 5 bonus messages by watching an ad!');
            }
          },
        });
      }

      alertButtons.push({
        text: 'View Plans',
        onPress: () => navigation.navigate('Profile', { screen: 'Payment' }),
      });

      Alert.alert(
        'Message Limit Reached',
        `You've reached your limit of 50 messages on the basic plan. Watch an ad for 5 bonus messages or upgrade for unlimited messaging!`,
        alertButtons
      );
      return;
    }

    const conversations = await StorageService.getConversations();
    const conversationIndex = conversations.findIndex(c => c.id === conversationId);
    
    if (conversationIndex >= 0) {
      const isFirstMessageFromUser = !conversations[conversationIndex].messages?.some(
        msg => msg.senderId === user.id
      );

      if (isFirstMessageFromUser) {
        const chatCheck = await canStartNewChat(conversationId);
        
        if (!chatCheck.canStart) {
          Alert.alert(
            'Active Chat Limit Reached',
            chatCheck.reason || 'Cannot start a new chat',
            [
              { text: 'Maybe Later', style: 'cancel' },
              {
                text: 'View Plans',
                onPress: () => navigation.navigate('Profile', { screen: 'Payment' }),
              },
            ]
          );
          return;
        }
      }

      const newMessage: Message = {
        id: `msg_${Date.now()}`,
        senderId: user.id,
        text: inputText.trim(),
        timestamp: new Date(),
      };
      
      if (!conversations[conversationIndex].messages) {
        conversations[conversationIndex].messages = [];
      }
      conversations[conversationIndex].messages.push(newMessage);
      conversations[conversationIndex].timestamp = new Date();
      conversations[conversationIndex].lastMessage = newMessage.text || '';
      await StorageService.setConversations(conversations);
      await incrementMessageCount();
      
      if (isFirstMessageFromUser) {
        await incrementActiveChatCount(conversationId);
      }

      const otherParticipantId = conversations[conversationIndex].participants?.find(
        (p: string) => p !== user.id
      );
      const blockedIds = user.blockedUsers || [];
      if (otherParticipantId && !blockedIds.includes(otherParticipantId)) {
        await StorageService.addNotification({
          id: `notif_msg_${Date.now()}`,
          userId: otherParticipantId,
          type: 'message',
          title: 'New Message',
          body: `${user.name || 'Someone'}: ${inputText.trim().substring(0, 80)}${inputText.trim().length > 80 ? '...' : ''}`,
          isRead: false,
          createdAt: new Date(),
          data: {
            conversationId,
            fromUserId: user.id,
            fromUserName: user.name,
            fromUserPhoto: user.profilePicture,
          },
        });
      }
      
      setMessages([...conversations[conversationIndex].messages]);
      setInputText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleCreateGroup = () => {
    if (!otherUser) return;
    navigation.navigate('CreateGroup', {
      matchedUserId: otherUser.id,
      matchedUserName: otherUser.name,
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === user?.id;
    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwnMessage ? theme.primary : theme.backgroundSecondary,
            },
          ]}
        >
          <ThemedText
            style={[
              Typography.body,
              { color: isOwnMessage ? '#FFFFFF' : theme.text },
            ]}
          >
            {item.text}
          </ThemedText>
        </View>
      </View>
    );
  };

  // Guard: wait for otherUser to load
  if (!otherUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: otherUser.photos?.[0] }} style={styles.headerAvatar} />
            {canSeeOnlineStatus() && isOnline ? (
              <View style={[styles.headerOnlineIndicator, { backgroundColor: theme.success }]} />
            ) : null}
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText style={[Typography.h3]}>
              {otherUser.name}
            </ThemedText>
            {canSeeOnlineStatus() ? (
              <ThemedText style={[Typography.caption, { color: isOnline ? theme.success : theme.textSecondary }]}>
                {isOnline ? 'Online' : 'Offline'}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Pressable onPress={() => {
          Alert.alert(
            'Options',
            undefined,
            [
              { text: 'Create Group', onPress: handleCreateGroup },
              { text: 'Report / Block', onPress: () => setShowReportBlockModal(true) },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }} style={styles.moreButton}>
          <Feather name="more-vertical" size={24} color={theme.text} />
        </Pressable>
      </View>

      {!canSeeOnlineStatus() ? (
        <Pressable
          style={[styles.premiumBanner, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => (navigation as any).navigate('Profile', { screen: 'Payment' })}
        >
          <Feather name="zap" size={18} color={theme.primary} />
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }]}>
            Upgrade to Plus to see who's online
          </ThemedText>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      {showGroupOption ? (
        <Pressable
          style={[styles.groupBanner, { backgroundColor: theme.primary }]}
          onPress={handleCreateGroup}
        >
          <Feather name="users" size={20} color="#FFFFFF" />
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.md }]}>
            Create a group with {otherUser.name.split(' ')[0]} to find more roommates
          </ThemedText>
          <Pressable onPress={() => setShowGroupOption(false)} style={styles.dismissButton}>
            <Feather name="x" size={20} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.messagesList, { paddingBottom: Spacing.lg }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </View>

      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot, paddingBottom: TAB_BAR_HEIGHT }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
          returnKeyType="send"
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={sendMessage}
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() ? theme.primary : theme.backgroundSecondary,
            },
          ]}
          disabled={!inputText.trim()}
        >
          <Feather name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {otherUser ? (
        <ReportBlockModal
          visible={showReportBlockModal}
          onClose={() => setShowReportBlockModal(false)}
          userName={otherUser.name}
          onReport={async (reason) => {
            if (otherUser) {
              await reportUser(otherUser.id, reason);
            }
          }}
          onBlock={async () => {
            if (otherUser) {
              await blockUser(otherUser.id);
              navigation.goBack();
            }
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    zIndex: 10,
    elevation: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 20,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 20,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.small,
    zIndex: 1,
  },
  groupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    zIndex: 1,
  },
  dismissButton: {
    marginLeft: 'auto',
    padding: Spacing.xs,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  messageContainer: {
    marginBottom: Spacing.md,
    maxWidth: '75%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.medium,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
