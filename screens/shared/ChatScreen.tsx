import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Linking } from 'react-native';
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
import { PlanBadge } from '../../components/PlanBadge';
import { RoomdrAISheet, ScreenContext } from '../../components/RoomdrAISheet';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { getMessages as getSupabaseMessages, sendMessage as sendSupabaseMessage, markMessagesAsRead as markSupabaseMessagesAsRead, subscribeToMessages } from '../../services/messageService';
import { acceptInquiry, declineInquiry } from '../../services/groupService';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import { AdBanner } from '../../components/AdBanner';
import { getDailyMessageCount, MESSAGING_LIMITS, getTimeUntilMidnight } from '../../utils/messagingUtils';
import { dispatchInsightTrigger } from '../../utils/insightRefresh';

type ChatScreenProps = {
  route: {
    params: {
      conversationId: string;
      otherUser?: RoommateProfile;
      inquiryGroup?: any;
    };
  };
  navigation: any;
};

export const ChatScreen = ({ route, navigation }: ChatScreenProps) => {
  const { conversationId, otherUser: routeOtherUser, inquiryGroup } = route.params;
  const isInquiryChat = !!inquiryGroup || conversationId.startsWith('inquiry_');
  const { theme } = useTheme();
  const { user, incrementMessageCount, canSendMessage, canStartNewChat, incrementActiveChatCount, watchAdForCredit, isBasicUser, blockUser, reportUser, canSendColdMessage, useColdMessage } = useAuth();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useNotificationContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showGroupOption, setShowGroupOption] = useState(true);
  const [isOnline, setIsOnline] = useState(Math.random() > 0.5);
  const [otherUser, setOtherUser] = useState<RoommateProfile | null>(routeOtherUser || null);
  const flatListRef = useRef<FlatList>(null);
  const [showReportBlockModal, setShowReportBlockModal] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);
  const [aiSheetContext, setAiSheetContext] = useState<ScreenContext>('chat');
  const [otherUserPlan, setOtherUserPlan] = useState<string | undefined>();
  const [isColdMessage, setIsColdMessage] = useState(false);
  const [coldMessageResponded, setColdMessageResponded] = useState(false);
  const [showColdMessageBlockSheet, setShowColdMessageBlockSheet] = useState(false);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [showChatLimitModal, setShowChatLimitModal] = useState(false);

  const [inquiryStatus, setInquiryStatus] = useState<'pending' | 'accepted' | 'declined'>(
    inquiryGroup?.inquiryStatus || inquiryGroup?.inquiry_status || 'pending'
  );
  const [addressRevealed, setAddressRevealed] = useState<boolean>(
    inquiryGroup?.addressRevealed || inquiryGroup?.address_revealed || false
  );
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const addressFlashOpacity = useSharedValue(0);
  const addressFlashStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,107,91,${addressFlashOpacity.value})`,
  }));
  const isHost = isInquiryChat && user?.id === inquiryGroup?.hostId;
  const userPlan = (user?.subscription?.plan || 'basic') as 'basic' | 'plus' | 'elite';
  const dailyCount = user ? getDailyMessageCount(user) : 0;
  const dailyLimit = MESSAGING_LIMITS[userPlan].dailyMessages;
  const isEliteUser = () => userPlan === 'elite';

  const handleAcceptInquiry = async () => {
    if (!inquiryGroup?.id) return;
    setIsAccepting(true);
    try {
      await acceptInquiry(inquiryGroup.id, user?.id || '');
      setInquiryStatus('accepted');
      setAddressRevealed(true);
      addressFlashOpacity.value = withSequence(
        withTiming(0.4, { duration: 200 }),
        withTiming(0, { duration: 800 })
      );
      const systemMsg: Message = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        senderId: 'system',
        text: 'Host accepted your inquiry. The full address has been shared with your group.',
        content: 'Host accepted your inquiry. The full address has been shared with your group.',
        timestamp: new Date(),
        read: true,
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (err) {
      console.error('Failed to accept inquiry:', err);
      Alert.alert('Error', 'Failed to accept inquiry. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineInquiry = async () => {
    if (!inquiryGroup?.id) return;
    Alert.alert('Decline Inquiry', 'Are you sure you want to decline this inquiry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          setIsDeclining(true);
          try {
            await declineInquiry(inquiryGroup.id, user?.id || '');
            setInquiryStatus('declined');
            const systemMsg: Message = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              senderId: 'system',
              text: 'The host has declined this inquiry.',
              content: 'The host has declined this inquiry.',
              timestamp: new Date(),
              read: true,
            };
            setMessages(prev => [...prev, systemMsg]);
          } catch (err) {
            console.error('Failed to decline inquiry:', err);
            Alert.alert('Error', 'Failed to decline inquiry. Please try again.');
          } finally {
            setIsDeclining(false);
          }
        }
      },
    ]);
  };

  const openDirections = () => {
    if (!inquiryGroup?.listingAddress) return;
    const address = encodeURIComponent(inquiryGroup.listingAddress);
    const url = Platform.OS === 'ios'
      ? `maps:?q=${address}`
      : `geo:0,0?q=${address}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
    });
  };

  // Tab bar height for bottom padding
  const TAB_BAR_HEIGHT = 80;

  const canSeeOnlineStatus = () => {
    const userPlan = user?.subscription?.plan || 'basic';
    const userStatus = user?.subscription?.status || 'active';
    return (userPlan === 'plus' || userPlan === 'elite') && userStatus === 'active';
  };

  const matchIdFromConversation = conversationId.startsWith('conv_') ? conversationId.slice(5) : conversationId;

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    if (!matchIdFromConversation) return;
    const unsubscribe = subscribeToMessages(matchIdFromConversation, (newMsg: any) => {
      if (newMsg.sender_id !== user?.id) {
        const mapped: Message = {
          id: newMsg.id,
          senderId: newMsg.sender_id,
          text: newMsg.content,
          content: newMsg.content,
          timestamp: new Date(newMsg.created_at),
          read: newMsg.read || false,
          readAt: newMsg.read_at ? new Date(newMsg.read_at) : undefined,
        };
        setMessages(prev => [...prev, mapped]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        try { markSupabaseMessagesAsRead(matchIdFromConversation); } catch (_e) {}
      }
    });
    return () => { unsubscribe(); };
  }, [matchIdFromConversation, user?.id]);

  const loadMessages = async () => {
    let loadedMessages: Message[] = [];
    let loadedFromSupabase = false;

    try {
      const supaMessages = await getSupabaseMessages(matchIdFromConversation);
      if (supaMessages && supaMessages.length > 0) {
        loadedMessages = supaMessages.map((msg: any) => ({
          id: msg.id,
          senderId: msg.sender_id,
          text: msg.content,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          read: msg.read || false,
          readAt: msg.read_at ? new Date(msg.read_at) : undefined,
        }));
        loadedFromSupabase = true;
        try { markSupabaseMessagesAsRead(matchIdFromConversation); } catch (_e) {}
      }
    } catch (supaError) {
      console.warn('Supabase getMessages failed, falling back to StorageService:', supaError);
    }

    if (!loadedFromSupabase) {
      const conversations = await StorageService.getConversations();
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        loadedMessages = (conversation.messages || []).map((msg: Message) => {
          if (msg.senderId === user?.id && !msg.readAt && msg.read !== false) {
            return { ...msg, readAt: new Date(new Date(msg.timestamp).getTime() + 60000) };
          }
          return msg;
        });
      }
    }

    setMessages(loadedMessages);

    const conversations = await StorageService.getConversations();
    const conversation = conversations.find(c => c.id === conversationId);

    if (!otherUser && conversation?.participant) {
      const roommateProfiles = await StorageService.getRoommateProfiles();
      const profile = roommateProfiles.find(p => p.id === conversation.participant.id);
      if (profile) {
        setOtherUser(profile);
      } else {
        setOtherUser({
          id: conversation.participant.id,
          name: conversation.participant.name,
          photos: conversation.participant.photo ? [conversation.participant.photo] : [],
        } as RoommateProfile);
      }
    }

    if (conversation?.participant) {
      const allUsers = await StorageService.getUsers();
      const participantUser = allUsers.find(u => u.id === conversation.participant.id);
      if (participantUser) {
        setOtherUserPlan(participantUser.subscription?.plan);
      }
    }

    if (user && conversation) {
      const matches = await StorageService.getMatches();
      const hasMatch = matches.some(m =>
        (m.userId1 === user.id && m.userId2 === conversation.participant.id) ||
        (m.userId2 === user.id && m.userId1 === conversation.participant.id)
      );
      if (conversation.matchType === 'cold' || !hasMatch) {
        setIsColdMessage(true);
        const otherResponded = loadedMessages.some(m => m.senderId === conversation.participant.id);
        setColdMessageResponded(otherResponded);
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user) return;

    if (isColdMessage && !coldMessageResponded) {
      const coldCheck = canSendColdMessage();
      if (!coldCheck.canSend) {
        if (isEliteUser()) {
          Alert.alert('Limit Reached', coldCheck.reason || 'No cold messages remaining.');
        } else {
          setShowColdMessageBlockSheet(true);
        }
        return;
      }
    }

    if (!canSendMessage()) {
      setShowDailyLimitModal(true);
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
          setShowChatLimitModal(true);
          return;
        }
      }

      let newMessage: Message;
      let sentViaSupabase = false;

      try {
        const supaMsg = await sendSupabaseMessage(matchIdFromConversation, inputText.trim());
        newMessage = {
          id: supaMsg.id,
          senderId: supaMsg.sender_id,
          text: supaMsg.content,
          content: supaMsg.content,
          timestamp: new Date(supaMsg.created_at),
          read: false,
        };
        sentViaSupabase = true;
      } catch (supaError) {
        console.warn('Supabase sendMessage failed, falling back to StorageService:', supaError);
        newMessage = {
          id: `msg_${Date.now()}`,
          senderId: user.id,
          text: inputText.trim(),
          timestamp: new Date(),
        };
      }

      if (!conversations[conversationIndex].messages) {
        conversations[conversationIndex].messages = [];
      }
      conversations[conversationIndex].messages.push(newMessage);
      conversations[conversationIndex].timestamp = new Date();
      conversations[conversationIndex].lastMessage = newMessage.text || '';
      await StorageService.setConversations(conversations);
      await incrementMessageCount();
      dispatchInsightTrigger('message_activity');

      if (isFirstMessageFromUser) {
        await incrementActiveChatCount(conversationId);
        if (isColdMessage && !coldMessageResponded) {
          await useColdMessage();
          conversations[conversationIndex].matchType = 'cold';
          await StorageService.setConversations(conversations);
        }
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
        await refreshUnreadCount();
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
    if (item.senderId === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <ThemedText style={styles.systemMessageText}>{item.text}</ThemedText>
          </View>
        </View>
      );
    }
    const isOwnMessage = item.senderId === user?.id;
    const showReadReceipt = isOwnMessage && isEliteUser();
    const isRead = item.readAt || item.read;
    const isHostMessage = isInquiryChat && inquiryGroup?.hostId && item.senderId === inquiryGroup.hostId;
    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {isHostMessage && !isOwnMessage ? (
          <View style={styles.hostBadge}>
            <Feather name="home" size={10} color="#ff6b5b" />
            <ThemedText style={styles.hostBadgeText}>Host</ThemedText>
          </View>
        ) : null}
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwnMessage
                ? theme.primary
                : isHostMessage
                  ? 'rgba(255,107,91,0.15)'
                  : theme.backgroundSecondary,
            },
            isHostMessage && !isOwnMessage ? { borderLeftWidth: 3, borderLeftColor: '#ff6b5b' } : null,
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
        {showReadReceipt ? (
          <View style={styles.readReceiptContainer}>
            <Feather
              name="check"
              size={12}
              color={isRead ? theme.primary : theme.textSecondary}
            />
            {isRead ? (
              <Feather
                name="check"
                size={12}
                color={theme.primary}
                style={{ marginLeft: -6 }}
              />
            ) : null}
            <ThemedText style={[Typography.caption, { color: isRead ? theme.primary : theme.textSecondary, marginLeft: 2, fontSize: 10 }]}>
              {isRead ? 'Read' : 'Sent'}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  };

  if (!otherUser && !isInquiryChat) {
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
      {isInquiryChat ? (
        <>
          <View style={[styles.header, { backgroundColor: 'rgba(255,107,91,0.06)', paddingTop: insets.top + Spacing.lg }]}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={[styles.headerCenter, { flex: 1 }]}>
              <Feather name="home" size={18} color="#ff6b5b" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <ThemedText style={{ fontSize: 11, color: '#ff6b5b', fontWeight: '600' }}>
                  Listing Inquiry
                </ThemedText>
                <ThemedText style={[Typography.h3]} numberOfLines={1}>
                  {addressRevealed
                    ? (inquiryGroup?.listingAddress || 'Listing')
                    : (inquiryGroup?.listingAddress?.split(',').slice(-2).join(',').trim() || 'Listing')}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={() => {
              const options: any[] = [
                { text: 'Leave Inquiry', style: 'destructive', onPress: () => {
                  Alert.alert('Leave Inquiry', 'Are you sure? If all renters leave, this inquiry will be archived.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
                  ]);
                }},
                { text: 'Report Host', onPress: () => setShowReportBlockModal(true) },
                { text: 'Cancel', style: 'cancel' },
              ];
              Alert.alert('Options', undefined, options);
            }} style={styles.moreButton}>
              <Feather name="more-vertical" size={24} color={theme.text} />
            </Pressable>
          </View>
          {isHost && inquiryStatus === 'pending' ? (
            <View style={styles.hostActionBar}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                  {inquiryGroup?.memberCount || 'Renters'} renter{(inquiryGroup?.memberCount || 0) !== 1 ? 's' : ''} want to view this listing
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={handleAcceptInquiry}
                  disabled={isAccepting}
                  style={styles.acceptButton}
                >
                  <Feather name="check" size={14} color="#fff" />
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#fff', marginLeft: 4 }}>
                    {isAccepting ? '...' : 'Accept'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleDeclineInquiry}
                  disabled={isDeclining}
                  style={styles.declineButton}
                >
                  <Feather name="x" size={14} color="rgba(255,255,255,0.7)" />
                  <ThemedText style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>
                    {isDeclining ? '...' : 'Decline'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : isHost && inquiryStatus !== 'pending' ? (
            <View style={[styles.hostActionBar, { backgroundColor: inquiryStatus === 'accepted' ? 'rgba(62,207,142,0.12)' : 'rgba(239,68,68,0.12)' }]}>
              <Feather name={inquiryStatus === 'accepted' ? 'check-circle' : 'x-circle'} size={16} color={inquiryStatus === 'accepted' ? '#3ECF8E' : '#ef4444'} />
              <ThemedText style={{ fontSize: 13, fontWeight: '600', color: inquiryStatus === 'accepted' ? '#3ECF8E' : '#ef4444', marginLeft: 8 }}>
                {inquiryStatus === 'accepted' ? 'Inquiry accepted — address shared' : 'Inquiry declined'}
              </ThemedText>
            </View>
          ) : null}
          {inquiryGroup?.listingAddress ? (
            <Animated.View style={[styles.pinnedListingCard, addressFlashStyle]}>
              {inquiryGroup.listingPhoto ? (
                <Image source={{ uri: inquiryGroup.listingPhoto }} style={styles.pinnedListingThumb} />
              ) : (
                <View style={styles.pinnedListingThumbWrap}>
                  <Feather name="home" size={20} color="#ff6b5b" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }} numberOfLines={1}>
                  {inquiryGroup.name || inquiryGroup.listingAddress}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Feather
                    name={addressRevealed ? 'unlock' : 'lock'}
                    size={10}
                    color={addressRevealed ? '#ff6b5b' : 'rgba(255,255,255,0.4)'}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText style={{ fontSize: 12, color: addressRevealed ? '#fff' : 'rgba(255,255,255,0.5)' }} numberOfLines={1}>
                    {addressRevealed
                      ? inquiryGroup.listingAddress
                      : (inquiryGroup.listingAddress?.split(',').slice(-2).join(',').trim() || inquiryGroup.listingAddress)}
                  </ThemedText>
                </View>
                {!addressRevealed && inquiryStatus === 'pending' ? (
                  <ThemedText style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    Full address shared after host accepts
                  </ThemedText>
                ) : null}
                {addressRevealed ? (
                  <Pressable onPress={openDirections} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <ThemedText style={{ fontSize: 11, color: '#ff6b5b', fontWeight: '600' }}>Get Directions</ThemedText>
                    <Feather name="arrow-right" size={11} color="#ff6b5b" style={{ marginLeft: 2 }} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => {
                if (inquiryGroup?.listingId) {
                  (navigation as any).navigate('RenterTabs', {
                    screen: 'Explore',
                    params: { viewListingId: inquiryGroup.listingId },
                  });
                }
              }} style={{ paddingLeft: 8 }}>
                <ThemedText style={{ fontSize: 12, color: '#ff6b5b', fontWeight: '600' }}>View Listing</ThemedText>
              </Pressable>
            </Animated.View>
          ) : null}
          {inquiryGroup?.isArchived ? (
            <View style={styles.archivedBanner}>
              <Feather name="archive" size={14} color="rgba(255,255,255,0.5)" />
              <ThemedText style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
                This inquiry has been archived — no new messages can be sent
              </ThemedText>
            </View>
          ) : null}
        </>
      ) : (
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThemedText style={[Typography.h3]}>
                  {otherUser.name}
                </ThemedText>
                <PlanBadge plan={otherUserPlan} size={15} />
              </View>
              {canSeeOnlineStatus() ? (
                <ThemedText style={[Typography.caption, { color: isOnline ? theme.success : theme.textSecondary }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => setShowAISheet(true)} style={styles.aiNavBtn}>
            <View style={styles.aiNavBtnInner}>
              <Feather name="cpu" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
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
      )}

      {!isInquiryChat && !canSeeOnlineStatus() ? (
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

      {!isInquiryChat && showGroupOption && otherUser ? (
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

      {isColdMessage && !coldMessageResponded ? (
        <View style={[styles.premiumBanner, { backgroundColor: 'rgba(147,112,219,0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(147,112,219,0.3)' }]}>
          <Feather name="send" size={16} color="#9370DB" />
          <ThemedText style={[Typography.caption, { color: '#9370DB', marginLeft: Spacing.sm, flex: 1 }]}>
            You sent a direct message — they haven't matched with you yet
          </ThemedText>
        </View>
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

      <AdBanner placement="chat_bottom" userPlan={userPlan} />
      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot, paddingBottom: TAB_BAR_HEIGHT }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
            },
          ]}
          placeholder={inquiryGroup?.isArchived ? 'This inquiry is archived' : 'Type a message...'}
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
          returnKeyType="send"
          multiline
          maxLength={500}
          editable={!inquiryGroup?.isArchived && canSendMessage()}
        />
        <Pressable
          onPress={sendMessage}
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && canSendMessage() ? theme.primary : theme.backgroundSecondary,
            },
          ]}
          disabled={!inputText.trim() || !canSendMessage()}
        >
          <Feather name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      {userPlan === 'basic' && (
        <View style={{ backgroundColor: theme.backgroundRoot, paddingBottom: 2, paddingHorizontal: 16 }}>
          {dailyCount >= dailyLimit ? (
            <ThemedText style={{ fontSize: 11, color: '#ef4444', textAlign: 'center' }}>
              No messages left today — resets at midnight
            </ThemedText>
          ) : dailyLimit - dailyCount <= 5 ? (
            <ThemedText style={{ fontSize: 11, color: '#ff6b5b', textAlign: 'center' }}>
              {dailyLimit - dailyCount} messages left today
            </ThemedText>
          ) : (
            <ThemedText style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              {dailyCount} / {dailyLimit} messages today
            </ThemedText>
          )}
        </View>
      )}

      <RoomdrAISheet
        visible={showAISheet}
        onDismiss={() => { setShowAISheet(false); setAiSheetContext('chat'); }}
        screenContext={aiSheetContext}
        contextData={{
          chat: {
            otherUserName: otherUser?.name,
            otherUserProfile: otherUser || undefined,
            messages: messages,
            onSuggestMessage: (text) => setInputText(text),
          },
        }}
        onNavigate={(screen, params) => {
          if (screen === 'ProfileQuestionnaire') {
            navigation.navigate('Profile' as any, { screen: 'ProfileQuestionnaire', params });
          } else {
            navigation.navigate(screen as any, params);
          }
        }}
      />

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

      <Modal
        visible={showColdMessageBlockSheet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowColdMessageBlockSheet(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 16 }} />
              <Feather name="lock" size={32} color={theme.primary} />
            </View>
            <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: 8 }]}>
              Match Required
            </ThemedText>
            <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: 24 }]}>
              Messaging requires a mutual match. Upgrade to Elite to send direct messages.
            </ThemedText>
            <Pressable
              style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}
              onPress={() => {
                setShowColdMessageBlockSheet(false);
                (navigation as any).navigate('Profile', { screen: 'Subscription' });
              }}
            >
              <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>Upgrade to Elite</ThemedText>
            </Pressable>
            <Pressable
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
              onPress={() => setShowColdMessageBlockSheet(false)}
            >
              <ThemedText style={[Typography.h3, { color: theme.textSecondary }]}>Maybe Later</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={showDailyLimitModal} transparent animationType="fade" onRequestClose={() => setShowDailyLimitModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 16 }} />
              <Feather name="message-circle" size={32} color="#ff6b5b" />
            </View>
            <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: 8 }]}>
              Daily Message Limit
            </ThemedText>
            <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: 24 }]}>
              {userPlan === 'basic'
                ? `You've used all 20 messages for today. Resets at midnight or upgrade for more.`
                : `You've used all 200 messages for today. Upgrade to Elite for unlimited messaging.`}
            </ThemedText>
            <Pressable
              style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}
              onPress={() => {
                setShowDailyLimitModal(false);
                (navigation as any).navigate('Profile', { screen: 'Payment' });
              }}
            >
              <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                {userPlan === 'basic' ? 'Upgrade to Plus (200/day)' : 'Upgrade to Elite (Unlimited)'}
              </ThemedText>
            </Pressable>
            <Pressable
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
              onPress={() => setShowDailyLimitModal(false)}
            >
              <ThemedText style={[Typography.h3, { color: theme.textSecondary }]}>Maybe Later</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showChatLimitModal} transparent animationType="fade" onRequestClose={() => setShowChatLimitModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.backgroundSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 16 }} />
              <Feather name="users" size={32} color="#ff6b5b" />
            </View>
            <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: 8 }]}>
              Active Chat Limit
            </ThemedText>
            <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: 24 }]}>
              {userPlan === 'basic'
                ? 'Basic users can have 3 active chats at once. Close a chat to start a new one, or upgrade.'
                : `You've reached your 10 active chat limit. Upgrade to Elite for unlimited chats.`}
            </ThemedText>
            <Pressable
              style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}
              onPress={() => {
                setShowChatLimitModal(false);
                (navigation as any).navigate('Profile', { screen: 'Payment' });
              }}
            >
              <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                {userPlan === 'basic' ? 'Upgrade to Plus (10 chats)' : 'Upgrade to Elite (Unlimited)'}
              </ThemedText>
            </Pressable>
            <Pressable
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
              onPress={() => setShowChatLimitModal(false)}
            >
              <ThemedText style={[Typography.h3, { color: theme.textSecondary }]}>Maybe Later</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  aiNavBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiNavBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff4d4d',
    justifyContent: 'center',
    alignItems: 'center',
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
  readReceiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    paddingRight: 4,
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
  pinnedListingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  pinnedListingThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  pinnedListingThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignSelf: 'flex-start',
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff6b5b',
    marginLeft: 4,
  },
  hostActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '85%',
  },
  systemMessageText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center' as const,
  },
});
