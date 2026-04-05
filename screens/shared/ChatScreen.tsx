import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, Modal, Linking, Text, NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator } from 'react-native';
import { Feather } from '../../components/VectorIcons';
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
import { PlanBadgeInline } from '../../components/LockedFeatureOverlay';
import { PaywallSheet } from '../../components/PaywallSheet';
import { RhomeAISheet, ScreenContext } from '../../components/RhomeAISheet';
import { AIFloatingButton } from '../../components/AIFloatingButton';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { getMessages as getSupabaseMessages, sendMessage as sendSupabaseMessage, markMessagesAsRead as markSupabaseMessagesAsRead, subscribeToMessages, addReaction, removeReaction, getReactions, sendReplyMessage, deleteMessage as deleteMessageService, editMessage as editMessageService, sendVoiceMessage } from '../../services/messageService';
import { joinConversationTyping, leaveConversationTyping, sendTypingIndicator, isUserOnline, subscribeToPresence, getTypingUsers, getLastSeen, formatLastSeen } from '../../services/presenceService';
import { OnlineDot } from '../../components/OnlineDot';
import { recordMessageActivity } from '../../utils/aiMemory';
import { requireVerification } from '../../utils/verificationGating';
import { acceptInquiry, declineInquiry, linkListingToGroup, leaveGroup, removeMember, getGroupMessages, sendGroupMessage, subscribeToGroupMessages, sendGroupMessageWithMentions, pinMessage, unpinMessage, getPinnedMessages, deleteGroupMessage, editGroupMessage, adminDeleteGroupMessage, muteGroup, unmuteGroup, updateLastRead, markMentionsRead, getGroupMemberMuteStatus, getGroupSettings } from '../../services/groupService';
import { MentionInput } from '../../components/MentionInput';
import { PinnedMessageBar } from '../../components/PinnedMessageBar';
import { PinnedMessagesSheet } from '../../components/PinnedMessagesSheet';
import { supabase } from '../../lib/supabase';
import { SafeMessageText } from '../../components/SafeMessageText';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { getProfileGateStatus, getItemsForTier, ProfileTier } from '../../utils/profileGate';
import FeatureGateModal from '../../components/FeatureGateModal';
import { GroupPropertySearchModal } from '../../components/GroupPropertySearchModal';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, FadeIn, FadeInDown } from 'react-native-reanimated';
import { AdBanner } from '../../components/AdBanner';
import { getDailyMessageCount, MESSAGING_LIMITS, getTimeUntilMidnight, incrementDailyColdMessageCount } from '../../utils/messagingUtils';
import SmartUpgradePrompt from '../../components/SmartUpgradePrompt';
import { getUpgradePromptData, shouldShowUpgradePrompt, type UpgradePromptData } from '../../services/upgradePromptService';
import { calculateTrustScore } from '../../utils/trustScore';
import { dispatchInsightTrigger } from '../../utils/insightRefresh';
import { useConfirm } from '../../contexts/ConfirmContext';
import MeetupSuggestionCard from '../../components/MeetupSuggestionCard';
import { AskAboutPersonModal } from '../../components/AskAboutPersonModal';
import { ChatActionCard } from '../../components/ChatActionCard';
import { VisitRequestModal } from '../../components/VisitRequestModal';
import { BookingOfferModal } from '../../components/BookingOfferModal';
import { sendStructuredMessage, updateMessageMetadata } from '../../services/messageService';
import ChatAttachmentPicker from '../../components/ChatAttachmentPicker';
import ChatImageMessage from '../../components/ChatImageMessage';
import ChatFileMessage from '../../components/ChatFileMessage';
import { pickImage, takePhoto, pickDocument, uploadChatAttachment, formatFileSize } from '../../services/chatAttachmentService';
import { ImageGalleryViewer } from '../../components/ImageGalleryViewer';
import { MediaUploadProgress } from '../../components/MediaUploadProgress';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { createBooking } from '../../services/bookingService';
import {
  updateRenterMessageTimestamp,
  updateAgentResponseTimestamp,
  requestDifferentAgent,
  getHoursSinceMessage,
} from '../../services/responseTrackingService';
import {
  canAccessMessages,
  canAccessConversation,
  hasFreeUnlockAvailable,
  useFreeMessageUnlock,
  getMessagingUpgradePlan,
} from '../../utils/messagingAccess';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import VoiceMessageBubble from '../../components/VoiceMessageBubble';
import LinkPreviewCard from '../../components/LinkPreviewCard';
import MessageActionsSheet from '../../components/MessageActionsSheet';
import { extractUrls } from '../../utils/linkPreview';

const QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25'];
const EXTENDED_EMOJIS = [
  '\uD83D\uDC4D', '\uD83D\uDC4E', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25',
  '\uD83C\uDF89', '\uD83D\uDC4F', '\uD83D\uDE4F', '\uD83D\uDC40', '\uD83D\uDCAF', '\u2705', '\u274C',
  '\uD83E\uDD14', '\uD83D\uDE0D', '\uD83D\uDE0E', '\uD83D\uDE44', '\uD83D\uDE2D', '\uD83D\uDE21',
  '\uD83D\uDE0A', '\uD83E\uDD18', '\uD83D\uDCAA', '\uD83C\uDF31', '\u2B50', '\uD83D\uDC8E',
  '\uD83C\uDFE0', '\uD83D\uDD11', '\uD83D\uDCAC', '\uD83D\uDCA1',
];

type DateSeparatorItem = { type: 'date_separator'; id: string; date: string };
type ChatListItem = (Message & { type?: 'message'; isLastInCluster?: boolean; isFirstInCluster?: boolean }) | DateSeparatorItem;

const GROUP_NAME_COLORS = [
  '#ff6b5b', '#3ECF8E', '#3b82f6', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#EF4444',
  '#06B6D4', '#84CC16', '#A855F7', '#FB923C', '#2DD4BF',
];
function getNameColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return GROUP_NAME_COLORS[Math.abs(hash) % GROUP_NAME_COLORS.length];
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(date: Date): string {
  const d = new Date(date);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function buildChatList(messages: Message[]): ChatListItem[] {
  if (!messages.length) return [];
  const items: ChatListItem[] = [];
  let lastDate = '';
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const ts = new Date(msg.timestamp);
    const dateKey = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;
    if (dateKey !== lastDate) {
      items.push({ type: 'date_separator', id: `sep-${dateKey}`, date: formatDateLabel(ts) });
      lastDate = dateKey;
    }
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    const sameSenderAsPrev = prev && prev.senderId === msg.senderId;
    const withinClusterPrev = sameSenderAsPrev && (ts.getTime() - new Date(prev.timestamp).getTime() < 120000);
    const sameSenderAsNext = next && next.senderId === msg.senderId;
    const withinClusterNext = sameSenderAsNext && (new Date(next.timestamp).getTime() - ts.getTime() < 120000);
    items.push({
      ...msg,
      type: 'message' as const,
      isFirstInCluster: !withinClusterPrev,
      isLastInCluster: !withinClusterNext,
    });
  }
  return items;
}

