import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, TextInput } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import { Conversation, Match, RoommateProfile } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '../../navigation/MessagesStackNavigator';
import { Image } from 'expo-image';
import { calculateCompatibility } from '../../utils/matchingAlgorithm';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from '../../types/models';
import { getConversations as getSupabaseConversations, subscribeToAllMessages } from '../../services/messageService';
import { getMyInquiryGroups } from '../../services/groupService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Group } from '../../types/models';

type MessagesScreenNavigationProp = NativeStackNavigationProp<MessagesStackParamList, 'MessagesList'>;

const AVATAR_GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f7971e', '#ffd200'],
  ['#11998e', '#38ef7d'],
  ['#fc4a1a', '#f7b733'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#a18cd1', '#fbc2eb'],
  ['#ff9a9e', '#fecfef'],
];

const ICE_BREAKERS = [
  { icon: 'message-circle' as const, text: 'Say hi' },
  { icon: 'home' as const, text: 'Ask about their place' },
];

type ChatFilterKey = 'all' | 'people' | 'direct' | 'groups';

export const MessagesScreen = () => {
  const navigation = useNavigation<MessagesScreenNavigationProp>();
  const route = useRoute<any>();
  const role: 'host' | 'renter' = route.params?.role || 'renter';
  const isHostMode = role === 'host';
  const insets = useSafeAreaInsets();
  const { user, isPlaceSeeker } = useAuth();
  const { alert } = useConfirm();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, RoommateProfile>>(new Map());
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map()); // populated for future profile lookups
  const [newMatches, setNewMatches] = useState<{ profile: RoommateProfile; match: Match; compatibility: number }[]>([]);
  const [matchesMap, setMatchesMap] = useState<Map<string, Match>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [inquiryGroups, setInquiryGroups] = useState<Group[]>([]);
  const [chatFilter, setChatFilter] = useState<ChatFilterKey>('all');

  const MSG_COLLAPSE_H = 50;
  const msgScrollY = useSharedValue(0);
  const msgScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { msgScrollY.value = event.contentOffset.y; },
  });
  const msgCollapsibleStyle = useAnimatedStyle(() => {
    const translateY = interpolate(msgScrollY.value, [0, MSG_COLLAPSE_H], [0, -MSG_COLLAPSE_H], Extrapolation.CLAMP);
    const opacity = interpolate(msgScrollY.value, [0, MSG_COLLAPSE_H * 0.6], [1, 0], Extrapolation.CLAMP);
    const maxH = interpolate(msgScrollY.value, [0, MSG_COLLAPSE_H], [MSG_COLLAPSE_H, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity, maxHeight: maxH, overflow: 'hidden' as const };
  });
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToAllMessages(user.id, () => {
      loadConversations();
    });
    return () => { unsubscribe(); };
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      loadConversations();
    }, [user])
  );

  const loadConversationsFromSupabase = async (): Promise<Conversation[]> => {
    const supaConvs = await getSupabaseConversations();
    return supaConvs.map((sc: any) => ({
      id: `conv_${sc.matchId}`,
      participant: {
        id: sc.participant?.id || '',
        name: sc.participant?.full_name || 'Unknown',
        photo: sc.participant?.avatar_url || undefined,
        online: false,
      },
      lastMessage: sc.lastMessage || 'You matched!',
      timestamp: new Date(sc.lastMessageAt),
      unread: sc.unreadCount || 0,
      messages: [],
      matchType: sc.matchType === 'super_interest' ? 'super_interest' : sc.matchType === 'cold' ? 'cold' : 'mutual',
    }));
  };

  const loadConversations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      const localConversations = await StorageService.getConversations();
      const localConvMap = new Map(localConversations.map(c => [c.id, c]));

      let existingConversations: Conversation[] = [];
      try {
        const supaConversations = await loadConversationsFromSupabase();
        existingConversations = supaConversations.map(supaConv => {
          const localConv = localConvMap.get(supaConv.id);
          return { ...supaConv, messages: localConv?.messages || [] };
        });
      } catch (supaError) {
        console.warn('Supabase getConversations failed, falling back to StorageService:', supaError);
        existingConversations = [...localConversations];
      }

      for (const localConv of localConversations) {
        if (!existingConversations.some(c => c.id === localConv.id)) {
          existingConversations.push(localConv);
        }
      }

      const matches = isHostMode ? [] : await StorageService.getMatches();
      const profiles = isHostMode ? [] : await StorageService.getRoommateProfiles();
      const allUsers = isHostMode ? [] : await StorageService.getUsers();
      const pMap = new Map(profiles.map(p => [p.id, p]));
      const uMap = new Map(allUsers.map(u => [u.id, u]));
      setProfilesMap(pMap);
      setUsersMap(uMap);

      const recentMatchProfiles: { profile: RoommateProfile; match: Match; compatibility: number }[] = [];

      const mMap = new Map<string, Match>();
      for (const match of matches) {
        if (match.userId1 !== user.id && match.userId2 !== user.id) continue;

        const otherUserId = match.userId1 === user.id ? match.userId2 : match.userId1;
        mMap.set(otherUserId, match);
        const conversationExists = existingConversations.some(
          c => c.participant.id === otherUserId
        );

        if (!conversationExists) {
          const otherProfile = profiles.find(p => p.id === otherUserId);
          if (otherProfile) {
            const existingInquiryThread = existingConversations.find(
              c => c.participant?.id === otherUserId && c.isInquiryThread
            );

            if (existingInquiryThread) {
              if (!existingInquiryThread.matchId) {
                existingInquiryThread.matchId = match.id;
                existingInquiryThread.matchType = match.matchType || 'mutual';
                if (existingInquiryThread.inquiryStatus === 'pending') {
                  existingInquiryThread.inquiryStatus = 'accepted';
                  existingInquiryThread.lastMessage = 'Interest accepted! You can now message each other.';
                }
              }
            } else {
              const localConv = localConvMap.get(`conv_${match.id}`);
              const newConversation: Conversation = {
                id: `conv_${match.id}`,
                participant: {
                  id: otherProfile.id,
                  name: otherProfile.name,
                  photo: otherProfile.photos?.[0],
                  online: false,
                },
                lastMessage: localConv?.lastMessage || 'You matched!',
                timestamp: localConv?.timestamp || match.matchedAt,
                unread: localConv?.unread || 0,
                messages: localConv?.messages || [],
                matchType: match.matchType || 'mutual',
              };
              existingConversations.push(newConversation);
            }
          }
        } else {
          const existingConv = existingConversations.find(c => c.participant.id === otherUserId);
          if (existingConv && !existingConv.matchType) {
            existingConv.matchType = match.matchType || 'mutual';
          }
        }

        const otherProfile = pMap.get(otherUserId);
        if (otherProfile) {
          const compatibility = user ? calculateCompatibility(user, otherProfile) : 50;
          recentMatchProfiles.push({ profile: otherProfile, match, compatibility });
        }
      }
      setMatchesMap(mMap);

      recentMatchProfiles.sort((a, b) => b.match.matchedAt.getTime() - a.match.matchedAt.getTime());
      setNewMatches(recentMatchProfiles.slice(0, 10));

      const blockedIds = user.blockedUsers || [];
      const userConversations = existingConversations.filter(c => {
        if (blockedIds.includes(c.participant.id)) return false;

        if (isHostMode) {
          return (
            (c.id.startsWith('conv-interest-') && c.hostId === user.id) ||
            (c.isInquiryThread && c.hostId === user.id)
          );
        } else {
          return (
            (c.isInquiryThread && c.hostId !== user.id) ||
            (c.id.startsWith('conv-interest-') && c.participant.id !== user.id) ||
            c.matchType === 'cold' ||
            matches.some(match =>
              (match.userId1 === user.id && match.userId2 === c.participant.id) ||
              (match.userId2 === user.id && match.userId1 === c.participant.id)
            )
          );
        }
      });

      userConversations.sort((a, b) => {
        if (a.isInquiryThread && a.isSuperInterest && !(b.isInquiryThread && b.isSuperInterest)) return -1;
        if (b.isInquiryThread && b.isSuperInterest && !(a.isInquiryThread && a.isSuperInterest)) return 1;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      const safeToSave = existingConversations.map(c => {
        const local = localConvMap.get(c.id);
        if (local && local.messages && local.messages.length > 0 && (!c.messages || c.messages.length === 0)) {
          return { ...c, messages: local.messages };
        }
        return c;
      });
      await StorageService.setConversations(safeToSave);
      setConversations(userConversations);
      if (!isHostMode) {
        try {
          const groups = await getMyInquiryGroups();
          const mapped = groups.map((g: any) => ({
            ...g,
            listingAddress: g.listing_address || g.listingAddress,
            listingId: g.listing_id || g.listingId,
            hostId: g.host_id || g.hostId,
            isArchived: g.is_archived || g.isArchived || false,
            hostName: g.host?.full_name || g.hostName || 'Host',
            memberCount: g.members?.[0]?.count || g.memberCount || 0,
            listingPhoto: g.listing?.photos?.[0] || g.listingPhoto,
            inquiryStatus: g.inquiry_status || g.inquiryStatus || 'pending',
            addressRevealed: g.address_revealed || g.addressRevealed || false,
          }));
          setInquiryGroups(mapped.filter((g: any) => !g.isArchived));
        } catch (e) {
          console.warn('Failed to load inquiry groups:', e);
        }
      } else {
        setInquiryGroups([]);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const canSeeOnlineStatus = () => {
    const userPlan = user?.subscription?.plan || 'basic';
    const userStatus = user?.subscription?.status || 'active';
    return (userPlan === 'plus' || userPlan === 'elite') && userStatus === 'active';
  };

  const getAvatarGradient = (id: string): [string, string] => {
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  };

  const getCompatibilityForConversation = (participantId: string): number | null => {
    const matchData = newMatches.find(m => m.profile.id === participantId);
    if (matchData) return matchData.compatibility;
    const profile = profilesMap.get(participantId);
    if (profile && user) return calculateCompatibility(user, profile);
    return null;
  };

  const isNewMatch = (conv: Conversation): boolean => {
    return conv.lastMessage === 'You matched!' && (!conv.messages || conv.messages.length === 0);
  };

  const navigateToChat = (conv: Conversation) => {
    if (conv.unread > 0) {
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c)
      );
      StorageService.updateConversation(conv.id, { unread: 0 });
    }
    navigation.navigate('Chat', {
      conversationId: conv.id,
      otherUser: profilesMap.get(conv.participant.id) as unknown as RoommateProfile,
    });
  };

  const sendIceBreaker = async (conv: Conversation, text: string) => {
    navigation.navigate('Chat', {
      conversationId: conv.id,
      otherUser: profilesMap.get(conv.participant.id) as unknown as RoommateProfile,
    });
  };

  const navigateToMatchChat = async (profile: RoommateProfile, match: Match) => {
    let conv = conversations.find(c => c.participant.id === profile.id);
    if (!conv) {
      conv = {
        id: `conv_${match.id}`,
        participant: {
          id: profile.id,
          name: profile.name,
          photo: profile.photos?.[0],
          online: false,
        },
        lastMessage: 'You matched!',
        timestamp: match.matchedAt,
        unread: 0,
        messages: [],
      };
      const allConvs = await StorageService.getConversations();
      allConvs.push(conv);
      await StorageService.setConversations(allConvs);
    }
    navigateToChat(conv);
  };

  const renderMatchBubble = (item: { profile: RoommateProfile; match: Match; compatibility: number }, index: number) => {
    const gradient = getAvatarGradient(item.profile.id);
    const hasNewRing = index < 4;

    return (
      <Pressable
        key={item.profile.id}
        style={styles.matchBubble}
        onPress={() => navigateToMatchChat(item.profile, item.match)}
      >
        <View style={styles.matchAvatarWrap}>
          {item.profile.photos?.[0] ? (
            <Image
              source={{ uri: item.profile.photos[0] }}
              style={[
                styles.matchAvatar,
                hasNewRing ? styles.matchAvatarNewRing : null,
              ]}
            />
          ) : (
            <LinearGradient
              colors={gradient}
              style={[
                styles.matchAvatar,
                hasNewRing ? styles.matchAvatarNewRing : null,
              ]}
            >
              <Text style={styles.matchAvatarText}>
                {item.profile.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <View style={styles.matchScoreDot}>
            <Text style={styles.matchScoreText}>{item.compatibility}%</Text>
          </View>
        </View>
        <Text style={styles.matchName} numberOfLines={1}>
          {item.profile.name.split(' ')[0]}
        </Text>
      </Pressable>
    );
  };

  const navigateToInquiryConv = (conv: Conversation) => {
    if (conv.unread > 0) {
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c)
      );
      StorageService.updateConversation(conv.id, { unread: 0 });
    }
    navigation.navigate('Chat', {
      conversationId: conv.id,
      inquiryGroup: {
        id: conv.inquiryId || conv.id,
        name: conv.listingTitle || 'Listing Inquiry',
        listingAddress: conv.listingTitle || '',
        listingId: conv.propertyId,
        hostId: conv.hostId,
        listingPhoto: conv.listingPhoto,
        listingTitle: conv.listingTitle,
        listingPrice: conv.listingPrice,
        inquiryStatus: conv.inquiryStatus,
        isInquiryThread: true,
        isSuperInterest: conv.isSuperInterest || false,
        isArchived: false,
        type: 'listing_inquiry',
      },
    });
  };

  const renderInquiryConversation = (item: Conversation) => {
    if (item.isSuperInterest) {
      return renderSuperInterestConversation(item);
    }

    const statusColor =
      item.inquiryStatus === 'accepted' ? '#2ecc71' :
      item.inquiryStatus === 'declined' ? '#ff4757' :
      '#ffd700';
    const statusLabel =
      item.inquiryStatus === 'accepted' ? 'Accepted' :
      item.inquiryStatus === 'declined' ? 'Not Available' :
      'Pending';

    return (
      <Pressable
        key={item.id}
        style={styles.inquiryConvRow}
        onPress={() => navigateToInquiryConv(item)}
      >
        {item.listingPhoto ? (
          <Image source={{ uri: item.listingPhoto }} style={styles.inquiryConvThumb} />
        ) : (
          <View style={[styles.inquiryConvThumb, { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="home" size={20} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <View style={styles.inquiryConvInfo}>
          <View style={styles.inquiryConvTop}>
            <Text style={styles.inquiryConvTitle} numberOfLines={1}>
              {item.listingTitle || 'Listing Inquiry'}
            </Text>
            <View style={[styles.inquiryStatusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
              <View style={[styles.inquiryStatusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.inquiryStatusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.inquiryConvPrice}>
            {item.listingPrice ? `$${item.listingPrice.toLocaleString()}/mo` : ''}
            {item.hostName ? `  ·  ${item.hostName}` : ''}
          </Text>
          <Text style={styles.inquiryConvLastMsg} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderSuperInterestConversation = (item: Conversation) => {
    const statusColor =
      item.inquiryStatus === 'accepted' ? '#2ecc71' :
      item.inquiryStatus === 'declined' ? '#ff4757' :
      '#FFD700';
    const statusLabel =
      item.inquiryStatus === 'accepted' ? 'Accepted' :
      item.inquiryStatus === 'declined' ? 'Not Available' :
      'Awaiting Response';

    return (
      <Pressable
        key={item.id}
        style={[styles.inquiryConvRow, styles.superInterestRow]}
        onPress={() => navigateToInquiryConv(item)}
      >
        <View style={styles.superInterestAccent} />
        {item.listingPhoto ? (
          <Image source={{ uri: item.listingPhoto }} style={styles.inquiryConvThumb} />
        ) : (
          <View style={[styles.inquiryConvThumb, { backgroundColor: 'rgba(255,215,0,0.08)', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="home" size={20} color="rgba(255,215,0,0.4)" />
          </View>
        )}
        <View style={styles.inquiryConvInfo}>
          <View style={styles.inquiryConvTop}>
            <Text style={styles.inquiryConvTitle} numberOfLines={1}>
              {item.listingTitle || 'Super Interest'}
            </Text>
            <View style={styles.superInterestConvBadge}>
              <Feather name="star" size={10} color="#FFD700" />
              <Text style={styles.superInterestConvBadgeText}>Super Interest</Text>
            </View>
          </View>
          <Text style={styles.inquiryConvPrice}>
            {item.listingPrice ? `$${item.listingPrice.toLocaleString()}/mo` : ''}
            {item.hostName ? `  ·  ${item.hostName}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[styles.inquiryStatusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
              <View style={[styles.inquiryStatusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.inquiryStatusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const getConvType = (conv: Conversation): 'people' | 'direct' | 'groups' => {
    if (conv.isInquiryThread) return 'direct';
    return 'people';
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
  const peopleUnread = conversations.filter(c => getConvType(c) === 'people').reduce((sum, c) => sum + (c.unread || 0), 0);
  const directUnread = conversations.filter(c => getConvType(c) === 'direct').reduce((sum, c) => sum + (c.unread || 0), 0);
  const groupUnread = conversations.filter(c => getConvType(c) === 'groups').reduce((sum, c) => sum + (c.unread || 0), 0);

  const renderConversation = ({ item, index }: { item: any; index: number }) => {
    if (item.__isDivider) {
      return (
        <View style={styles.coldDivider}>
          <View style={styles.coldDividerLine} />
          <Text style={styles.coldDividerLabel}>DIRECT MESSAGES</Text>
          <View style={styles.coldDividerLine} />
        </View>
      );
    }

    if (item.isInquiryThread && item.matchType !== 'cold' && item.matchType !== 'mutual') {
      return renderInquiryConversation(item);
    }

    const hasUnread = item.unread > 0;
    const isNew = isNewMatch(item);
    const compatibility = getCompatibilityForConversation(item.participant.id);
    const profile = profilesMap.get(item.participant.id);
    const match = matchesMap.get(item.participant.id);
    const convMatchType = item.matchType || match?.matchType || 'mutual';
    const isUnmatched = convMatchType === 'cold';

    return (
      <Pressable
        style={[styles.convRow, isUnmatched && styles.convRowUnmatched]}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.convAvatarWrap}>
          {item.participant.photo ? (
            <Image source={{ uri: item.participant.photo }} style={[styles.convAvatar, isUnmatched && { opacity: 0.4 }]} />
          ) : (
            <LinearGradient
              colors={getAvatarGradient(item.participant.id)}
              style={[styles.convAvatar, isUnmatched && { opacity: 0.4 }]}
            >
              <Text style={styles.convAvatarLetter}>
                {item.participant.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          {canSeeOnlineStatus() && item.participant.online && !isUnmatched ? (
            <View style={styles.onlineDot} />
          ) : null}
        </View>

        <View style={styles.convContent}>
          <View style={styles.convTopRow}>
            <Text style={[styles.convName, isUnmatched && styles.convNameMuted]} numberOfLines={1}>
              {item.participant.name}
            </Text>
            <Text style={[styles.convTime, hasUnread && styles.convTimeUnread]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>

          <View style={styles.convMidRow}>
            <Text
              style={[styles.convPreview, isUnmatched && styles.convPreviewMuted]}
              numberOfLines={1}
            >
              {isNew ? 'You matched! Say hello' : item.lastMessage}
            </Text>
            {hasUnread && !isUnmatched ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unread}</Text>
              </View>
            ) : null}
          </View>

          {isUnmatched ? (
            <View style={styles.convTagRow}>
              <View style={styles.coldTag}>
                <Feather name="send" size={9} color="rgba(255,255,255,0.4)" />
                <Text style={styles.coldTagText}>Direct</Text>
              </View>
            </View>
          ) : (
            <View style={styles.convTagRow}>
              {compatibility !== null ? (
                <View style={styles.matchTag}>
                  <Feather name="heart" size={9} color="#ff6b5b" />
                  <Text style={styles.matchTagText}>{compatibility}% match</Text>
                </View>
              ) : null}
              {convMatchType === 'super_interest' ? (
                <View style={[styles.matchTag, { backgroundColor: 'rgba(255,215,0,0.12)' }]}>
                  <Feather name="zap" size={9} color="#FFD700" />
                  <Text style={[styles.matchTagText, { color: '#FFD700' }]}>Super Interest</Text>
                </View>
              ) : null}
            </View>
          )}

          {isNew && !isUnmatched ? (
            <View style={styles.iceRow}>
              {ICE_BREAKERS.map((ib, i) => (
                <Pressable
                  key={i}
                  style={styles.iceChip}
                  onPress={() => sendIceBreaker(item, ib.text)}
                >
                  <Feather name={ib.icon} size={12} color="rgba(255,255,255,0.45)" />
                  <Text style={styles.iceChipText}>{ib.text}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const navigateToInquiryChat = (group: Group) => {
    navigation.navigate('Chat', {
      conversationId: `inquiry_${group.id}`,
      inquiryGroup: group,
    });
  };

  const renderInquiryItem = (group: any) => {
    const photo = group.listingPhoto || group.listing?.photos?.[0];
    const count = group.memberCount || (Array.isArray(group.members) ? group.members.length : 0);
    return (
      <Pressable
        key={group.id}
        style={styles.inquiryItem}
        onPress={() => navigateToInquiryChat(group)}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.inquiryThumb} />
        ) : (
          <View style={styles.inquiryIconWrap}>
            <Feather name="home" size={18} color="#ff6b5b" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }} numberOfLines={1}>
            {group.addressRevealed
              ? (group.name || group.listingAddress || 'Listing Inquiry')
              : (group.listingAddress?.split(',').slice(-2).join(',').trim() || group.name || 'Listing Inquiry')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Feather
              name={group.addressRevealed ? 'unlock' : 'lock'}
              size={9}
              color={group.addressRevealed ? '#ff6b5b' : 'rgba(255,255,255,0.35)'}
              style={{ marginRight: 4 }}
            />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} numberOfLines={1}>
              {group.addressRevealed
                ? (group.listingAddress || 'No address')
                : (group.listingAddress?.split(',').slice(-2).join(',').trim() || 'No address')}
            </Text>
          </View>
        </View>
        {group.inquiryStatus === 'accepted' ? (
          <View style={[styles.inquiryStatusPill, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
            <Text style={{ fontSize: 10, color: '#ff6b5b', fontWeight: '600' }}>Accepted</Text>
          </View>
        ) : group.inquiryStatus === 'declined' ? (
          <View style={[styles.inquiryStatusPill, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
            <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '600' }}>Declined</Text>
          </View>
        ) : (
          <View style={styles.inquiryMembersBadge}>
            <Feather name="users" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>
              {count}
            </Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" style={{ marginLeft: 8 }} />
      </Pressable>
    );
  };

  const handleAIAssistantPress = async () => {
    (navigation as any).navigate('AIMatchAssistant');
  };

  const renderHeader = () => {
    const showAI = chatFilter === 'all';
    const showInquiries = (chatFilter === 'all' || chatFilter === 'groups') && inquiryGroups.length > 0;
    const showMatches = (chatFilter === 'all' || chatFilter === 'people') && !isHostMode && newMatches.length > 0;

    return (
      <View>
        {showAI ? (
          <Pressable
            style={styles.aiConvRow}
            onPress={handleAIAssistantPress}
          >
            <LinearGradient colors={['#ff6b5b', '#ff8c7a']} style={styles.aiConvAvatar}>
              <Feather name="cpu" size={22} color="#fff" />
            </LinearGradient>
            <View style={styles.aiConvContent}>
              <View style={styles.convTopRow}>
                <Text style={styles.aiConvName}>Pi Assistant</Text>
              </View>
              <Text style={styles.aiConvSubtitle}>
                {isPlaceSeeker() ? 'Apartment advice, neighborhoods, pricing...' : 'Roommate tips, compatibility, co-living advice...'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
          </Pressable>
        ) : null}

        {showInquiries ? (
          <>
            <View style={styles.sectionLabelWrap}>
              <Text style={styles.sectionLabelText}>YOUR GROUPS</Text>
            </View>
            {inquiryGroups.map(g => renderInquiryItem(g))}
          </>
        ) : null}
        {showMatches ? (
          <>
            <View style={styles.sectionLabelWrap}>
              <Text style={styles.sectionLabelText}>NEW MATCHES</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchesRow}
            >
              {newMatches.map((m, i) => renderMatchBubble(m, i))}
            </ScrollView>
          </>
        ) : null}
        <View style={styles.sectionLabelWrap}>
          <Text style={styles.sectionLabelText}>CONVERSATIONS</Text>
        </View>
      </View>
    );
  };

  const renderFooterNudge = () => {
    if (conversations.length === 0 || newMatches.length === 0) return null;
    const unmessaged = newMatches.filter(m => {
      const conv = conversations.find(c => c.participant.id === m.profile.id);
      return conv && isNewMatch(conv);
    });
    if (unmessaged.length === 0) return null;

    return (
      <View style={styles.nudgeContainer}>
        <View style={styles.nudgeIcon}>
          <Feather name="message-square" size={26} color="#ff6b5b" />
        </View>
        <Text style={styles.nudgeTitle}>Keep the momentum going</Text>
        <Text style={styles.nudgeSubtitle}>
          You have {unmessaged.length} new match{unmessaged.length !== 1 ? 'es' : ''} waiting.{'\n'}Don't let them go cold!
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.chatEmptyWrap}>
      <View style={styles.chatEmptyIcon}>
        <Feather name="message-circle" size={30} color="rgba(255,107,91,0.5)" />
      </View>
      <Text style={styles.chatEmptyTitle}>No conversations yet</Text>
      <Text style={styles.chatEmptySubtitle}>
        {chatFilter === 'people'
          ? 'Match with someone to start chatting'
          : chatFilter === 'direct'
          ? 'No listing conversations yet'
          : chatFilter === 'groups'
          ? 'Join or create a group to start a group chat'
          : isHostMode
          ? "Accept renters' inquiries to start a conversation"
          : 'No conversations yet'}
      </Text>
      <Pressable style={styles.chatEmptyCta} onPress={() => (navigation as any).navigate('Explore')}>
        <Text style={styles.chatEmptyCtaText}>Browse Listings</Text>
        <Feather name="arrow-right" size={14} color="#ff6b5b" />
      </Pressable>
    </View>
  );

  const handleSearchToggle = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible) setSearchQuery('');
  };

  const handleCompose = () => {
    if (newMatches.length > 0) {
      const firstMatch = newMatches[0];
      navigateToMatchChat(firstMatch.profile, firstMatch.match);
    } else {
      alert({ title: 'No New Matches', message: 'Match with roommates on the Match tab to start a new conversation.', variant: 'info' });
    }
  };

  const DIVIDER_ITEM = { id: '__cold_divider__', __isDivider: true } as any;

  const filteredConversations = (() => {
    let convs = conversations;
    if (searchQuery.trim()) {
      convs = convs.filter(c =>
        c.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (chatFilter === 'people') {
      const peopleConvs = convs.filter(c => getConvType(c) === 'people');
      const matched = peopleConvs.filter(c => c.matchType !== 'cold');
      const cold = peopleConvs.filter(c => c.matchType === 'cold');
      if (matched.length > 0 && cold.length > 0) {
        return [...matched, DIVIDER_ITEM, ...cold];
      }
      return peopleConvs;
    }

    if (chatFilter !== 'all') {
      convs = convs.filter(c => getConvType(c) === chatFilter);
    }
    return convs;
  })();

  const FILTER_TABS: { key: ChatFilterKey; label: string; count: number }[] = [
    { key: 'all',    label: 'All',     count: totalUnread },
    { key: 'people', label: 'People',  count: peopleUnread },
    { key: 'direct', label: 'Direct',  count: directUnread },
    { key: 'groups', label: 'Groups',  count: groupUnread },
  ];

  return (
    <View style={[styles.container, { backgroundColor: '#111' }]}>
      <View style={[styles.chatHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.chatHeaderLeft}>
          <Text style={styles.chatHeaderTitle}>
            {isHostMode ? 'Renter Chats' : 'Messages'}
          </Text>
          {totalUnread > 0 ? (
            <View style={styles.chatHeaderBadge}>
              <Text style={styles.chatHeaderBadgeText}>{totalUnread}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.chatHeaderActions}>
          <Pressable style={styles.chatHeaderBtn} onPress={handleSearchToggle}>
            <Feather name={isSearchVisible ? 'x' : 'search'} size={18} color="rgba(255,255,255,0.6)" />
          </Pressable>
          {!isHostMode ? (
            <Pressable style={styles.chatHeaderBtn} onPress={handleCompose}>
              <Feather name="edit-2" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isSearchVisible ? (
        <Animated.View style={msgCollapsibleStyle}>
          <View style={styles.searchBarContainer}>
            <Feather name="search" size={14} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x-circle" size={14} color="rgba(255,255,255,0.4)" />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.chatFilterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chatFilterScroll}
        >
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.chatFilterTab, chatFilter === tab.key && styles.chatFilterTabActive]}
              onPress={() => setChatFilter(tab.key)}
            >
              <Text style={[styles.chatFilterText, chatFilter === tab.key && styles.chatFilterTextActive]}>
                {tab.label}
              </Text>
              {tab.count > 0 ? (
                <View style={[styles.chatFilterBadge, chatFilter === tab.key && styles.chatFilterBadgeActive]}>
                  <Text style={[styles.chatFilterBadgeText, chatFilter === tab.key && styles.chatFilterBadgeTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <AnimatedFlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item: any) => item.__isDivider ? '__cold_divider__' : item.id}
        ListHeaderComponent={!isSearchVisible ? renderHeader : null}
        ListFooterComponent={!isSearchVisible ? renderFooterNudge : null}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100, flexGrow: filteredConversations.length === 0 ? 1 : undefined },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={msgScrollHandler}
        scrollEventThrottle={16}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatHeaderTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  chatHeaderBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  chatHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  chatHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: 40,
  },
  chatFilterWrap: {
    paddingBottom: 8,
  },
  chatFilterScroll: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
  },
  chatFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatFilterTabActive: {
    backgroundColor: '#ff6b5b',
    borderColor: 'transparent',
  },
  chatFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  chatFilterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  chatFilterBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  chatFilterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chatFilterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
  },
  chatFilterBadgeTextActive: {
    color: '#fff',
  },
  aiConvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  aiConvAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiConvContent: {
    flex: 1,
    gap: 4,
  },
  aiConvName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  aiConvSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  proBadge: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  lockedBadge: {
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderColor: 'rgba(168,85,247,0.25)',
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.5,
  },
  sectionLabelWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  matchesRow: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 14,
  },
  matchBubble: {
    alignItems: 'center',
    gap: 6,
  },
  matchAvatarWrap: {
    position: 'relative',
  },
  matchAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#111',
  },
  matchAvatarNewRing: {
    borderWidth: 0,
    shadowColor: '#ff6b5b',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  matchAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  matchScoreDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#ff6b5b',
    borderWidth: 2,
    borderColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  matchScoreText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  matchName: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    maxWidth: 58,
  },
  list: {
    paddingHorizontal: 0,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  convRowUnmatched: {
    opacity: 0.55,
  },
  convAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  convAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convAvatarLetter: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#2ecc71',
    borderWidth: 2,
    borderColor: '#111',
  },
  convContent: {
    flex: 1,
    gap: 4,
  },
  convTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  convNameMuted: {
    color: 'rgba(255,255,255,0.4)',
  },
  convTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    flexShrink: 0,
  },
  convTimeUnread: {
    color: '#ff6b5b',
    fontWeight: '700',
  },
  convMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    flex: 1,
    marginRight: 8,
  },
  convPreviewMuted: {
    color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  convTagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  matchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  directTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  directTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },
  iceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  iceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  iceChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  nudgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  nudgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  nudgeSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 18,
    textAlign: 'center',
  },
  chatEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  chatEmptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  chatEmptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  chatEmptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  chatEmptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
    borderRadius: 14,
  },
  chatEmptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  inquiryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  inquiryThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  inquiryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inquiryStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inquiryMembersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inquiryConvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  inquiryConvThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  inquiryConvInfo: {
    flex: 1,
    gap: 3,
  },
  inquiryConvTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inquiryConvTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  inquiryStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  inquiryStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inquiryStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inquiryConvPrice: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  inquiryConvLastMsg: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  superInterestRow: {
    backgroundColor: 'rgba(255,215,0,0.04)',
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  superInterestAccent: {
    width: 3,
    height: '80%' as any,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    marginRight: 4,
  },
  superInterestConvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  superInterestConvBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
  },
  coldTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coldTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },
  coldDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  coldDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  coldDividerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.8,
  },
});
