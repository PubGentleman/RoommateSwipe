import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, ScrollView, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Conversation, Match, RoommateProfile } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '../../navigation/MessagesStackNavigator';
import { Image } from 'expo-image';
import { getVerificationLevel } from '../../components/VerificationBadge';
import { calculateCompatibility } from '../../utils/matchingAlgorithm';
import { LinearGradient } from 'expo-linear-gradient';
import { PlanBadge } from '../../components/PlanBadge';
import { AIFloatingButton } from '../../components/AIFloatingButton';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';
import { User } from '../../types/models';

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

export const MessagesScreen = () => {
  const navigation = useNavigation<MessagesScreenNavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, RoommateProfile>>(new Map());
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [newMatches, setNewMatches] = useState<{ profile: RoommateProfile; match: Match; compatibility: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);

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
      const allUsers = await StorageService.getUsers();
      const pMap = new Map(profiles.map(p => [p.id, p]));
      const uMap = new Map(allUsers.map(u => [u.id, u]));
      setProfilesMap(pMap);
      setUsersMap(uMap);

      const recentMatchProfiles: { profile: RoommateProfile; match: Match; compatibility: number }[] = [];

      for (const match of matches) {
        if (match.userId1 !== user.id && match.userId2 !== user.id) continue;

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

        const otherProfile = pMap.get(otherUserId);
        if (otherProfile) {
          const compatibility = user ? calculateCompatibility(user, otherProfile) : 50;
          recentMatchProfiles.push({ profile: otherProfile, match, compatibility });
        }
      }

      recentMatchProfiles.sort((a, b) => b.match.matchedAt.getTime() - a.match.matchedAt.getTime());
      setNewMatches(recentMatchProfiles.slice(0, 10));

      const blockedIds = user.blockedUsers || [];
      const userConversations = existingConversations.filter(
        c => !blockedIds.includes(c.participant.id) && (
          c.id.startsWith('conv-interest-') ||
          matches.some(match => 
            (match.userId1 === user.id && match.userId2 === c.participant.id) ||
            (match.userId2 === user.id && match.userId1 === c.participant.id)
          )
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
          online: Math.random() > 0.5,
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
              <ThemedText style={styles.matchAvatarText}>
                {item.profile.name.charAt(0).toUpperCase()}
              </ThemedText>
            </LinearGradient>
          )}
          <View style={styles.matchScoreDot}>
            <ThemedText style={styles.matchScoreText}>{item.compatibility}%</ThemedText>
          </View>
        </View>
        <ThemedText style={styles.matchName} numberOfLines={1}>
          {item.profile.name.split(' ')[0]}
        </ThemedText>
      </Pressable>
    );
  };

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    const hasUnread = item.unread > 0;
    const isNew = isNewMatch(item);
    const compatibility = getCompatibilityForConversation(item.participant.id);
    const profile = profilesMap.get(item.participant.id);
    const participantUser = usersMap.get(item.participant.id);
    const participantPlan = participantUser?.subscription?.plan;
    const isVerified = profile ? getVerificationLevel(profile.verification) >= 2 : false;

    return (
      <Pressable
        style={styles.convItem}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.convAvatarWrap}>
          {item.participant.photo ? (
            <Image source={{ uri: item.participant.photo }} style={styles.convAvatar} />
          ) : (
            <LinearGradient
              colors={getAvatarGradient(item.participant.id)}
              style={styles.convAvatar}
            >
              <ThemedText style={styles.convAvatarText}>
                {item.participant.name.charAt(0).toUpperCase()}
              </ThemedText>
            </LinearGradient>
          )}
          {canSeeOnlineStatus() && item.participant.online ? (
            <View style={styles.onlineDot} />
          ) : null}
        </View>

        <View style={styles.convBody}>
          <View style={styles.convTop}>
            <View style={styles.convNameRow}>
              <ThemedText style={[styles.convName, !hasUnread && !isNew ? styles.convNameRead : null]} numberOfLines={1}>
                {item.participant.name}
              </ThemedText>
              <PlanBadge plan={participantPlan} size={13} />
              {isVerified ? (
                <Feather name="check-circle" size={14} color="#5b8cff" style={{ marginLeft: 4 }} />
              ) : null}
            </View>
            <ThemedText style={[styles.convTime, hasUnread ? styles.convTimeUnread : null]}>
              {formatTime(item.timestamp)}
            </ThemedText>
          </View>

          <View style={styles.convBottom}>
            <ThemedText
              style={[
                styles.convPreview,
                hasUnread ? styles.convPreviewUnread : null,
                isNew ? styles.convPreviewMatch : null,
              ]}
              numberOfLines={1}
            >
              {isNew ? 'You matched! Say hello' : item.lastMessage}
            </ThemedText>
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <ThemedText style={styles.unreadBadgeText}>{item.unread}</ThemedText>
              </View>
            ) : null}
          </View>

          {compatibility !== null ? (
            <View style={styles.convMetaRow}>
              <View style={styles.convMatchTag}>
                <Feather name="heart" size={10} color="rgba(255,107,91,0.7)" />
                <ThemedText style={styles.convMatchTagText}>{compatibility}% match</ThemedText>
              </View>
            </View>
          ) : null}

          {isNew ? (
            <View style={styles.iceRow}>
              {ICE_BREAKERS.map((ib, i) => (
                <Pressable
                  key={i}
                  style={styles.iceChip}
                  onPress={() => sendIceBreaker(item, ib.text)}
                >
                  <Feather name={ib.icon} size={12} color="rgba(255,255,255,0.45)" />
                  <ThemedText style={styles.iceChipText}>{ib.text}</ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View>
      {newMatches.length > 0 ? (
        <>
          <ThemedText style={styles.sectionLabel}>New Matches</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matchesRow}
          >
            {newMatches.map((m, i) => renderMatchBubble(m, i))}
          </ScrollView>
          <View style={styles.divider} />
        </>
      ) : null}
      <ThemedText style={[styles.sectionLabel, { paddingBottom: 8 }]}>Conversations</ThemedText>
    </View>
  );

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
        <ThemedText style={styles.nudgeTitle}>Keep the momentum going</ThemedText>
        <ThemedText style={styles.nudgeSubtitle}>
          You have {unmessaged.length} new match{unmessaged.length !== 1 ? 'es' : ''} waiting.{'\n'}Don't let them go cold!
        </ThemedText>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="message-square" size={26} color="#ff6b5b" />
      </View>
      <ThemedText style={styles.emptyTitle}>No Messages Yet</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        Match with roommates on the{'\n'}Match tab to start chatting
      </ThemedText>
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
      Alert.alert('No New Matches', 'Match with roommates on the Match tab to start a new conversation.');
    }
  };

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  return (
    <View style={[styles.container, { backgroundColor: '#111' }]}>
      <View style={[styles.topNav, { paddingTop: insets.top + 14 }]}>
        <ThemedText style={styles.topNavTitle}>Messages</ThemedText>
        <View style={styles.navActions}>
          <Pressable style={styles.iconBtn} onPress={handleSearchToggle}>
            <Feather name={isSearchVisible ? 'x' : 'search'} size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={handleCompose}>
            <Feather name="edit" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      </View>

      <AIFloatingButton onPress={() => setShowAISheet(true)} top={insets.top + 60} />

      {isSearchVisible ? (
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
      ) : null}

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={item => item.id}
        ListHeaderComponent={!isSearchVisible ? renderHeader : null}
        ListFooterComponent={!isSearchVisible ? renderFooterNudge : null}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100, flexGrow: filteredConversations.length === 0 ? 1 : undefined },
        ]}
        showsVerticalScrollIndicator={false}
      />

      <RoomdrAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="messages"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  topNavTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
  },
  navActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    marginHorizontal: 22,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 22,
    paddingBottom: 10,
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 22,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  convAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  convAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    backgroundColor: '#2ecc71',
    borderWidth: 2.5,
    borderColor: '#111',
    borderRadius: 6,
  },
  convBody: {
    flex: 1,
    minWidth: 0,
  },
  convTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  convNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  convName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#fff',
  },
  convNameRead: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  convTime: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.28)',
    flexShrink: 0,
  },
  convTimeUnread: {
    color: '#ff6b5b',
    fontWeight: '700',
  },
  convBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  convPreview: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '400',
    flex: 1,
  },
  convPreviewUnread: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  convPreviewMatch: {
    color: '#ff8070',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#ff6b5b',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  convMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  convMatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  convMatchTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,107,91,0.7)',
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyIcon: {
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 18,
    textAlign: 'center',
  },
});