const TypingDot = ({ delay }: { delay: number }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const timeout = setTimeout(() => {
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0.3, { duration: 300 })
      );
    }, delay);

    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0.3, { duration: 300 })
      );
    }, 900);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.typingDotStyle, animStyle]} />;
};

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
  const { conversationId, otherUser: routeOtherUser, inquiryGroup, matchId: routeMatchId, highlightMessageId } = route.params as any;
  const isInquiryChat = !!inquiryGroup || conversationId.startsWith('inquiry_');
  const { theme } = useTheme();
  const { user, incrementMessageCount, canSendMessage, canStartNewChat, incrementActiveChatCount, watchAdForCredit, isBasicUser, blockUser, reportUser, canSendColdMessage, useColdMessage, getHostPlan, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { confirm, alert } = useConfirm();
  const { refreshUnreadCount } = useNotificationContext();
  const gateStatus = useMemo(() => getProfileGateStatus(user), [user]);
  const [gateModal, setGateModal] = useState<{ visible: boolean; feature: string; requiredTier: ProfileTier } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightMessageId || null);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ uploading: false, sent: 0, total: 0, previewUri: '' });
  const uploadCancelledRef = useRef(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ url: string; senderName?: string; createdAt?: string }[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showGroupOption, setShowGroupOption] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string>('');
  const [hasBookingInThread, setHasBookingInThread] = useState(false);
  const [otherUser, setOtherUser] = useState<RoommateProfile | null>(routeOtherUser || null);
  const flatListRef = useRef<FlatList>(null);
  const [showReportBlockModal, setShowReportBlockModal] = useState(false);
  const [showAskAbout, setShowAskAbout] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);
  const [aiSheetContext, setAiSheetContext] = useState<ScreenContext>('chat');
  const [otherUserPlan, setOtherUserPlan] = useState<string | undefined>();
  const [isColdMessage, setIsColdMessage] = useState(false);
  const [coldMessageResponded, setColdMessageResponded] = useState(false);
  const [coldMessagesRemaining, setColdMessagesRemaining] = useState<number>(3);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [showChatLimitModal, setShowChatLimitModal] = useState(false);
  const [upgradePromptData, setUpgradePromptData] = useState<UpgradePromptData | null>(null);
  const [linkedListing, setLinkedListing] = useState<any>(null);
  const [showPropertySearch, setShowPropertySearch] = useState(false);
  const [myGroupRole, setMyGroupRole] = useState<'admin' | 'member' | null>(null);
  const [groupName, setGroupName] = useState<string>('Group Chat');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showInquiryOptionsMenu, setShowInquiryOptionsMenu] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [showMembersOverlay, setShowMembersOverlay] = useState(false);
  const [meetupSuggestion, setMeetupSuggestion] = useState<any>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [leakageDetected, setLeakageDetected] = useState(false);
  const [showChatActions, setShowChatActions] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [counterProposalMessageId, setCounterProposalMessageId] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [cardActionLoading, setCardActionLoading] = useState<string | null>(null);
  const [chatHostInfo, setChatHostInfo] = useState<{
    name?: string;
    hostType: 'individual' | 'company' | 'agent';
    isVerifiedAgent?: boolean;
    companyName?: string;
    companyId?: string;
    licenseNumber?: string;
  } | null>(null);
  const [chatGroupSize, setChatGroupSize] = useState<number>(0);
  const [isGroupLeader, setIsGroupLeader] = useState<boolean>(true);
  const [responseDelayHours, setResponseDelayHours] = useState<number>(0);
  const [requestedDifferentAgent, setRequestedDifferentAgent] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [paywallRequiredPlan, setPaywallRequiredPlan] = useState<string>('elite');
  const isNearBottom = useRef(true);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [activeMessageActions, setActiveMessageActions] = useState<Message | null>(null);
  const [showReactionBar, setShowReactionBar] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerTargetId, setEmojiPickerTargetId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [reactionsMap, setReactionsMap] = useState<Record<string, { emoji: string; userIds: string[]; count: number }[]>>({});
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [showPinnedSheet, setShowPinnedSheet] = useState(false);
  const [isGroupMuted, setIsGroupMuted] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [groupOnlineCount, setGroupOnlineCount] = useState(0);
  const [groupChatSettings, setGroupChatSettings] = useState<Record<string, any>>({});
  const { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording } = useVoiceRecording();

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    isNearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
  }, []);

  const hasMessagingAccess = canAccessMessages(user || null);
  const isConvUnlocked = canAccessConversation(user || null, conversationId);
  const canUnlock = hasFreeUnlockAvailable(user || null);
  const upgradePlan = getMessagingUpgradePlan(user || null);
  const messagingLocked = !hasMessagingAccess && !isConvUnlocked;

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
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);
  const dailyCount = user ? getDailyMessageCount(user) : 0;
  const dailyLimit = MESSAGING_LIMITS[userPlan].dailyMessages;
  const isEliteUser = () => userPlan === 'elite';
  const showLockedReadReceipt = !isEliteUser();
  const userRole = user?.role || 'renter';
  const effectiveRole = userRole === 'host' ? (user?.hostType || 'host') : userRole;
  const hostPlan = getHostPlan();
  const isPaidUser = userRole === 'renter'
    ? renterLimits.canSeeContactInfo
    : (hostPlan === 'business' || effectiveRole === 'company' || effectiveRole === 'agent');
  const contactInfoVisible = isPaidUser || hasBookingInThread;

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
      await alert({ title: 'Error', message: 'Failed to accept inquiry. Please try again.', variant: 'warning' });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineInquiry = async () => {
    if (!inquiryGroup?.id) return;
    const confirmed = await confirm({
      title: 'Decline Inquiry',
      message: 'Are you sure you want to decline this inquiry?',
      confirmText: 'Decline',
      variant: 'danger',
    });
    if (!confirmed) return;

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
      await alert({ title: 'Error', message: 'Failed to decline inquiry. Please try again.', variant: 'warning' });
    } finally {
      setIsDeclining(false);
    }
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

  const matchIdFromConversation = routeMatchId
    ?? (conversationId.startsWith('conv-interest-')
      ? null
      : conversationId.startsWith('conv_')
        ? conversationId.slice(5)
        : conversationId);
  const [conversationListingId, setConversationListingId] = useState<string | null>(null);

  useEffect(() => {
    if (messagingLocked && canUnlock) {
      setShowUnlockModal(true);
    }
  }, [messagingLocked, canUnlock]);

  const handleUnlockConversation = async () => {
    if (!user) return;
    const result = await useFreeMessageUnlock(user.id, conversationId);
    if (result.success) {
      if (updateUser) {
        await updateUser({
          freeMessageUnlockUsed: true,
          freeMessageUnlockConversationId: conversationId,
          freeMessageUnlockUsedAt: new Date().toISOString(),
        });
      }
      setShowUnlockModal(false);
    }
  };

  useEffect(() => {
    loadMessages();
    StorageService.updateConversation(conversationId, { unread: 0 });
  }, [conversationId]);

  useEffect(() => {
    if (!isPaidUser && messages.length > 0) {
      const hasConfirmed = messages.some(
        (m: any) => ['accepted', 'confirmed'].includes(m.metadata?.status) && (m.message_type === 'visit_request' || m.message_type === 'booking_offer')
      );
      if (hasConfirmed && !hasBookingInThread) {
        setHasBookingInThread(true);
        const alreadyHasNotice = messages.some((m: any) => m.id === 'contact-unlock-notice');
        if (!alreadyHasNotice) {
          setMessages(prev => [...prev, {
            id: 'contact-unlock-notice',
            conversationId,
            senderId: 'system',
            text: 'Contact info is now visible in this conversation.',
            timestamp: new Date(),
            read: true,
            type: 'system',
          } as any]);
        }
      } else if (!hasConfirmed && hasBookingInThread) {
        setHasBookingInThread(false);
      }
    }
  }, [messages, isPaidUser]);

  useEffect(() => {
    setLinkedListing(null);
    setMyGroupRole(null);
    const isGroupChat = conversationId.startsWith('group-');
    if (isGroupChat && !isInquiryChat) {
      reloadGroupListing();
      const groupId = conversationId.replace('group-', '');
      supabase.from('groups').select('name').eq('id', groupId).maybeSingle()
        .then(({ data }) => { if (data?.name) setGroupName(data.name); })
        .catch(async () => {
          const groups = await StorageService.getGroups();
          const g = groups.find((gr: any) => gr.id === groupId);
          if (g?.name) setGroupName(g.name);
        });
      loadGroupMembers(groupId);
      if (user?.id) {
        supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', user.id).maybeSingle()
          .then(({ data }) => { if (data?.role) setMyGroupRole(data.role as 'admin' | 'member'); });
      }
    }

    if (isGroupChat && !isInquiryChat && user?.id) {
      const groupId = conversationId.replace('group-', '');
      getPinnedMessages(groupId).then(data => setPinnedMessages(data)).catch(() => {});
      getGroupMemberMuteStatus(groupId, user.id).then(muted => setIsGroupMuted(muted)).catch(() => {});
      getGroupSettings(groupId).then(s => setGroupChatSettings(s || {})).catch(() => {});
    }
  }, [conversationId, isInquiryChat, user?.id]);

  useEffect(() => {
    const isGroupChat = conversationId.startsWith('group-') && !isInquiryChat;
    if (!isGroupChat || groupMembers.length === 0) {
      setGroupOnlineCount(0);
      return;
    }
    let cancelled = false;
    const checkOnline = async () => {
      let count = 0;
      for (const m of groupMembers) {
        if (m.id === user?.id) { count++; continue; }
        try {
          const online = await isUserOnline(m.id);
          if (online) count++;
        } catch {}
      }
      if (!cancelled) setGroupOnlineCount(count);
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [conversationId, isInquiryChat, groupMembers.length]);

  useEffect(() => {
    const isGroupChat = conversationId.startsWith('group-') && !isInquiryChat;
    if (!isGroupChat || !user?.id || messages.length === 0) return;
    const groupId = conversationId.replace('group-', '');
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.id) {
      updateLastRead(groupId, user.id, lastMsg.id).catch(() => {});
    }
  }, [conversationId, isInquiryChat, user?.id, messages.length]);

  const reloadGroupListing = () => {
    const isGroupChat = conversationId.startsWith('group-');
    if (!isGroupChat || isInquiryChat) return;
    const groupId = conversationId.replace('group-', '');
    supabase
      .from('groups')
      .select('listing_id, listings ( id, title, address, city, state, rent, photos, status )')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.listing_id && data?.listings) {
          const listing = Array.isArray(data.listings) ? data.listings[0] : data.listings;
          if (listing) { setLinkedListing(listing); return; }
        }
        setLinkedListing(null);
      });
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, is_admin, users ( id, name, profile_picture, role, avatar_url )')
        .eq('group_id', groupId);
      if (!error && data && data.length > 0) {
        const members = data.map((m: any) => {
          const u = Array.isArray(m.users) ? m.users[0] : m.users;
          return {
            id: m.user_id,
            name: u?.name || 'Member',
            photo: u?.profile_picture || u?.avatar_url || null,
            role: u?.role || 'renter',
            groupRole: m.role,
            is_admin: m.is_admin || m.role === 'admin',
          };
        });
        setGroupMembers(members);
        return;
      }
    } catch (e) { console.warn('[ChatScreen] Supabase group members load failed:', e); }
    try {
      const groups = await StorageService.getGroups();
      const g = groups.find((gr: { id: string }) => gr.id === groupId);
      if (g?.members) {
        const users = await StorageService.getUsers();
        const profiles = await StorageService.getRoommateProfiles();
        const members = g.members.map((memberId: string) => {
          const u = users.find((usr: { id: string }) => usr.id === memberId);
          const p = profiles.find((pr: { id: string }) => pr.id === memberId);
          const photo = p?.photos?.[0] || p?.profilePicture || u?.profilePicture || u?.profileData?.photos?.[0] || null;
          return {
            id: memberId,
            name: p?.name || u?.name || u?.profileData?.name || 'Member',
            photo,
            role: u?.role || 'renter',
            groupRole: memberId === (g.createdBy || g.adminId) ? 'admin' : 'member',
          };
        });
        setGroupMembers(members);
      }
    } catch (e) { console.warn('[ChatScreen] Local group members load failed:', e); }
  };

  useEffect(() => {
    if (!conversationId.startsWith('group-')) return;
    const groupId = conversationId.replace('group-', '');
    let isMounted = true;
    const subscription = subscribeToGroupMessages(groupId, (newMsg: any) => {
      if (!isMounted) return;
      if (newMsg.senderId !== user?.id) {
        const mapped: Message = {
          id: newMsg.id,
          senderId: newMsg.senderId,
          senderName: newMsg.senderName,
          text: newMsg.content,
          content: newMsg.content,
          timestamp: new Date(newMsg.createdAt),
          read: true,
        } as any;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, mapped];
        });
        if (isNearBottom.current) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!matchIdFromConversation || conversationId.startsWith('group-') || conversationId.startsWith('conv-interest-')) return;
    let isMounted = true;
    const unsubscribe = subscribeToMessages(matchIdFromConversation, (newMsg: any) => {
      if (!isMounted) return;
      const isOwnMsg = newMsg.sender_id === user?.id && !newMsg.is_system_message;
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        const mapped: Message = {
          id: newMsg.id,
          senderId: newMsg.is_system_message ? 'system' : newMsg.sender_id,
          text: newMsg.content,
          content: newMsg.content,
          timestamp: new Date(newMsg.created_at),
          read: newMsg.read || false,
          readAt: newMsg.read_at ? new Date(newMsg.read_at) : undefined,
          message_type: newMsg.message_type || 'text',
          metadata: newMsg.metadata || undefined,
          reply_to_id: newMsg.reply_to_id || undefined,
          reply_to: newMsg.reply_to || undefined,
          edited_at: newMsg.edited_at || undefined,
          deleted_at: newMsg.deleted_at || undefined,
        };
        if (isOwnMsg) {
          const optimistic = prev.filter(m => !(m.id.startsWith('voice-') && m.senderId === user?.id && m.message_type === 'voice'));
          return [...optimistic, mapped];
        }
        return [...prev, mapped];
      });
      if (isNearBottom.current) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
      if (!isOwnMsg) {
        try { markSupabaseMessagesAsRead(user!.id, matchIdFromConversation); } catch (_e) {}
      }
    });
    return () => { isMounted = false; unsubscribe(); };
  }, [matchIdFromConversation, user?.id]);

  useEffect(() => {
    if (!user?.id || isInquiryChat) return;
    const matchIdForPresence = conversationId || routeMatchId;
    if (!matchIdForPresence) return;
    joinConversationTyping(matchIdForPresence, user.id);

    const unsub = subscribeToPresence(() => {
      const typers = getTypingUsers(matchIdForPresence);
      setOtherUserTyping(typers.length > 0);
    });

    return () => {
      leaveConversationTyping(matchIdForPresence);
      unsub();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, routeMatchId, user?.id, isInquiryChat]);

  useEffect(() => {
    if (highlightedId && messages.length > 0) {
      const index = messages.findIndex(m => m.id === highlightedId);
      if (index >= 0 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }, 300);
        setTimeout(() => setHighlightedId(null), 3000);
      }
    }
  }, [messages, highlightedId]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.matchId === conversationId || data?.groupId === inquiryGroup?.id) {
        Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    });
    return () => sub.remove();
  }, [conversationId, inquiryGroup?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      const msgIds = messages.map(m => m.id).filter(id => id && !id.startsWith('msg_') && !id.startsWith('sep-'));
      if (msgIds.length) {
        getReactions(msgIds).then(setReactionsMap).catch(() => {});
      }
    }
  }, [messages]);

  const processedMessages = useMemo(() => buildChatList(messages), [messages]);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    Haptics.selectionAsync();
    const existing = reactionsMap[messageId];
    const hasReacted = existing?.some(r => r.emoji === emoji && r.userIds.includes(user.id));
    try {
      if (hasReacted) {
        await removeReaction(messageId, user.id, emoji);
        setReactionsMap(prev => {
          const updated = { ...prev };
          if (updated[messageId]) {
            updated[messageId] = updated[messageId]
              .map(r => r.emoji === emoji ? { ...r, userIds: r.userIds.filter(u => u !== user.id), count: r.count - 1 } : r)
              .filter(r => r.count > 0);
          }
          return updated;
        });
      } else {
        await addReaction(messageId, user.id, emoji);
        setReactionsMap(prev => {
          const updated = { ...prev };
          if (!updated[messageId]) updated[messageId] = [];
          const ex = updated[messageId].find(r => r.emoji === emoji);
          if (ex) {
            updated[messageId] = updated[messageId].map(r =>
              r.emoji === emoji ? { ...r, userIds: [...r.userIds, user.id], count: r.count + 1 } : r
            );
          } else {
            updated[messageId] = [...updated[messageId], { emoji, userIds: [user.id], count: 1 }];
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Reaction toggle failed:', err);
    }
    setShowReactionBar(null);
  }, [user?.id, reactionsMap]);

  const handleLongPressMessage = useCallback((msg: Message) => {
    if ((msg as any).deleted_at) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMessageActions(msg);
  }, []);

  const handleReplyAction = useCallback((msg: Message) => {
    setReplyToMessage(msg);
    setActiveMessageActions(null);
  }, []);

  const handleCopyAction = useCallback(async (msg: Message) => {
    await Clipboard.setStringAsync(msg.text || msg.content || '');
    setActiveMessageActions(null);
  }, []);

  const handleDeleteAction = useCallback(async (msg: Message) => {
    if (!user?.id) return;
    const confirmed = await confirm({
      title: 'Delete Message',
      message: 'This message will be removed for everyone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      const isGroupSend = conversationId.startsWith('group-') && !isInquiryChat;
      if (isGroupSend) {
        await deleteGroupMessage(msg.id, user.id);
      } else {
        await deleteMessageService(msg.id, user.id);
      }
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, text: 'This message was deleted', content: 'This message was deleted', deleted_at: new Date().toISOString() } : m
      ));
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setActiveMessageActions(null);
  }, [user?.id, confirm, conversationId, isInquiryChat]);

  const handlePinAction = useCallback(async (msg: Message) => {
    if (!user?.id) return;
    const isGroupSend = conversationId.startsWith('group-') && !isInquiryChat;
    if (!isGroupSend) return;
    const groupId = conversationId.replace('group-', '');
    try {
      await pinMessage(groupId, msg.id, user.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = await getPinnedMessages(groupId);
      setPinnedMessages(updated);
    } catch (err) {
      console.error('Pin failed:', err);
    }
    setActiveMessageActions(null);
  }, [user?.id, conversationId, isInquiryChat]);

  const handleUnpinAction = useCallback(async (messageId: string) => {
    const isGroupSend = conversationId.startsWith('group-') && !isInquiryChat;
    if (!isGroupSend) return;
    const groupId = conversationId.replace('group-', '');
    try {
      await unpinMessage(groupId, messageId);
      const updated = await getPinnedMessages(groupId);
      setPinnedMessages(updated);
    } catch (err) {
      console.error('Unpin failed:', err);
    }
  }, [conversationId, isInquiryChat]);

  const handleAdminDeleteAction = useCallback(async (msg: Message) => {
    if (!user?.id) return;
    const isGroupSend = conversationId.startsWith('group-') && !isInquiryChat;
    if (!isGroupSend) return;
    const confirmed = await confirm({
      title: 'Remove Message',
      message: 'This message will be removed by an admin. This action cannot be undone.',
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;
    const groupId = conversationId.replace('group-', '');
    try {
      await adminDeleteGroupMessage(msg.id, groupId, user.id);
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, text: 'This message was removed by an admin', content: 'This message was removed by an admin', deleted_at: new Date().toISOString() } : m
      ));
    } catch (err) {
      console.error('Admin delete failed:', err);
    }
    setActiveMessageActions(null);
  }, [user?.id, confirm, conversationId, isInquiryChat]);

  const handleGroupMuteToggle = useCallback(async () => {
    if (!user?.id) return;
    const isGroupSend = conversationId.startsWith('group-') && !isInquiryChat;
    if (!isGroupSend) return;
    const groupId = conversationId.replace('group-', '');
    try {
      if (isGroupMuted) {
        await unmuteGroup(groupId, user.id);
        setIsGroupMuted(false);
      } else {
        await muteGroup(groupId, user.id);
        setIsGroupMuted(true);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Mute toggle failed:', err);
    }
  }, [user?.id, conversationId, isInquiryChat, isGroupMuted]);

  const handleEditAction = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditText(msg.text || msg.content || '');
    setActiveMessageActions(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !user?.id || !editText.trim()) return;
    try {
      const isGroupSend = conversationId.startsWith('group-') && !isInquiryChat;
      if (isGroupSend) {
        await editGroupMessage(editingMessageId, user.id, editText.trim());
      } else {
        await editMessageService(editingMessageId, user.id, editText.trim());
      }
      setMessages(prev => prev.map(m =>
        m.id === editingMessageId ? { ...m, text: editText.trim(), content: editText.trim(), edited_at: new Date().toISOString() } : m
      ));
    } catch (err) {
      console.error('Edit failed:', err);
    }
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, user?.id, editText, conversationId, isInquiryChat]);

  const handleStartRecording = useCallback(async () => {
    if (userPlan === 'basic') {
      setPaywallFeature('Voice Messages');
      setShowPaywall(true);
      return;
    }
    await startRecording();
  }, [userPlan, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording();
    if (result?.uri && user?.id && matchIdFromConversation) {
      try {
        const maxDuration = userPlan === 'elite' ? 300000 : 60000;
        if (result.durationMs > maxDuration) {
          await alert({ title: 'Too Long', message: `Voice messages are limited to ${userPlan === 'elite' ? '5' : '1'} minute(s).`, variant: 'warning' });
          return;
        }
        const voiceMsg: Message = {
          id: `voice-${Date.now()}`,
          senderId: user.id,
          text: '',
          content: '',
          timestamp: new Date(),
          read: false,
          message_type: 'voice',
          metadata: { voice_url: result.uri, duration_ms: result.durationMs },
        };
        setMessages(prev => [...prev, voiceMsg]);
        await sendVoiceMessage(user.id, matchIdFromConversation, result.uri, result.durationMs);
      } catch (err) {
        console.error('Voice send failed:', err);
      }
    }
  }, [stopRecording, user?.id, matchIdFromConversation, userPlan]);

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const canEditMessage = (msg: Message) => {
    if (userPlan === 'basic') return false;
    const windowMinutes = userPlan === 'elite' ? 30 : 15;
    const msgTime = new Date(msg.timestamp).getTime();
    return (Date.now() - msgTime) < windowMinutes * 60 * 1000;
  };

  const getMessageActions = useCallback((msg: Message) => {
    const isOwn = msg.senderId === user?.id;
    const isGroupChat = conversationId.startsWith('group-') && !isInquiryChat;
    const isAdmin = myGroupRole === 'admin' || groupMembers.find(m => m.id === user?.id)?.is_admin;
    const actions: { label: string; icon: string; onPress: () => void; destructive?: boolean }[] = [];
    actions.push({ label: 'Reply', icon: 'corner-up-left', onPress: () => handleReplyAction(msg) });
    actions.push({ label: 'Copy', icon: 'copy', onPress: () => handleCopyAction(msg) });
    if (isGroupChat && isAdmin && groupChatSettings.allowPinning !== false) {
      actions.push({ label: 'Pin', icon: 'bookmark', onPress: () => handlePinAction(msg) });
    }
    if (isOwn && canEditMessage(msg)) {
      actions.push({ label: 'Edit', icon: 'edit-2', onPress: () => handleEditAction(msg) });
    }
    if (isOwn) {
      actions.push({ label: 'Delete', icon: 'trash-2', onPress: () => handleDeleteAction(msg), destructive: true });
    }
    if (isGroupChat && isAdmin && !isOwn) {
      actions.push({ label: 'Remove', icon: 'shield-off', onPress: () => handleAdminDeleteAction(msg), destructive: true });
    }
    actions.push({ label: 'React', icon: 'smile', onPress: () => { setShowReactionBar(msg.id); setActiveMessageActions(null); } });
    return actions;
  }, [user?.id, userPlan, conversationId, isInquiryChat, myGroupRole, groupMembers, groupChatSettings, handleReplyAction, handleCopyAction, handleEditAction, handleDeleteAction, handlePinAction, handleAdminDeleteAction]);

  const handleTextChange = (text: string) => {
    setInputText(text);
    const matchIdForPresence = conversationId || routeMatchId;
    if (!matchIdForPresence) return;
    if (text.length > 0) {
      sendTypingIndicator(matchIdForPresence, true);
    } else {
      sendTypingIndicator(matchIdForPresence, false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await pickImage();
      if (!result || result.canceled || result.assets.length === 0) return;

      const assets = result.assets;
      const total = assets.length;
      uploadCancelledRef.current = false;

      setUploadingAttachment(true);
      setUploadProgress({ uploading: true, sent: 0, total, previewUri: assets[0].uri });

      const matchIdOrGroupId = matchIdFromConversation || conversationId;

      if (total === 1) {
        const asset = assets[0];
        const attachment = await uploadChatAttachment(
          user!.id, asset.uri, asset.fileName || `photo-${Date.now()}.jpg`, asset.mimeType || 'image/jpeg'
        );
        setUploadProgress(p => ({ ...p, sent: 1 }));
        if (uploadCancelledRef.current) return;
        const imgMeta = {
          url: attachment.url, filename: attachment.filename, mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes, thumbnailUrl: attachment.thumbnailUrl,
          width: attachment.width, height: attachment.height,
        };
        if (isInquiryChat) {
          const groupId = inquiryGroup?.id || conversationId.replace('inquiry_', '');
          await sendGroupMessage(user!.id, groupId, 'Sent a photo', 'image', imgMeta);
        } else {
          await sendStructuredMessage(user!.id, matchIdOrGroupId, 'image', imgMeta, 'Sent a photo');
        }
      } else {
        const uploaded: any[] = [];
        for (let i = 0; i < total; i++) {
          if (uploadCancelledRef.current) return;
          const asset = assets[i];
          const attachment = await uploadChatAttachment(
            user!.id, asset.uri, asset.fileName || `photo-${Date.now()}-${i}.jpg`, asset.mimeType || 'image/jpeg'
          );
          uploaded.push({
            url: attachment.url, filename: attachment.filename, mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes, thumbnailUrl: attachment.thumbnailUrl,
            width: attachment.width, height: attachment.height,
          });
          setUploadProgress(p => ({ ...p, sent: i + 1 }));
        }
        if (uploadCancelledRef.current) return;
        if (isInquiryChat) {
          const groupId = inquiryGroup?.id || conversationId.replace('inquiry_', '');
          await sendGroupMessage(user!.id, groupId, `Sent ${total} photos`, 'images', { images: uploaded });
        } else {
          await sendStructuredMessage(user!.id, matchIdOrGroupId, 'images', { images: uploaded }, `Sent ${total} photos`);
        }
      }
    } catch (err: any) {
      if (!uploadCancelledRef.current) {
        await alert({ title: 'Upload Failed', message: err.message || 'Could not upload the image.', variant: 'warning' });
      }
    } finally {
      setUploadingAttachment(false);
      setUploadProgress({ uploading: false, sent: 0, total: 0, previewUri: '' });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await takePhoto();
      if (!result || result.canceled) return;
      const asset = result.assets[0];
      setUploadingAttachment(true);
      setUploadProgress({ uploading: true, sent: 0, total: 1, previewUri: asset.uri });
      const attachment = await uploadChatAttachment(
        user!.id, asset.uri, `photo-${Date.now()}.jpg`, 'image/jpeg'
      );
      setUploadProgress(p => ({ ...p, sent: 1 }));
      const matchIdOrGroupId = matchIdFromConversation || conversationId;
      const photoMeta = {
        url: attachment.url, filename: attachment.filename, mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes, thumbnailUrl: attachment.thumbnailUrl,
        width: attachment.width, height: attachment.height,
      };
      if (isInquiryChat) {
        const groupId = inquiryGroup?.id || conversationId.replace('inquiry_', '');
        await sendGroupMessage(user!.id, groupId, 'Sent a photo', 'image', photoMeta);
      } else {
        await sendStructuredMessage(user!.id, matchIdOrGroupId, 'image', photoMeta, 'Sent a photo');
      }
    } catch (err: any) {
      await alert({ title: 'Upload Failed', message: err.message || 'Could not take the photo.', variant: 'warning' });
    } finally {
      setUploadingAttachment(false);
      setUploadProgress({ uploading: false, sent: 0, total: 0, previewUri: '' });
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await pickDocument();
      if (!result || result.canceled) return;
      const doc = result.assets[0];
      setUploadingAttachment(true);
      const attachment = await uploadChatAttachment(
        user!.id,
        doc.uri,
        doc.name || `file-${Date.now()}`,
        doc.mimeType || 'application/octet-stream'
      );
      const matchIdOrGroupId = matchIdFromConversation || conversationId;
      const fileMeta = { url: attachment.url, filename: attachment.filename, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes };
      if (isInquiryChat) {
        const groupId = inquiryGroup?.id || conversationId.replace('inquiry_', '');
        await sendGroupMessage(user!.id, groupId, `Sent a file: ${attachment.filename}`, 'file', fileMeta);
      } else {
        await sendStructuredMessage(user!.id, matchIdOrGroupId, 'file', fileMeta, `Sent a file: ${attachment.filename}`);
      }
    } catch (err: any) {
      await alert({ title: 'Upload Failed', message: err.message || 'Could not upload the file.', variant: 'warning' });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const loadMeetupSuggestion = async () => {
    if (isInquiryChat || conversationId.startsWith('group-')) return;
    try {
      const { data } = await supabase
        .from('meetup_suggestions')
        .select('*')
        .eq('conversation_id', conversationId)
        .neq('status', 'dismissed')
        .maybeSingle();

      if (data) {
        setMeetupSuggestion({
          id: data.id,
          suggestedVenueName: data.suggested_venue_name,
          suggestedVenueAddress: data.suggested_venue_address,
          suggestedVenueMapsUrl: data.suggested_venue_maps_url,
          midpointNeighborhood: data.midpoint_neighborhood,
          triggerType: data.trigger_type,
          status: data.status,
          user1Response: data.user_1_response,
          user2Response: data.user_2_response,
          userId1: data.user_id_1,
          userId2: data.user_id_2,
        });
      }
    } catch (_e) {}
  };

  useEffect(() => { loadMeetupSuggestion(); }, [conversationId]);

  useEffect(() => {
    if (isInquiryChat || conversationId.startsWith('group-')) return;
    const channel = supabase
      .channel(`meetup_${conversationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'meetup_suggestions',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload: any) => {
        const d = payload.new;
        setMeetupSuggestion((prev: any) => prev ? {
          ...prev,
          status: d.status,
          user1Response: d.user_1_response,
          user2Response: d.user_2_response,
        } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const lastAnalyzeRef = useRef<number>(0);

  const analyzeIntentAfterMessage = async () => {
    if (isInquiryChat || conversationId.startsWith('group-')) return;
    if (meetupSuggestion) return;
    if (!otherUser) return;
    if (messages.length < 6) return;
    const now = Date.now();
    if (now - lastAnalyzeRef.current < 5 * 60 * 1000) return;
    if (messages.length % 6 !== 0) return;

    lastAnalyzeRef.current = now;

    try {
      const sortedIds = [otherUser.id, user!.id].sort();
      const response = await supabase.functions.invoke('analyze-chat-intent', {
        body: {
          conversationId,
          userId1: sortedIds[0],
          userId2: sortedIds[1],
          messages: messages.slice(-15).map(m => ({
            content: m.text || m.content || '',
            senderName: m.senderId === user!.id ? 'Me' : (otherUser.name || 'Them'),
          })),
        },
      });
      if (response?.data?.leakageDetected) {
        setLeakageDetected(true);
      }
      await loadMeetupSuggestion();
    } catch (_e) {
      console.log('Intent analysis skipped');
    }
  };

  const loadMessages = async () => {
    let supabaseMessages: Message[] = [];
    let loadedFromSupabase = false;

    const isGroupChatLoad = conversationId.startsWith('group-');

    try {
      if (isGroupChatLoad) {
        const groupId = conversationId.replace('group-', '');
        const groupMsgs = await getGroupMessages(groupId);
        if (groupMsgs && groupMsgs.length > 0) {
          supabaseMessages = groupMsgs.map((msg: any) => ({
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            text: msg.content,
            content: msg.content,
            timestamp: new Date(msg.createdAt),
            read: true,
          }));
          loadedFromSupabase = true;
          try {
            const { markGroupMessagesAsRead } = await import('../../services/groupService');
            await markGroupMessagesAsRead(user?.id || '', groupId);
          } catch (_markErr) {
            console.warn('[Chat] Failed to mark group messages as read:', _markErr);
          }
        }
      } else {
        const supaMessages = await getSupabaseMessages(matchIdFromConversation);
        if (supaMessages && supaMessages.length > 0) {
          supabaseMessages = supaMessages.map((msg: any) => ({
            id: msg.id,
            senderId: msg.is_system_message ? 'system' : msg.sender_id,
            text: msg.content,
            content: msg.content,
            timestamp: new Date(msg.created_at),
            read: msg.read || false,
            readAt: msg.read_at ? new Date(msg.read_at) : undefined,
            message_type: msg.message_type || 'text',
            metadata: msg.metadata || undefined,
            reply_to_id: msg.reply_to_id || undefined,
            reply_to: msg.reply_to || undefined,
            edited_at: msg.edited_at || undefined,
            deleted_at: msg.deleted_at || undefined,
          }));
          loadedFromSupabase = true;
          try { markSupabaseMessagesAsRead(user!.id, matchIdFromConversation); } catch (_e) {}
        }
      }
    } catch (supaError) {
      console.warn('Supabase getMessages failed, falling back to StorageService:', supaError);
    }

    const conversations = await StorageService.getConversations();
    const conversation = conversations.find(c => c.id === conversationId);
    const localMessages: Message[] = (conversation?.messages || []).map((msg: Message) => {
      if (msg.senderId === user?.id && !msg.readAt && msg.read !== false) {
        return { ...msg, readAt: new Date(new Date(msg.timestamp).getTime() + 60000) };
      }
      return msg;
    });

    let loadedMessages: Message[];

    if (loadedFromSupabase) {
      const supabaseIds = new Set(supabaseMessages.map(m => m.id));
      const localOnly = localMessages.filter(m => !supabaseIds.has(m.id));
      loadedMessages = [...localOnly, ...supabaseMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } else {
      loadedMessages = localMessages;
    }

    setMessages(loadedMessages);

    if (conversation?.propertyId && !conversationListingId) {
      setConversationListingId(conversation.propertyId);
    }
    if (conversationId.startsWith('conv-interest-') && conversation?.inquiryId) {
      try {
        const cards = await StorageService.getInterestCards();
        const card = cards.find(c => c.id === conversation.inquiryId);
        if (card?.status === 'accepted' && conversation.inquiryStatus === 'pending') {
          await StorageService.updateConversation(conversationId, {
            inquiryStatus: 'accepted',
            lastMessage: 'Interest accepted! You can now message each other.',
          });
          setInquiryStatus('accepted');
          const hasAcceptedMsg = loadedMessages.some(m =>
            m.senderId === 'system' && m.text?.includes('accepted')
          );
          if (!hasAcceptedMsg) {
            const acceptMsg: Message = {
              id: `msg-sync-accept-${Date.now()}`,
              senderId: 'system',
              text: 'Interest accepted! You can now message each other.',
              content: 'Interest accepted! You can now message each other.',
              timestamp: new Date(),
              read: true,
            };
            setMessages(prev => [...prev, acceptMsg]);
          }
        }
      } catch (_e) {}
    }

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

    if (otherUser || conversation?.participant?.id) {
      const participantId = otherUser?.id || conversation?.participant?.id;
      if (participantId) {
        setIsOnline(isUserOnline(participantId));
      }
    }

    if (conversation?.participant) {
      const allUsers = await StorageService.getUsers();
      const participantUser = allUsers.find(u => u.id === conversation.participant.id);
      if (participantUser) {
        setOtherUserPlan(participantUser.subscription?.plan);
      }
      const hostId = inquiryGroup?.hostId;
      if (hostId) {
        const hostUser = allUsers.find(u => u.id === hostId);
        if (hostUser) {
          const hostType = hostUser.hostType || 'individual';
          setChatHostInfo({
            name: hostUser.full_name || hostUser.name,
            hostType,
            isVerifiedAgent: hostType === 'agent' && !!hostUser.licenseVerified,
            companyName: hostUser.companyName || undefined,
            companyId: (hostUser as any).company_id || undefined,
            licenseNumber: (hostUser as any).licenseNumber || undefined,
          });
        }
      }
    }
    if (isGroupChatLoad && inquiryGroup?.members) {
      setChatGroupSize(inquiryGroup.members.length);
      const myMember = inquiryGroup.members.find((m: any) => m.userId === user?.id);
      setIsGroupLeader(myMember?.role === 'admin');
    }

    if (isInquiryChat && conversation) {
      const lastRenter = (conversation as any).last_renter_message_at;
      const lastAgent = (conversation as any).last_agent_response_at;
      if (lastRenter) {
        const renterTime = new Date(lastRenter).getTime();
        const agentTime = lastAgent ? new Date(lastAgent).getTime() : 0;
        if (agentTime < renterTime) {
          setResponseDelayHours(getHoursSinceMessage(lastRenter));
        } else {
          setResponseDelayHours(0);
        }
      } else {
        setResponseDelayHours(0);
      }
    } else {
      setResponseDelayHours(0);
    }
    setRequestedDifferentAgent(false);

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
        const coldCheck = await canSendColdMessage();
        setColdMessagesRemaining(coldCheck.remaining === Infinity ? 999 : coldCheck.remaining);
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user) return;

    if (!requireVerification(user.emailVerified, 'messaging')) return;

    const isRenterChat = user.role !== 'host' && !isInquiryChat;
    if (isRenterChat && !gateStatus.canMessage) {
      setGateModal({ visible: true, feature: 'Messaging', requiredTier: 'gold' });
      return;
    }

    if (messagingLocked) {
      if (canUnlock) {
        setShowUnlockModal(true);
      } else {
        alert({
          title: 'Messaging Locked',
          message: `Upgrade to ${upgradePlan.plan} (${upgradePlan.price}) to send messages.`,
        });
      }
      return;
    }

    if (isColdMessage && !coldMessageResponded) {
      const coldCheck = await canSendColdMessage();
      if (!coldCheck.canSend) {
        const shouldUpgrade = await confirm({
          title: 'Daily Limit Reached',
          message: coldCheck.reason || "You've used all your messages for today. Resets at midnight.",
          confirmText: 'Upgrade for More',
          cancelText: 'OK',
          variant: 'warning',
        });
        if (shouldUpgrade) {
          setPaywallFeature('More Messages');
          setShowPaywall(true);
        }
        return;
      }
    }

    if (!canSendMessage()) {
      setUpgradePromptData(getUpgradePromptData('message_limit_reached', userPlan, {
        used: dailyCount, limit: dailyLimit,
      }));
      setShowDailyLimitModal(true);
      return;
    }
    if (dailyLimit > 0 && dailyCount >= dailyLimit * 0.8 && dailyCount < dailyLimit && !upgradePromptData) {
      shouldShowUpgradePrompt('message_limit_approaching').then(canShow => {
        if (canShow) {
          setUpgradePromptData(getUpgradePromptData('message_limit_approaching', userPlan, {
            used: dailyCount, limit: dailyLimit,
          }));
        }
      });
    }

    const conversations = await StorageService.getConversations();
    let conversationIndex = conversations.findIndex(c => c.id === conversationId);

    if (conversationIndex < 0) {
      const newConversation: any = {
        id: conversationId,
        participant: otherUser
          ? {
              id: otherUser.id,
              name: otherUser.name,
              photo: otherUser.photos?.[0] || otherUser.profilePicture || '',
              online: false,
            }
          : { id: '', name: conversationId.startsWith('group-') ? groupName : 'Unknown', photo: '', online: false },
        participants: otherUser ? [user.id, otherUser.id] : [user.id],
        messages: [],
        lastMessage: '',
        timestamp: new Date(),
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        isInquiryThread: inquiryGroup?.isInquiryThread || false,
        isSuperInterest: inquiryGroup?.isSuperInterest || false,
        inquiryStatus: inquiryGroup?.inquiryStatus || undefined,
        listingTitle: inquiryGroup?.listingTitle || undefined,
        listingPhoto: inquiryGroup?.listingPhoto || undefined,
        listingPrice: inquiryGroup?.listingPrice || undefined,
        hostId: inquiryGroup?.hostId || undefined,
        hostName: inquiryGroup?.hostName || undefined,
      };
      conversations.push(newConversation);
      conversationIndex = conversations.length - 1;
      await StorageService.setConversations(conversations);
    }

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
    const isGroupSend = conversationId.startsWith('group-');

    try {
      if (isGroupSend) {
        const groupId = conversationId.replace('group-', '');
        if (mentionedUserIds.length > 0 || replyToMessage) {
          await sendGroupMessageWithMentions(user!.id, groupId, inputText.trim(), mentionedUserIds, replyToMessage?.id);
        } else {
          await sendGroupMessage(user!.id, groupId, inputText.trim());
        }
        setMentionedUserIds([]);
        newMessage = {
          id: `msg_${Date.now()}`,
          senderId: user.id,
          senderName: user.name || user.email || 'You',
          text: inputText.trim(),
          content: inputText.trim(),
          timestamp: new Date(),
          read: true,
        } as any;
        sentViaSupabase = true;
      } else {
        let supaMsg;
        if (replyToMessage) {
          supaMsg = await sendReplyMessage(user!.id, matchIdFromConversation, inputText.trim(), replyToMessage.id);
        } else {
          supaMsg = await sendSupabaseMessage(user!.id, matchIdFromConversation, inputText.trim());
        }
        newMessage = {
          id: supaMsg.id,
          senderId: supaMsg.sender_id,
          text: supaMsg.content,
          content: supaMsg.content,
          timestamp: new Date(supaMsg.created_at),
          read: false,
          reply_to_id: replyToMessage?.id,
          reply_to: replyToMessage ? { id: replyToMessage.id, content: replyToMessage.text || replyToMessage.content || '', sender_id: replyToMessage.senderId } : undefined,
        };
        sentViaSupabase = true;
      }
    } catch (supaError) {
      console.warn('Supabase sendMessage failed, falling back to StorageService:', supaError);
      newMessage = {
        id: `msg_${Date.now()}`,
        senderId: user.id,
        text: inputText.trim(),
        content: inputText.trim(),
        timestamp: new Date(),
        read: false,
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
    recordMessageActivity(conversationId).catch(() => {});

    if (isInquiryChat && inquiryGroup?.hostId) {
      if (user.id === inquiryGroup.hostId) {
        updateAgentResponseTimestamp(conversationId).catch(() => {});
        setResponseDelayHours(0);
      } else {
        updateRenterMessageTimestamp(conversationId).catch(() => {});
      }
    }

    if (isFirstMessageFromUser) {
      await incrementActiveChatCount(conversationId);
      if (isColdMessage && !coldMessageResponded) {
        await useColdMessage();
        await incrementDailyColdMessageCount(user.id);
        conversations[conversationIndex].matchType = 'cold';
        await StorageService.setConversations(conversations);
        const updatedColdCheck = await canSendColdMessage();
        setColdMessagesRemaining(updatedColdCheck.remaining === Infinity ? 999 : updatedColdCheck.remaining);
      }
    }

    const otherParticipantId = conversations[conversationIndex].participants?.find(
      (p: string) => p !== user.id
    ) || conversations[conversationIndex].participant?.id;
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

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setReplyToMessage(null);
    const matchIdForPresence = conversationId || routeMatchId;
    if (matchIdForPresence) sendTypingIndicator(matchIdForPresence, false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    analyzeIntentAfterMessage().catch(() => {});
  };

  const handleCreateGroup = () => {
    if (!otherUser) return;
    navigation.navigate('CreateGroup', {
      matchedUserId: otherUser.id,
      matchedUserName: otherUser.name,
    });
  };

  const handleSendVisitRequest = async (data: { proposedDate: string; proposedTime: string; note: string }) => {
    if (!user) return;
    const address = addressRevealed
      ? (inquiryGroup?.listingAddress || 'Address pending')
      : (inquiryGroup?.listingAddress?.split(',').slice(-2).join(',').trim() || 'Address pending');
    try {
      const metadata = {
        proposed_date: data.proposedDate,
        proposed_time: data.proposedTime,
        note: data.note,
        address,
        listing_id: inquiryGroup?.listingId,
        status: 'pending',
        sender_name: user.name || 'User',
      };
      const displayContent = `Visit request for ${address} on ${data.proposedDate}`;
      let dbId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      try {
        const result = await sendStructuredMessage(
          matchIdFromConversation || conversationId,
          'visit_request',
          metadata,
          displayContent
        );
        if (result?.id) dbId = result.id;
      } catch (_e) {}
      if (counterProposalMessageId) {
        try {
          await updateMessageMetadata(counterProposalMessageId, { status: 'counter_proposed' });
          setMessages(prev => prev.map(m =>
            m.id === counterProposalMessageId
              ? { ...m, metadata: { ...(m as any).metadata, status: 'counter_proposed' } }
              : m
          ));
        } catch (_e) {}
        setCounterProposalMessageId(null);
      }
      const newMsg: Message = {
        id: dbId,
        senderId: user.id,
        text: displayContent,
        content: displayContent,
        timestamp: new Date(),
        read: false,
        message_type: 'visit_request',
        metadata,
      };
      setMessages(prev => [...prev, newMsg]);
      setShowVisitModal(false);
    } catch (err) {
      console.error('Failed to send visit request:', err);
      await alert({ title: 'Error', message: 'Failed to send visit request. Please try again.' });
    }
  };

  const handleSendBookingOffer = async (data: {
    moveInDate: string; leaseLength: string; monthlyRent: number; securityDeposit: number; note: string;
  }) => {
    if (!user) return;
    const address = inquiryGroup?.listingAddress || 'Property';
    try {
      const metadata = {
        move_in_date: data.moveInDate,
        lease_length: data.leaseLength,
        monthly_rent: data.monthlyRent,
        security_deposit: data.securityDeposit,
        note: data.note,
        address,
        listing_id: inquiryGroup?.listingId ?? conversationListingId ?? null,
        status: 'pending',
        sender_name: user.name || 'Host',
      };
      if (!metadata.listing_id) {
        await alert({ title: 'Missing Listing', message: 'Please select a listing for this booking offer.', variant: 'warning' });
        return;
      }
      const displayContent = `Booking offer: $${data.monthlyRent}/mo, move-in ${data.moveInDate}`;
      let dbId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      try {
        const result = await sendStructuredMessage(
          matchIdFromConversation || conversationId,
          'booking_offer',
          metadata,
          displayContent
        );
        if (result?.id) dbId = result.id;
      } catch (_e) {}
      const newMsg: Message = {
        id: dbId,
        senderId: user.id,
        text: displayContent,
        content: displayContent,
        timestamp: new Date(),
        read: false,
        message_type: 'booking_offer',
        metadata,
      };
      setMessages(prev => [...prev, newMsg]);
      setShowBookingModal(false);
    } catch (err) {
      console.error('Failed to send booking offer:', err);
      await alert({ title: 'Error', message: 'Failed to send booking offer. Please try again.' });
    }
  };

  const handleConfirmVisit = async (messageId: string) => {
    setCardActionLoading(messageId);
    try {
      await updateMessageMetadata(messageId, { status: 'confirmed' });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, metadata: { ...(m as any).metadata, status: 'confirmed' } } : m
      ));
    } catch (err) {
      console.error('Failed to confirm visit:', err);
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleDeclineVisit = async (messageId: string) => {
    setCardActionLoading(messageId);
    try {
      await updateMessageMetadata(messageId, { status: 'declined' });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, metadata: { ...(m as any).metadata, status: 'declined' } } : m
      ));
    } catch (err) {
      console.error('Failed to decline visit:', err);
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleProposeNewTime = (messageId: string, _metadata: any) => {
    setCounterProposalMessageId(messageId);
    setShowVisitModal(true);
  };

  const handleAcceptBooking = async (messageId: string, metadata: any) => {
    setCardActionLoading(messageId);
    try {
      const monthlyRent = Number(metadata.monthly_rent);
      const securityDeposit = metadata.security_deposit ? Number(metadata.security_deposit) : null;
      const leaseLength = Number(metadata.lease_length);

      if (isNaN(monthlyRent) || monthlyRent <= 0 || monthlyRent > 50000) {
        await alert({ title: 'Invalid Data', message: 'Monthly rent is invalid.' });
        return;
      }
      if (isNaN(leaseLength) || leaseLength < 1 || leaseLength > 36) {
        await alert({ title: 'Invalid Data', message: 'Lease length is invalid.' });
        return;
      }
      if (securityDeposit !== null && (isNaN(securityDeposit) || securityDeposit < 0)) {
        await alert({ title: 'Invalid Data', message: 'Security deposit is invalid.' });
        return;
      }

      const bookingHostId = inquiryGroup?.hostId ?? otherUser?.id;
      const bookingListingId = metadata.listing_id || inquiryGroup?.listingId || conversationListingId;

      if (!bookingHostId) {
        await alert({ title: 'Error', message: 'Cannot determine listing host.' });
        return;
      }
      if (!bookingListingId) {
        await alert({ title: 'Error', message: 'No listing associated with this conversation.' });
        return;
      }

      if (bookingListingId && bookingHostId) {
        const bookingResult = await createBooking({
          listingId: bookingListingId,
          hostId: bookingHostId,
          renterId: user?.id || '',
          moveInDate: metadata.move_in_date,
          leaseLength,
          monthlyRent,
          securityDeposit,
          groupId: chatGroupSize > 1 ? inquiryGroup?.id : null,
        });
        if (!bookingResult.success) {
          await alert({ title: 'Error', message: bookingResult.error || 'Failed to create booking.' });
          return;
        }
      }
      await updateMessageMetadata(messageId, { status: 'accepted' });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, metadata: { ...(m as any).metadata, status: 'accepted' } } : m
      ));
    } catch (err) {
      console.error('Failed to accept booking:', err);
      await alert({ title: 'Error', message: 'Something went wrong. Please try again.' });
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleDeclineBooking = async (messageId: string) => {
    setCardActionLoading(messageId);
    try {
      await updateMessageMetadata(messageId, { status: 'declined' });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, metadata: { ...(m as any).metadata, status: 'declined' } } : m
      ));
    } catch (err) {
      console.error('Failed to decline booking:', err);
    } finally {
      setCardActionLoading(null);
    }
  };

  const renderChatItem = ({ item }: { item: ChatListItem }) => {
    if ((item as DateSeparatorItem).type === 'date_separator') {
      const sep = item as DateSeparatorItem;
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateSeparatorPill}>
            <Text style={styles.dateSeparatorText}>{sep.date}</Text>
          </View>
        </View>
      );
    }

    const msg = item as Message & { isLastInCluster?: boolean; isFirstInCluster?: boolean };

    if (msg.senderId === 'system' || msg.senderId === null || (msg as any).is_system_message) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <ThemedText style={styles.systemMessageText}>{msg.text}</ThemedText>
          </View>
        </View>
      );
    }

    const msgType = (msg as any).message_type;
    const isOwnMsg = msg.senderId === user?.id;

    if (msgType === 'image' && (msg as any).metadata?.url) {
      const imgMeta = (msg as any).metadata;
      const imagesList = [{ url: imgMeta.url, thumbnailUrl: imgMeta.thumbnailUrl }];
      return (
        <Pressable onLongPress={() => handleLongPressMessage(msg)} style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <ChatImageMessage
            images={imagesList}
            isMine={isOwnMsg}
            timestamp={msg.timestamp?.toString() || new Date().toISOString()}
            onOpenGallery={(idx) => {
              setGalleryImages(imagesList.map(i => ({ url: i.url, createdAt: msg.timestamp?.toString() })));
              setGalleryInitialIndex(idx);
              setGalleryVisible(true);
            }}
          />
        </Pressable>
      );
    }

    if (msgType === 'images' && (msg as any).metadata?.images) {
      const imagesList = (msg as any).metadata.images as { url: string; thumbnailUrl?: string }[];
      return (
        <Pressable onLongPress={() => handleLongPressMessage(msg)} style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <ChatImageMessage
            images={imagesList}
            isMine={isOwnMsg}
            timestamp={msg.timestamp?.toString() || new Date().toISOString()}
            onOpenGallery={(idx) => {
              setGalleryImages(imagesList.map(i => ({ url: i.url, createdAt: msg.timestamp?.toString() })));
              setGalleryInitialIndex(idx);
              setGalleryVisible(true);
            }}
          />
        </Pressable>
      );
    }

    if (msgType === 'file' && (msg as any).metadata?.url) {
      return (
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <ChatFileMessage
            url={(msg as any).metadata.url}
            filename={(msg as any).metadata.filename || 'File'}
            mimeType={(msg as any).metadata.mimeType || ''}
            sizeBytes={(msg as any).metadata.sizeBytes || 0}
            isMine={isOwnMsg}
            timestamp={msg.timestamp?.toString() || new Date().toISOString()}
          />
        </View>
      );
    }

    if (msgType === 'visit_request' || msgType === 'booking_offer') {
      if (messagingLocked) {
        return (
          <View style={{ opacity: 0.3, overflow: 'hidden' }}>
            <ChatActionCard
              message={msg}
              currentUserId={user?.id || ''}
              onConfirmVisit={() => {}}
              onDeclineVisit={() => {}}
              onProposeNewTime={() => {}}
              onAcceptBooking={() => {}}
              onDeclineBooking={() => {}}
              actionLoading={false}
              agentInfo={chatHostInfo}
              groupSize={chatGroupSize}
              isGroupLeader={isGroupLeader}
            />
          </View>
        );
      }
      return (
        <ChatActionCard
          message={msg}
          currentUserId={user?.id || ''}
          onConfirmVisit={handleConfirmVisit}
          onDeclineVisit={handleDeclineVisit}
          onProposeNewTime={handleProposeNewTime}
          onAcceptBooking={handleAcceptBooking}
          onDeclineBooking={handleDeclineBooking}
          actionLoading={cardActionLoading}
          agentInfo={chatHostInfo}
          groupSize={chatGroupSize}
          isGroupLeader={isGroupLeader}
        />
      );
    }

    const isOwnMessage = msg.senderId === user?.id;
    const showReadReceipt = isOwnMessage && isEliteUser();
    const showLockedReceipt = isOwnMessage && showLockedReadReceipt;
    const isRead = msg.readAt || msg.read;
    const isHostMessage = isInquiryChat && inquiryGroup?.hostId && msg.senderId === inquiryGroup.hostId;
    const isHighlighted = msg.id === highlightedId;
    const isDeleted = !!(msg as any).deleted_at;
    const isEdited = !!(msg as any).edited_at;
    const replyTo = (msg as any).reply_to;
    const msgReactions = reactionsMap[msg.id] || ((msg as any).reactions?.length ? (() => {
      const grouped: { emoji: string; userIds: string[]; count: number }[] = [];
      ((msg as any).reactions || []).forEach((r: any) => {
        const ex = grouped.find(g => g.emoji === r.emoji);
        if (ex) { ex.userIds.push(r.user_id); ex.count++; }
        else grouped.push({ emoji: r.emoji, userIds: [r.user_id], count: 1 });
      });
      return grouped;
    })() : []);
    const isFirstInCluster = (msg as any).isFirstInCluster !== false;
    const isLastInCluster = (msg as any).isLastInCluster !== false;
    const messageText = msg.text || msg.content || '';
    const urls = (userPlan !== 'basic' && !isDeleted) ? extractUrls(messageText) : [];
    const isVoice = msgType === 'voice' && (msg as any).metadata?.audioUrl;

    const bubbleRadius = isOwnMessage
      ? { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: isLastInCluster ? 4 : 18 }
      : { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: isLastInCluster ? 4 : 18 };

    const bubbleContent = (
      <Pressable
        onLongPress={() => !isDeleted && handleLongPressMessage(msg)}
        delayLongPress={300}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
          !isFirstInCluster ? { marginTop: 2, marginBottom: 0 } : null,
          isHighlighted ? { backgroundColor: 'rgba(255,107,91,0.12)', borderRadius: 16, padding: 4 } : null,
        ]}
      >
        {isHostMessage && !isOwnMessage && isFirstInCluster ? (
          <View style={[
            styles.hostBadge,
            chatHostInfo?.hostType === 'agent'
              ? { borderLeftColor: '#3b82f6' }
              : chatHostInfo?.hostType === 'company'
                ? { borderLeftColor: '#a855f7' }
                : null,
          ]}>
            <Feather
              name={
                chatHostInfo?.hostType === 'agent' ? 'briefcase'
                : chatHostInfo?.hostType === 'company' ? 'building'
                : 'home'
              }
              size={10}
              color={
                chatHostInfo?.hostType === 'agent' ? '#3b82f6'
                : chatHostInfo?.hostType === 'company' ? '#a855f7'
                : '#ff6b5b'
              }
            />
            <ThemedText style={[
              styles.hostBadgeText,
              chatHostInfo?.hostType === 'agent'
                ? { color: '#3b82f6' }
                : chatHostInfo?.hostType === 'company'
                  ? { color: '#a855f7' }
                  : null,
            ]}>
              {chatHostInfo?.hostType === 'agent' ? 'Agent'
                : chatHostInfo?.hostType === 'company' ? 'Property Mgmt'
                : 'Host'}
            </ThemedText>
          </View>
        ) : null}
        {isGroupChat && !isInquiryChat && !isOwnMessage && isFirstInCluster ? (
          <Text style={{ fontSize: 12, fontWeight: '700', color: getNameColor(msg.senderId), marginBottom: 2 }}>
            {msg.senderName || groupMembers.find(m => m.id === msg.senderId)?.name || 'Member'}
          </Text>
        ) : null}

        {replyTo && !isDeleted ? (
          <Pressable
            style={styles.replyPreview}
            onPress={() => {
              const idx = messages.findIndex(m => m.id === replyTo.id);
              if (idx >= 0) {
                setHighlightedId(replyTo.id);
                flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                setTimeout(() => setHighlightedId(null), 3000);
              }
            }}
          >
            <Text style={styles.replyPreviewName}>
              {replyTo.sender_id === user?.id ? 'You' : (otherUser?.name?.split(' ')[0] || 'Them')}
            </Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {(replyTo.content || '').slice(0, 80)}
            </Text>
          </Pressable>
        ) : null}

        {editingMessageId === msg.id ? (
          <View style={[styles.messageBubble, { backgroundColor: theme.backgroundSecondary, ...bubbleRadius }]}>
            <TextInput
              style={[Typography.body, { color: theme.text, padding: 0 }]}
              value={editText}
              onChangeText={setEditText}
              autoFocus
              multiline
              onSubmitEditing={handleSaveEdit}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Pressable onPress={() => setEditingMessageId(null)}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveEdit}>
                <Text style={{ color: '#ff6b5b', fontSize: 12, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : isDeleted ? (
          <View style={[styles.messageBubble, { backgroundColor: 'rgba(255,255,255,0.04)', ...bubbleRadius }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="slash" size={12} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontStyle: 'italic' }}>
                This message was deleted
              </Text>
            </View>
          </View>
        ) : isVoice ? (
          <VoiceMessageBubble
            audioUrl={(msg as any).metadata.audioUrl}
            durationMs={(msg as any).metadata.durationMs || 0}
            isOwnMessage={isOwnMessage}
          />
        ) : (
          <View
            style={[
              styles.messageBubble,
              bubbleRadius,
              {
                backgroundColor: isOwnMessage
                  ? theme.primary
                  : isHostMessage
                    ? chatHostInfo?.hostType === 'agent'
                      ? 'rgba(59,130,246,0.12)'
                      : chatHostInfo?.hostType === 'company'
                        ? 'rgba(168,85,247,0.12)'
                        : 'rgba(255,107,91,0.15)'
                    : theme.backgroundSecondary,
              },
              isHostMessage && !isOwnMessage ? {
                borderLeftWidth: 3,
                borderLeftColor: chatHostInfo?.hostType === 'agent' ? '#3b82f6'
                  : chatHostInfo?.hostType === 'company' ? '#a855f7'
                  : '#ff6b5b',
              } : null,
            ]}
          >
            <SafeMessageText
              text={messageText}
              safetyMode={!contactInfoVisible && !isOwnMessage}
              style={[Typography.body, { color: isOwnMessage ? '#FFFFFF' : theme.text }]}
              onUpgradePress={() => navigation.navigate('Plans' as any)}
              onBookShowingPress={isInquiryChat ? () => setShowVisitModal(true) : undefined}
            />
            {urls.length > 0 ? <LinkPreviewCard url={urls[0]} /> : null}
          </View>
        )}

        {showReactionBar === msg.id ? (
          <Animated.View entering={FadeIn.duration(150)} style={[styles.reactionBar, isOwnMessage ? { right: 0 } : { left: 0 }]}>
            {QUICK_REACTIONS.map(emoji => (
              <Pressable
                key={emoji}
                style={styles.reactionBarEmoji}
                onPress={() => handleToggleReaction(msg.id, emoji)}
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.reactionBarEmoji, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => { setEmojiPickerTargetId(msg.id); setShowEmojiPicker(true); setShowReactionBar(null); }}
            >
              <Feather name="plus" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </Animated.View>
        ) : null}

        {msgReactions.length > 0 && !isDeleted ? (
          <View style={styles.reactionContainer}>
            {msgReactions.map((r: any) => {
              const isMine = r.userIds.includes(user?.id);
              return (
                <Pressable
                  key={r.emoji}
                  style={[styles.reactionPill, isMine ? styles.reactionPillActive : null]}
                  onPress={() => handleToggleReaction(msg.id, r.emoji)}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  {r.count > 1 ? <Text style={styles.reactionCount}>{r.count}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {isLastInCluster && !isDeleted ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 }}>
            {showReadReceipt ? (
              <View style={styles.readReceiptContainer}>
                <Feather name="check" size={12} color={isRead ? theme.primary : theme.textSecondary} />
                {isRead ? <Feather name="check" size={12} color={theme.primary} style={{ marginLeft: -6 }} /> : null}
                <ThemedText style={[Typography.caption, { color: isRead ? theme.primary : theme.textSecondary, marginLeft: 2, fontSize: 10 }]}>
                  {isRead ? 'Read' : 'Sent'}
                </ThemedText>
              </View>
            ) : showLockedReceipt ? (
              <Pressable
                style={styles.readReceiptContainer}
                onPress={() => { setPaywallFeature('Read Receipts'); setShowPaywall(true); }}
              >
                <Feather name="check" size={12} color="rgba(255,255,255,0.2)" />
                <PlanBadgeInline plan="Elite" locked />
              </Pressable>
            ) : null}
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
              {formatTime(new Date(msg.timestamp))}
            </Text>
            {isEdited ? <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>(edited)</Text> : null}
          </View>
        ) : null}
      </Pressable>
    );

    if (messagingLocked) {
      return (
        <View style={styles.blurredMessageWrapper}>
          {bubbleContent}
          <View style={styles.messageBlurOverlay} />
        </View>
      );
    }

    return bubbleContent;
  };

  const isGroupChat = conversationId.startsWith('group-');
  if (!otherUser && !isInquiryChat && !isGroupChat) {
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
          <View style={[styles.header, { backgroundColor: inquiryGroup?.isSuperInterest ? 'rgba(255,215,0,0.06)' : 'rgba(255,107,91,0.06)', paddingTop: insets.top + Spacing.lg }]}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={[styles.headerCenter, { flex: 1 }]}>
              <Feather name={inquiryGroup?.isSuperInterest ? 'star' : 'home'} size={18} color={inquiryGroup?.isSuperInterest ? '#FFD700' : '#ff6b5b'} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <ThemedText style={{ fontSize: 11, color: inquiryGroup?.isSuperInterest ? '#FFD700' : '#ff6b5b', fontWeight: '600' }}>
                  {inquiryGroup?.isSuperInterest ? 'Super Interest' : 'Listing Inquiry'}
                </ThemedText>
                <ThemedText style={[Typography.h3]} numberOfLines={1}>
                  {addressRevealed
                    ? (inquiryGroup?.listingAddress || 'Listing')
                    : (inquiryGroup?.listingAddress?.split(',').slice(-2).join(',').trim() || 'Listing')}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={() => setShowInquiryOptionsMenu(true)} style={styles.moreButton}>
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
                  const tabNav = navigation.getParent();
                  if (tabNav) {
                    tabNav.navigate('Explore', { screen: 'ExploreMain', params: { viewListingId: inquiryGroup.listingId } });
                  }
                }
              }} style={{ paddingLeft: 8 }}>
                <ThemedText style={{ fontSize: 12, color: '#ff6b5b', fontWeight: '600' }}>View Listing</ThemedText>
              </Pressable>
            </Animated.View>
          ) : null}
          {inquiryStatus === 'accepted' && !inquiryGroup?.isArchived && !isHost ? (
            <Pressable
              onPress={() => {
                navigation.navigate('MyGroup' as never);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginHorizontal: 16,
                marginTop: 6,
                paddingVertical: 10,
                backgroundColor: 'rgba(255,107,91,0.1)',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(255,107,91,0.2)',
              }}
            >
              <Feather name="calendar" size={14} color="#ff6b5b" />
              <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#ff6b5b' }}>
                Schedule a Tour
              </ThemedText>
            </Pressable>
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
            {otherUser ? (
              <>
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: otherUser.photos?.[0] }} style={styles.headerAvatar} />
                  {canSeeOnlineStatus() ? (
                    <OnlineDot userId={otherUser.id} size="md" />
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ThemedText style={[Typography.h3]}>
                      {otherUser.name}
                    </ThemedText>
                    <PlanBadge plan={otherUserPlan} size={15} />
                  </View>
                  {chatHostInfo ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                      {chatHostInfo.hostType === 'agent' && chatHostInfo.isVerifiedAgent ? (
                        <>
                          <Feather name="check-circle" size={10} color="#3b82f6" />
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#3b82f6' }}>
                            Verified Agent
                            {chatHostInfo.companyName ? ` · ${chatHostInfo.companyName}` : ''}
                          </Text>
                        </>
                      ) : chatHostInfo.hostType === 'agent' ? (
                        <>
                          <Feather name="briefcase" size={10} color="#3b82f6" />
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#3b82f6' }}>
                            Agent
                            {chatHostInfo.companyName ? ` · ${chatHostInfo.companyName}` : ''}
                          </Text>
                        </>
                      ) : chatHostInfo.hostType === 'company' ? (
                        <>
                          <Feather name="briefcase" size={10} color="#a855f7" />
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#a855f7' }}>
                            {chatHostInfo.companyName || 'Property Management'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Feather name="home" size={10} color="rgba(255,107,91,0.7)" />
                          <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,107,91,0.7)' }}>
                            Independent Host
                          </Text>
                        </>
                      )}
                    </View>
                  ) : canSeeOnlineStatus() ? (
                    <OnlineDot userId={otherUser.id} showLastSeen />
                  ) : null}
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Pressable onPress={() => setShowMembersOverlay(true)}>
                  <View style={{ flexDirection: 'row', width: Math.min(groupMembers.length, 3) * 22 + 18, height: 40 }}>
                    {(groupMembers.length > 0 ? groupMembers.slice(0, 3) : [null]).map((member, idx) => (
                      <View key={member?.id || 'fallback'} style={{ position: 'absolute', left: idx * 22, zIndex: 3 - idx }}>
                        {member?.photo ? (
                          <Image
                            source={{ uri: member.photo }}
                            style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: theme.background || theme.backgroundRoot }}
                          />
                        ) : (
                          <View style={{
                            width: 38, height: 38, borderRadius: 19, borderWidth: 2,
                            borderColor: theme.background || theme.backgroundRoot,
                            backgroundColor: theme.primary + '25', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Feather name="user" size={16} color={theme.primary} />
                          </View>
                        )}
                      </View>
                    ))}
                    {groupMembers.length > 3 ? (
                      <View style={{
                        position: 'absolute', left: 3 * 22, zIndex: 0,
                        width: 38, height: 38, borderRadius: 19, borderWidth: 2,
                        borderColor: theme.background || theme.backgroundRoot,
                        backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>
                          +{groupMembers.length - 3}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  style={{ flex: 1, marginLeft: Spacing.md }}
                  onPress={() => {
                    const groupId = conversationId.replace('group-', '');
                    navigation.navigate('GroupInfo' as any, { groupId, groupName });
                  }}
                >
                  <ThemedText style={[Typography.h3]}>{groupName}</ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    {groupMembers.length > 0
                      ? `${groupMembers.length} member${groupMembers.length > 1 ? 's' : ''}${groupOnlineCount > 0 ? ` · ${groupOnlineCount} online` : ''}`
                      : 'Tap for group info'}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
          <AIFloatingButton onPress={() => setShowAISheet(true)} position="inline" size="sm" />
          {conversationId.startsWith('group-') && !isInquiryChat ? (
            <>
              <Pressable onPress={handleGroupMuteToggle} style={styles.moreButton}>
                <Feather name={isGroupMuted ? 'bell-off' : 'bell'} size={18} color={isGroupMuted ? '#ef4444' : theme.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  const groupId = conversationId.replace('group-', '');
                  navigation.navigate('GroupInfo' as any, {
                    groupId,
                    groupName: groupName,
                  });
                }}
                style={styles.moreButton}
              >
                <Feather name="settings" size={20} color={theme.textSecondary} />
              </Pressable>
            </>
          ) : conversationId.startsWith('group-') ? (
            <Pressable
              onPress={() => {
                const groupId = conversationId.replace('group-', '');
                navigation.navigate('GroupInfo' as any, {
                  groupId,
                  groupName: groupName,
                });
              }}
              style={styles.moreButton}
            >
              <Feather name="settings" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : (
            <>
              {otherUser ? (
                <Pressable onPress={() => setShowAskAbout(true)} style={styles.moreButton}>
                  <Feather name="cpu" size={20} color="#FF6B6B" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  const mid = matchIdFromConversation || conversationId;
                  (navigation as any).navigate('ConversationMedia', { matchId: mid, title: otherUser?.name ? `Media with ${otherUser.name}` : 'Shared Media' });
                }}
                style={styles.moreButton}
              >
                <Feather name="grid" size={18} color={theme.textSecondary} />
              </Pressable>
              <Pressable onPress={() => setShowOptionsMenu(true)} style={styles.moreButton}>
                <Feather name="more-vertical" size={24} color={theme.text} />
              </Pressable>
            </>
          )}
        </View>
      )}

      {conversationId.startsWith('group-') && !isInquiryChat && pinnedMessages.length > 0 ? (
        <PinnedMessageBar
          pinnedMessages={pinnedMessages}
          onPress={() => setShowPinnedSheet(true)}
        />
      ) : null}

      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={[styles.menuSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.menuHandle, { backgroundColor: theme.border }]} />
            <ThemedText style={[Typography.h3, { textAlign: 'center', marginBottom: Spacing.lg }]}>
              Options
            </ThemedText>

            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.border }]}
              onPress={() => { setShowOptionsMenu(false); handleCreateGroup(); }}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: theme.primary + '15' }]}>
                <Feather name="users" size={18} color={theme.primary} />
              </View>
              <ThemedText style={[Typography.body, { flex: 1 }]}>Create Group</ThemedText>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => { setShowOptionsMenu(false); setShowReportBlockModal(true); }}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#EF444415' }]}>
                <Feather name="alert-triangle" size={18} color="#EF4444" />
              </View>
              <ThemedText style={[Typography.body, { flex: 1 }]}>Report / Block</ThemedText>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={[styles.menuCancelBtn, { backgroundColor: theme.background }]}
              onPress={() => setShowOptionsMenu(false)}
            >
              <ThemedText style={[Typography.body, { fontWeight: '600', textAlign: 'center' }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showInquiryOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInquiryOptionsMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowInquiryOptionsMenu(false)}
        >
          <View style={[styles.menuSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.menuHandle, { backgroundColor: theme.border }]} />
            <ThemedText style={[Typography.h3, { textAlign: 'center', marginBottom: Spacing.lg }]}>
              Options
            </ThemedText>

            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.border }]}
              onPress={async () => {
                setShowInquiryOptionsMenu(false);
                const leaveConfirmed = await confirm({
                  title: 'Leave Inquiry',
                  message: 'Are you sure? If all renters leave, this inquiry will be archived.',
                  confirmText: 'Leave',
                  variant: 'danger',
                });
                if (leaveConfirmed) {
                  navigation.goBack();
                }
              }}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#EF444415' }]}>
                <Feather name="log-out" size={18} color="#EF4444" />
              </View>
              <ThemedText style={[Typography.body, { flex: 1 }]}>Leave Inquiry</ThemedText>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => { setShowInquiryOptionsMenu(false); setShowReportBlockModal(true); }}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#EF444415' }]}>
                <Feather name="alert-triangle" size={18} color="#EF4444" />
              </View>
              <ThemedText style={[Typography.body, { flex: 1 }]}>Report / Block</ThemedText>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={[styles.menuCancelBtn, { backgroundColor: theme.background }]}
              onPress={() => setShowInquiryOptionsMenu(false)}
            >
              <ThemedText style={[Typography.body, { fontWeight: '600', textAlign: 'center' }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {!isInquiryChat && !canSeeOnlineStatus() ? (
        <Pressable
          style={[styles.premiumBanner, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => setShowPaywall(true)}
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

      {conversationId.startsWith('group-') && !isInquiryChat ? (
        <Pressable
          style={[styles.addPropertyBtn, { borderColor: theme.border }]}
          onPress={() => setShowPropertySearch(true)}
        >
          <Feather
            name={linkedListing ? 'edit-2' : 'home'}
            size={14}
            color={theme.textSecondary}
          />
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 6 }]}>
            {linkedListing ? 'Change property' : 'Link a property'}
          </ThemedText>
        </Pressable>
      ) : null}

      {linkedListing && !isInquiryChat ? (
        <Pressable
          style={[styles.pinnedListingCard, {
            borderColor: linkedListing.status === 'rented' ? '#EF4444' : theme.border,
          }]}
          onPress={() => {
            const tabNav = navigation.getParent();
            if (tabNav && linkedListing.id) {
              try {
                tabNav.navigate('Explore', { screen: 'ExploreMain', params: { viewListingId: linkedListing.id } });
              } catch {
                try {
                  tabNav.navigate('Listings', { viewListingId: linkedListing.id });
                } catch (e) { console.warn('[ChatScreen] Navigation fallback failed:', e); }
              }
            }
          }}
        >
          {linkedListing.photos?.[0] ? (
            <Image source={{ uri: linkedListing.photos[0] }} style={styles.pinnedListingThumb} />
          ) : (
            <View style={[styles.pinnedListingThumbWrap, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="home" size={20} color="#ff6b5b" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600' }}>Linked Property</ThemedText>
              {linkedListing.status === 'rented' ? (
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 }}>
                  <ThemedText style={{ fontSize: 10, fontWeight: '800', color: '#EF4444', letterSpacing: 0.5 }}>RENTED</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.text }} numberOfLines={1}>
              {linkedListing.title}
            </ThemedText>
            <ThemedText style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
              {linkedListing.address}, {linkedListing.city} · ${linkedListing.rent}/mo
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <GroupPropertySearchModal
        visible={showPropertySearch}
        currentListingId={linkedListing?.id || null}
        onSelect={async (listing) => {
          setShowPropertySearch(false);
          try {
            const groupId = conversationId.replace('group-', '');
            await linkListingToGroup(groupId, listing?.id || null);
            reloadGroupListing();
          } catch (err: any) {
            await alert({ title: 'Error', message: err.message || 'Failed to update property.', variant: 'warning' });
          }
        }}
        onClose={() => setShowPropertySearch(false)}
      />

      {isColdMessage && !coldMessageResponded ? (
        <View style={[styles.premiumBanner, { backgroundColor: 'rgba(147,112,219,0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(147,112,219,0.3)' }]}>
          <Feather name="send" size={16} color="#9370DB" />
          <ThemedText style={[Typography.caption, { color: '#9370DB', marginLeft: Spacing.sm, flex: 1 }]}>
            You sent a direct message — they haven't matched with you yet
          </ThemedText>
        </View>
      ) : null}

      {leakageDetected ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm }}>
          <Feather name="shield" size={16} color="#FF6B6B" />
          <ThemedText style={[Typography.caption, { color: '#FF6B6B', flex: 1 }]}>
            Keep chatting here — your messages are private and backed up on Rhome.
          </ThemedText>
        </View>
      ) : null}

      {meetupSuggestion && !suggestionDismissed && !isInquiryChat ? (
        <MeetupSuggestionCard
          suggestion={meetupSuggestion}
          currentUserId={user?.id || ''}
          userId1={meetupSuggestion.userId1}
          otherUserName={otherUser?.name || 'your match'}
          onDismiss={() => {
            setSuggestionDismissed(true);
            supabase.from('meetup_suggestions').update({ status: 'dismissed' }).eq('id', meetupSuggestion.id).then(() => {});
          }}
        />
      ) : null}

      {otherUser && (() => {
        const ots = calculateTrustScore(otherUser.verification, undefined, null, 0, undefined, undefined);
        return ots.level === 'unverified' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: 'rgba(243,156,18,0.08)', gap: 8 }}>
            <Feather name="alert-circle" size={14} color="#F39C12" />
            <ThemedText style={[Typography.small, { color: '#F39C12', flex: 1 }]}>This user hasn't verified their identity yet</ThemedText>
          </View>
        ) : null;
      })()}

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={processedMessages}
          renderItem={renderChatItem as any}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={[styles.messagesList, { paddingBottom: Spacing.lg }]}
          onContentSizeChange={() => {
            if (isNearBottom.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScroll={handleScroll}
          scrollEventThrottle={100}
        />
      </View>

      <AdBanner placement="chat_bottom" userPlan={userPlan} />
      {isColdMessage && !coldMessageResponded ? (
        <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: theme.backgroundRoot }}>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, textAlign: 'center' }]}>
            Not matched yet · {coldMessagesRemaining >= 999 ? 'unlimited' : coldMessagesRemaining} message{coldMessagesRemaining !== 1 ? 's' : ''} left today
          </ThemedText>
        </View>
      ) : null}
      {isInquiryChat && !isHost && responseDelayHours >= 48 && !requestedDifferentAgent && chatHostInfo ? (
        <Pressable
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
            marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12,
          }}
          onPress={async () => {
            if (chatHostInfo.hostType === 'agent') {
              if (chatHostInfo.companyId) {
                const shouldRequest = await confirm({
                  title: 'Request Different Agent',
                  message: `${chatHostInfo.name || 'This agent'} hasn't responded in ${Math.floor(responseDelayHours)} hours. Would you like to request a different agent from their company?`,
                  confirmText: 'Request',
                  cancelText: 'Cancel',
                  variant: 'warning',
                });
                if (shouldRequest) {
                  await requestDifferentAgent(
                    conversationId,
                    chatHostInfo.companyId,
                    user?.name || 'A renter',
                    chatHostInfo.name || 'Agent'
                  );
                  setRequestedDifferentAgent(true);
                  await alert({ title: 'Request Sent', message: 'The company admin has been notified. They will assign a different agent to assist you.' });
                }
              } else {
                const followUpText = `Hi ${chatHostInfo.name || 'there'}, I sent an inquiry ${Math.floor(responseDelayHours)} hours ago and haven't heard back. Could you please provide an update?`;
                setInputText(followUpText);
              }
            } else if (chatHostInfo.hostType === 'company') {
              const shouldEscalate = await confirm({
                title: 'Response Delayed',
                message: `${chatHostInfo.companyName || chatHostInfo.name || 'This company'} hasn't responded in ${Math.floor(responseDelayHours)} hours. Would you like to send a follow-up?`,
                confirmText: 'Send Follow-up',
                cancelText: 'Cancel',
                variant: 'warning',
              });
              if (shouldEscalate) {
                const followUpText = `Hi, I sent an inquiry ${Math.floor(responseDelayHours)} hours ago and haven't heard back. Could you please provide an update?`;
                setInputText(followUpText);
              }
            } else {
              await alert({
                title: 'Response Delayed',
                message: `${chatHostInfo.name || 'This host'} hasn't responded in ${Math.floor(responseDelayHours)} hours. Individual hosts may take longer to respond. You can try sending a follow-up message.`,
              });
            }
          }}
        >
          <Feather name="alert-circle" size={16} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600' }}>Response delayed ({Math.floor(responseDelayHours)}h)</Text>
            <Text style={{ color: 'rgba(245,158,11,0.7)', fontSize: 11 }}>
              {chatHostInfo.hostType === 'agent'
                ? 'Tap to request a different agent'
                : chatHostInfo.hostType === 'company'
                  ? 'Tap to send a follow-up'
                  : 'Tap for options'}
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color="rgba(245,158,11,0.5)" />
        </Pressable>
      ) : null}
      {requestedDifferentAgent ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
          marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12,
        }}>
          <Feather name="check-circle" size={14} color="#3b82f6" />
          <Text style={{ color: '#3b82f6', fontSize: 12, flex: 1 }}>Agent reassignment requested. The company admin has been notified.</Text>
        </View>
      ) : null}
      {messagingLocked ? (
        <View style={styles.messagingPaywall}>
          <View style={styles.paywallContent}>
            <Feather name="lock" size={18} color="#F59E0B" />
            <View style={styles.paywallTextContainer}>
              <Text style={styles.paywallTitle}>
                {canUnlock ? 'Use your free unlock or upgrade' : 'Upgrade to reply'}
              </Text>
              <Text style={styles.paywallSubtitle}>
                Renters are reaching out — unlock messaging to connect
              </Text>
            </View>
          </View>
          {canUnlock ? (
            <Pressable
              style={styles.paywallFreeUnlockButton}
              onPress={() => setShowUnlockModal(true)}
            >
              <Feather name="gift" size={14} color="#F59E0B" />
              <Text style={styles.paywallFreeUnlockText}>Use Free Unlock</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.paywallUpgradeButton}
            onPress={() => navigation.navigate('Plans' as any)}
          >
            <Text style={styles.paywallUpgradeText}>
              {upgradePlan.plan} — {upgradePlan.price}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {otherUserTyping && !isInquiryChat ? (
        <View style={styles.typingIndicator}>
          <View style={styles.typingBubble}>
            <View style={styles.typingDots}>
              <TypingDot delay={0} />
              <TypingDot delay={150} />
              <TypingDot delay={300} />
            </View>
          </View>
          <Text style={styles.typingText}>
            {otherUser?.name?.split(' ')[0] || 'Someone'} is typing
          </Text>
        </View>
      ) : null}
      {upgradePromptData && !showDailyLimitModal ? (
        <SmartUpgradePrompt
          data={upgradePromptData}
          variant="banner"
          onUpgrade={() => {
            setUpgradePromptData(null);
            (navigation as any).navigate('Plans');
          }}
          onDismiss={() => setUpgradePromptData(null)}
        />
      ) : null}
      {isRecording ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.recordingOverlay}>
          <Animated.View style={[styles.recordingDot, { opacity: recordingDuration % 2 === 0 ? 1 : 0.4 }]} />
          <Text style={styles.recordingTimer}>{formatRecordingTime(recordingDuration)}</Text>
          <Pressable onPress={cancelRecording}>
            <Text style={styles.slideCancel}>Cancel</Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {replyToMessage && !messagingLocked ? (
        <View style={styles.replyInputBar}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ff6b5b', fontSize: 12, fontWeight: '600' }}>
              Replying to {replyToMessage.senderId === user?.id ? 'yourself' : (otherUser?.name?.split(' ')[0] || 'Them')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }} numberOfLines={1}>
              {replyToMessage.text || replyToMessage.content || ''}
            </Text>
          </View>
          <Pressable onPress={() => setReplyToMessage(null)}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      ) : null}
      <MediaUploadProgress
        uploading={uploadProgress.uploading}
        sent={uploadProgress.sent}
        total={uploadProgress.total}
        imageUri={uploadProgress.previewUri}
        onCancel={() => { uploadCancelledRef.current = true; setUploadProgress({ uploading: false, sent: 0, total: 0, previewUri: '' }); setUploadingAttachment(false); }}
      />
      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot, paddingBottom: TAB_BAR_HEIGHT }]}>
        {messagingLocked ? (
          <View style={styles.lockedInputRow}>
            <Feather name="lock" size={16} color="#666" />
            <Text style={styles.lockedInputText}>Upgrade plan to send messages</Text>
          </View>
        ) : (
          <>
            <Pressable
              style={styles.attachBtn}
              onPress={() => setShowAttachmentPicker(true)}
              disabled={uploadingAttachment || messagingLocked}
            >
              {uploadingAttachment ? (
                <ActivityIndicator size="small" color="#ff6b5b" />
              ) : (
                <Feather name="paperclip" size={20} color="rgba(255,255,255,0.5)" />
              )}
            </Pressable>
            {isInquiryChat && inquiryStatus === 'accepted' ? (
              <Pressable
                onPress={() => setShowChatActions(true)}
                style={[styles.chatActionBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="plus" size={22} color="#ff6b5b" />
              </Pressable>
            ) : null}
            {conversationId.startsWith('group-') && !isInquiryChat && groupChatSettings.adminOnlyMessages && myGroupRole !== 'admin' ? (
              <View style={[styles.input, { backgroundColor: theme.backgroundSecondary, justifyContent: 'center' }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Only admins can send messages</Text>
              </View>
            ) : conversationId.startsWith('group-') && !isInquiryChat ? (
              <MentionInput
                value={inputText}
                onChangeText={handleTextChange}
                onMentionsChanged={setMentionedUserIds}
                members={groupMembers.map(m => ({ id: m.id, name: m.name }))}
                placeholder="Type a message..."
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                ]}
              />
            ) : (
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
                onChangeText={handleTextChange}
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
                returnKeyType="send"
                multiline
                maxLength={500}
                editable={!inquiryGroup?.isArchived && canSendMessage()}
              />
            )}
            {inputText.trim() ? (
              <Pressable
                onPress={sendMessage}
                style={[
                  styles.sendButton,
                  { backgroundColor: canSendMessage() ? theme.primary : theme.backgroundSecondary },
                ]}
                disabled={!canSendMessage()}
              >
                <Feather name="send" size={20} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                onLongPress={handleStartRecording}
                onPressOut={isRecording ? handleStopRecording : undefined}
                style={[
                  styles.sendButton,
                  { backgroundColor: isRecording ? '#EF4444' : theme.backgroundSecondary },
                ]}
              >
                <Feather name="mic" size={20} color={isRecording ? '#FFF' : theme.text} />
              </Pressable>
            )}
          </>
        )}
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

      <RhomeAISheet
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

      {(otherUser || inquiryGroup?.hostId) ? (
        <ReportBlockModal
          visible={showReportBlockModal}
          onClose={() => setShowReportBlockModal(false)}
          userName={otherUser?.name || inquiryGroup?.hostName || 'User'}
          onReport={async (reason) => {
            const targetId = otherUser?.id || inquiryGroup?.hostId;
            if (targetId) {
              await reportUser(targetId, reason);
            }
          }}
          onBlock={async () => {
            const targetId = otherUser?.id || inquiryGroup?.hostId;
            if (targetId) {
              await blockUser(targetId);
              navigation.goBack();
            }
          }}
        />
      ) : null}

      {otherUser ? (
        <AskAboutPersonModal
          visible={showAskAbout}
          onClose={() => setShowAskAbout(false)}
          targetProfileId={otherUser.id}
          targetName={otherUser.name}
          targetAge={otherUser.age}
          entryPoint="chat_screen"
          compatibilityScore={otherUser.compatibility}
        />
      ) : null}

      <Modal visible={showChatActions} transparent animationType="fade" onRequestClose={() => setShowChatActions(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowChatActions(false)}>
          <View style={[styles.menuSheet, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.menuHandle, { backgroundColor: theme.border }]} />
            <Pressable
              style={[styles.menuItem, { borderBottomColor: theme.border }]}
              onPress={() => { setShowChatActions(false); setShowVisitModal(true); }}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
                <Feather name="home" size={18} color="#ff6b5b" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Schedule Visit</ThemedText>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                  Request a tour of this property
                </ThemedText>
              </View>
            </Pressable>
            {isHost ? (
              <Pressable
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => { setShowChatActions(false); setShowBookingModal(true); }}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                  <Feather name="key" size={18} color="#D4AF37" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[Typography.body, { fontWeight: '600' }]}>Send Booking Offer</ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    Offer a lease to this renter
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.menuCancelBtn}
              onPress={() => setShowChatActions(false)}
            >
              <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <VisitRequestModal
        visible={showVisitModal}
        onClose={() => { setShowVisitModal(false); setCounterProposalMessageId(null); }}
        onSubmit={handleSendVisitRequest}
        address={addressRevealed
          ? (inquiryGroup?.listingAddress || 'Address pending')
          : (inquiryGroup?.listingAddress?.split(',').slice(-2).join(',').trim() || 'Address pending')}
      />

      <BookingOfferModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onSubmit={handleSendBookingOffer}
        address={inquiryGroup?.listingAddress || 'Property'}
        defaultRent={inquiryGroup?.listingPrice || 0}
      />

      {conversationId.startsWith('group-') && !isInquiryChat ? (
        <PinnedMessagesSheet
          visible={showPinnedSheet}
          onClose={() => setShowPinnedSheet(false)}
          pinnedMessages={pinnedMessages}
          onJumpToMessage={(messageId) => {
            setShowPinnedSheet(false);
            const idx = messages.findIndex(m => m.id === messageId);
            if (idx >= 0) {
              setHighlightedId(messageId);
              flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
              setTimeout(() => setHighlightedId(null), 3000);
            }
          }}
          onUnpin={handleUnpinAction}
          isAdmin={myGroupRole === 'admin'}
        />
      ) : null}

      <MessageActionsSheet
        visible={!!activeMessageActions}
        onClose={() => setActiveMessageActions(null)}
        messageText={activeMessageActions?.text || activeMessageActions?.content || ''}
        isOwnMessage={activeMessageActions?.senderId === user?.id}
        actions={activeMessageActions ? getMessageActions(activeMessageActions) : []}
      />

      {showEmojiPicker ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setShowEmojiPicker(false)}>
            <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16, marginBottom: 12 }}>Add Reaction</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(userPlan === 'basic' ? QUICK_REACTIONS : EXTENDED_EMOJIS).map(emoji => (
                  <Pressable
                    key={emoji}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => {
                      if (emojiPickerTargetId) {
                        handleToggleReaction(emojiPickerTargetId, emoji);
                      }
                      setShowEmojiPicker(false);
                      setEmojiPickerTargetId(null);
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      {showUnlockModal ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShowUnlockModal(false)}>
          <View style={styles.unlockModalOverlay}>
            <View style={styles.unlockModalCard}>
              <View style={styles.unlockModalIcon}>
                <Feather name="gift" size={32} color="#F59E0B" />
              </View>
              <Text style={styles.unlockModalTitle}>1 Free Message Unlock</Text>
              <Text style={styles.unlockModalBody}>
                Read and reply to this entire conversation for free. You only get one — make it count!
              </Text>
              <Pressable
                style={styles.unlockModalButton}
                onPress={handleUnlockConversation}
              >
                <Feather name="unlock" size={16} color="#000" />
                <Text style={styles.unlockModalButtonText}>Unlock This Conversation</Text>
              </Pressable>
              <Pressable
                style={styles.unlockModalSecondary}
                onPress={() => setShowUnlockModal(false)}
              >
                <Text style={styles.unlockModalSecondaryText}>Save For Later</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

      <Modal visible={showDailyLimitModal} transparent animationType="fade" onRequestClose={() => setShowDailyLimitModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }} onPress={() => { setShowDailyLimitModal(false); setUpgradePromptData(null); }}>
          <Pressable onPress={() => {}}>
            {upgradePromptData ? (
              <SmartUpgradePrompt
                data={upgradePromptData}
                variant="card"
                onUpgrade={() => {
                  setShowDailyLimitModal(false);
                  setUpgradePromptData(null);
                  (navigation as any).navigate('Plans');
                }}
                onDismiss={() => {
                  setShowDailyLimitModal(false);
                  setUpgradePromptData(null);
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
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
                (navigation as any).navigate('Plans');
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
      <Modal
        visible={showMembersOverlay}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMembersOverlay(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setShowMembersOverlay(false)}
        >
          <Pressable
            style={{ backgroundColor: theme.card || theme.backgroundDefault, borderRadius: 20, width: '100%', maxWidth: 360, maxHeight: '70%', overflow: 'hidden' }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <ThemedText style={[Typography.h3]}>Group Members</ThemedText>
              <Pressable onPress={() => setShowMembersOverlay(false)} hitSlop={8}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={groupMembers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 12,
                    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
                    marginBottom: 8, backgroundColor: theme.background || theme.backgroundRoot,
                  }}
                  onPress={() => {
                    setShowMembersOverlay(false);
                    if (item.id !== user?.id) {
                      const groupId = conversationId.replace('group-', '');
                      navigation.navigate('GroupInfo' as any, { groupId, groupName });
                    }
                  }}
                >
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  ) : (
                    <View style={{
                      width: 52, height: 52, borderRadius: 26,
                      backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Feather name="user" size={22} color={theme.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
                        {item.name}{item.id === user?.id ? ' (you)' : ''}
                      </ThemedText>
                      {item.groupRole === 'admin' ? (
                        <View style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                          <ThemedText style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>Admin</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                      {item.role === 'host' ? 'Host' : 'Renter'}
                    </ThemedText>
                  </View>
                  {item.id !== user?.id ? (
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ThemedText style={{ color: theme.textSecondary }}>No members found</ThemedText>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
      <PaywallSheet
        visible={showPaywall}
        featureName={paywallFeature}
        requiredPlan={
          user?.hostType === 'agent' ? 'pro'
          : user?.hostType === 'company' ? 'starter'
          : isHost ? 'pro'
          : 'elite'
        }
        role={isHost ? 'host' : 'renter'}
        onUpgrade={() => { setShowPaywall(false); (navigation as any).navigate(isHost ? 'HostSubscription' : 'Plans'); }}
        onDismiss={() => setShowPaywall(false)}
      />

      <ChatAttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onPickImage={handlePickImage}
        onTakePhoto={handleTakePhoto}
        onPickDocument={handlePickDocument}
      />

      <ImageGalleryViewer
        visible={galleryVisible}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        onClose={() => setGalleryVisible(false)}
      />
      {gateModal ? (
        <FeatureGateModal
          visible={gateModal.visible}
          onClose={() => setGateModal(null)}
          onCompleteProfile={() => { setGateModal(null); (navigation as any).navigate('Profile', { screen: 'ProfileQuestionnaire' }); }}
          featureName={gateModal.feature}
          requiredTier={gateModal.requiredTier}
          currentTier={gateStatus.tier}
          nextItems={getItemsForTier(user, gateModal.requiredTier)}
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
  addPropertyBtn: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, marginVertical: 6,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelBtn: {
    marginTop: Spacing.lg,
    paddingVertical: 14,
    borderRadius: 14,
  },
  chatActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  blurredMessageWrapper: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  messageBlurOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 16,
  },
  messagingPaywall: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  paywallContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 12,
  },
  paywallTextContainer: {
    flex: 1,
  },
  paywallTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#F59E0B',
  },
  paywallSubtitle: {
    fontSize: 12,
    color: 'rgba(245, 158, 11, 0.7)',
    marginTop: 2,
  },
  paywallUpgradeButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  paywallUpgradeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  paywallFreeUnlockButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  paywallFreeUnlockText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  lockedInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center' as const,
    flex: 1,
  },
  lockedInputText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  unlockModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  unlockModalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center' as const,
    width: '100%' as const,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  unlockModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  unlockModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  unlockModalBody: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  unlockModalButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  unlockModalButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },
  unlockModalSecondary: {
    paddingVertical: 10,
  },
  unlockModalSecondaryText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500' as const,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  typingIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typingBubble: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row' as const,
    gap: 4,
    alignItems: 'center' as const,
  },
  typingDotStyle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  typingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic' as const,
  },
  dateSeparator: {
    alignItems: 'center' as const,
    marginVertical: 16,
  },
  dateSeparatorPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateSeparatorText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  reactionContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  reactionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionPillActive: {
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.4)',
    backgroundColor: 'rgba(255,107,91,0.1)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  reactionBar: {
    flexDirection: 'row' as const,
    gap: 4,
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  reactionBarEmoji: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b5b',
    paddingLeft: 10,
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: 'rgba(255,107,91,0.06)',
    borderRadius: 8,
  },
  replyPreviewName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#ff6b5b',
  },
  replyPreviewText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  replyInputBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,107,91,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b5b',
  },
  recordingOverlay: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.2)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimer: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  slideCancel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  editedText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
  },
});
