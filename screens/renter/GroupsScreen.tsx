import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, TextInput, ScrollView, Modal, Image, InteractionManager } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring, withTiming, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Group, RoommateProfile, GroupType } from '../../types/models';
import { StorageService } from '../../utils/storage';
import { getGroups as getGroupsFromSupabase, getMyGroups as getMyGroupsFromSupabase, getMyInquiryGroups as getMyInquiryGroupsFromSupabase, joinGroup as joinGroupSupabase, leaveGroup as leaveGroupSupabase, archiveGroup as archiveGroupSupabase, getMemberLimit, getMyPendingInvites, getMyPendingCompanyInvites, respondToInvite, updateGroup as updateGroupSupabase } from '../../services/groupService';
import { getMyListings } from '../../services/listingService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGenderSymbol, calculateCompatibility } from '../../utils/matchingAlgorithm';
import { getCityFromNeighborhood } from '../../utils/locationData';
import { getVerificationLevel } from '../../components/VerificationBadge';
import { getZodiacSymbol } from '../../utils/zodiacUtils';
import { AdBanner } from '../../components/AdBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { AIFloatingButton } from '../../components/AIFloatingButton';
import { AppHeader } from '../../components/AppHeader';
import { getGroupsHealth, GroupHealthResult } from '../../utils/groupHealthScore';
import { getAllGroupQuickStats, GroupQuickStats } from '../../utils/groupQuickStats';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { PlanBadgeInline } from '../../components/LockedFeatureOverlay';
import { useCityContext } from '../../contexts/CityContext';
import { CityPickerModal, CityPillButton } from '../../components/CityPickerModal';
import { RhomeAISheet } from '../../components/RhomeAISheet';
import { useConfirm } from '../../contexts/ConfirmContext';
import { AIGroupSuggestionCard } from '../../components/AIGroupSuggestionCard';
import { getPendingAutoGroupCount, isAutoMatchEnabled } from '../../services/piAutoMatchService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReportBlockModal } from '../../components/ReportBlockModal';
import { reportUser, blockUser as blockUserRemote } from '../../services/moderationService';
import { withTimeout } from '../../utils/queryTimeout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xxl;

type Tab = 'my-groups' | 'discover' | 'create';

export const GroupsScreen = () => {
  const { theme } = useTheme();
  const { user, purchaseUndoPass, hasActiveUndoPass, blockUser: blockUserLocal } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLikedNotification, setShowLikedNotification] = useState(false);
  const [likedGroupName, setLikedGroupName] = useState('');
  const [lastSwipedGroup, setLastSwipedGroup] = useState<{ group: Group; action: 'like' | 'skip' } | null>(null);
  const [showUndoUpgradeModal, setShowUndoUpgradeModal] = useState(false);
  const [processingUndoPass, setProcessingUndoPass] = useState(false);
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [processingMessagePurchase, setProcessingMessagePurchase] = useState(false);
  const [messageTargetUserId, setMessageTargetUserId] = useState<string | null>(null);
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RoommateProfile | null>(null);
  const [avatarsExpanded, setAvatarsExpanded] = useState(false);
  const { activeCity, activeSubArea, recentCities, setActiveCity, setActiveSubArea } = useCityContext();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);
  const [showMemberReportModal, setShowMemberReportModal] = useState(false);
  const [reportMemberTarget, setReportMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const GRP_COLLAPSE_H = 52;
  const grpScrollY = useSharedValue(0);
  const grpScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { grpScrollY.value = event.contentOffset.y; },
  });
  const grpCollapsibleStyle = useAnimatedStyle(() => {
    const translateY = interpolate(grpScrollY.value, [0, GRP_COLLAPSE_H], [0, -GRP_COLLAPSE_H], Extrapolation.CLAMP);
    const opacity = interpolate(grpScrollY.value, [0, GRP_COLLAPSE_H * 0.6], [1, 0], Extrapolation.CLAMP);
    const maxH = interpolate(grpScrollY.value, [0, GRP_COLLAPSE_H], [GRP_COLLAPSE_H, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity, maxHeight: maxH, overflow: 'hidden' as const };
  });
  const [profileCache, setProfileCache] = useState<RoommateProfile[]>([]);
  const [likedGroupIds, setLikedGroupIds] = useState<Set<string>>(new Set());
  const [mutualGroupIds, setMutualGroupIds] = useState<Set<string>>(new Set());
  const [groupLikeCounts, setGroupLikeCounts] = useState<Map<string, number>>(new Map());
  const [inquiryGroups, setInquiryGroups] = useState<any[]>([]);
  const [showPastInquiries, setShowPastInquiries] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [companyInvites, setCompanyInvites] = useState<any[]>([]);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [groupHealthScores, setGroupHealthScores] = useState<Record<string, GroupHealthResult>>({});
  const [bestGroupId, setBestGroupId] = useState<string | null>(null);
  const [groupQuickStats, setGroupQuickStats] = useState<Record<string, GroupQuickStats>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [piPendingCount, setPiPendingCount] = useState(0);
  const [piAutoMatchActive, setPiAutoMatchActive] = useState(false);

  const userPlan = user?.subscription?.plan || 'basic';

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const isAnimatingSwipe = useSharedValue(false);
  const cardOpacity = useSharedValue(1);

  const lastLoadedRef = React.useRef<number>(0);
  const STALE_AFTER_MS = 30000;

  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      const isStale = now - lastLoadedRef.current > STALE_AFTER_MS;

      if (!isStale && myGroups.length > 0) {
        return;
      }

      lastLoadedRef.current = now;
      loadGroups();
      loadLikedGroupState();
      if (user) {
        getMyPendingInvites(user.id)
          .then(setPendingInvites)
          .catch(() => {
            StorageService.getPendingGroupInvites(user.id).then(setPendingInvites).catch(() => {});
          });
        getMyPendingCompanyInvites(user.id)
          .then(setCompanyInvites)
          .catch(() => setCompanyInvites([]));
      }
      if (user?.role === 'host') {
        getMyListings(user.id).catch(() => {});
      }
    }, [user, activeCity, activeSubArea])
  );

  useEffect(() => {
    AsyncStorage.getItem('pending_group_create').then(val => {
      if (val === 'true') {
        AsyncStorage.removeItem('pending_group_create');
        navigation.navigate('GroupSetup' as never);
      }
    });
    AsyncStorage.getItem('pending_group_join_code').then(val => {
      if (val) {
        AsyncStorage.removeItem('pending_group_join_code');
        navigation.navigate('GroupInviteAccept' as never, { inviteCode: val } as never);
      }
    });
  }, []);

  useEffect(() => {
    if (myGroups.length > 0 && user) {
      const timer = setTimeout(() => {
        const ids = myGroups.map((g: any) => g.id);
        Promise.all([
          getGroupsHealth(ids, user.id),
          getAllGroupQuickStats(ids, user.id),
        ]).then(([scores, stats]) => {
          setGroupHealthScores(scores);
          setGroupQuickStats(stats);
          const ranked = Object.entries(scores)
            .filter(([, h]) => h.score > 0)
            .sort(([, a], [, b]) => b.score - a.score);
          setBestGroupId(ranked.length > 0 ? ranked[0][0] : null);
        }).catch(() => {});
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [myGroups]);

  const loadLikedGroupState = async () => {
    if (!user) return;
    try {
      const userLikes = await StorageService.getGroupLikesForUser(user.id);
      setLikedGroupIds(new Set(userLikes.map((l: any) => l.group_id)));
      setMutualGroupIds(new Set(
        userLikes.filter((l: any) => l.admin_liked_back).map((l: any) => l.group_id)
      ));
    } catch {
      // ignore
    }
  };

  const loadGroupLikeCounts = async (groups: Group[]) => {
    if (!user) return;
    const adminGroups = groups.filter(g => g.createdBy === user.id);
    if (adminGroups.length === 0) return;

    const results = await Promise.all(
      adminGroups.map(async (g) => {
        const count = await StorageService.getGroupLikeCount(g.id);
        return { id: g.id, count };
      })
    );

    const counts = new Map<string, number>();
    results.forEach(({ id, count }) => {
      if (count > 0) counts.set(id, count);
    });
    setGroupLikeCounts(counts);
  };

  const loadGroups = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const cachedProfiles = await StorageService.getRoommateProfiles();
      setProfileCache(cachedProfiles);
      let userGroups: Group[] = [];
      let otherGroups: Group[] = [];
      
      try {
        const [discoverResult, myGroupsResult, inquiryResult] = await withTimeout(
          Promise.allSettled([
            getGroupsFromSupabase(activeCity || undefined, 'roommate'),
            getMyGroupsFromSupabase(user.id, 'roommate'),
            getMyInquiryGroupsFromSupabase(user.id),
          ]),
          5000
        );

        const supabaseGroups = discoverResult.status === 'fulfilled' ? discoverResult.value : [];
        const supabaseMyGroups = myGroupsResult.status === 'fulfilled' ? myGroupsResult.value : [];
        const supabaseInquiryGroups = inquiryResult.status === 'fulfilled' ? inquiryResult.value : [];

        if (discoverResult.status === 'rejected') {
          console.warn('[GroupsScreen] Discover groups failed:', discoverResult.reason);
        }
        if (myGroupsResult.status === 'rejected') {
          console.warn('[GroupsScreen] My groups failed:', myGroupsResult.reason);
        }
        if (inquiryResult.status === 'rejected') {
          console.warn('[GroupsScreen] Inquiry groups failed:', inquiryResult.reason);
        }

        const myGroupIds = new Set((supabaseMyGroups || []).map((g: any) => g.id));
        const mapGroup = (g: any): Group & { listingPhoto?: string } => ({
          id: g.id,
          type: g.type || 'roommate',
          name: g.name,
          description: g.description,
          members: (g.members || []).map((m: any) => m.user_id || m.id).filter(Boolean),
          pendingMembers: [],
          budget: g.budget_min || 0,
          budgetMin: g.budget_min,
          budgetMax: g.budget_max,
          city: g.city,
          state: g.state,
          moveInDate: g.move_in_date,
          photoUrl: g.photo_url,
          preferredLocation: g.city || '',
          maxMembers: g.listing?.bedrooms ? g.listing.bedrooms + 1 : (g.max_members || getMemberLimit(userPlan)),
          createdAt: new Date(g.created_at),
          createdBy: g.created_by,
          listingId: g.listing_id,
          hostId: g.host_id,
          listingAddress: g.listing_address,
          isArchived: g.is_archived || false,
          memberCount: Array.isArray(g.members) ? g.members.length : 0,
          hostName: g.host_name || 'Group',
          listingPhoto: g.listing?.photos?.[0] || undefined,
          inquiryStatus: g.inquiry_status || 'pending',
          addressRevealed: g.address_revealed || false,
        });
        userGroups = (supabaseMyGroups || []).map(mapGroup);
        otherGroups = (supabaseGroups || [])
          .filter((g: any) => !myGroupIds.has(g.id))
          .map(mapGroup);
        setInquiryGroups((supabaseInquiryGroups || []).map(mapGroup));
      } catch (supabaseError) {
        console.warn('[GroupsScreen] Supabase failed, falling back to StorageService:', supabaseError);
        const groups = await StorageService.getGroups();
        userGroups = groups.filter(g => g.members.includes(user.id));
        const filterCity = activeCity;
        const filterSubArea = activeSubArea;
        const subAreaNeighborhoods = filterCity && filterSubArea
          ? require('../../utils/locationData').getNeighborhoodsBySubArea(filterCity, filterSubArea) as string[]
          : [];
        otherGroups = groups.filter(g => {
          if (!g.members || g.members.length === 0) return false;
          if (g.members.includes(user.id) || g.pendingMembers.includes(user.id)) return false;
          if (filterCity && g.preferredLocation) {
            const groupCity = getCityFromNeighborhood(g.preferredLocation);
            if (groupCity && groupCity !== filterCity) return false;
            if (filterSubArea && subAreaNeighborhoods.length > 0) {
              if (!subAreaNeighborhoods.some((n: string) =>
                g.preferredLocation.toLowerCase().includes(n.toLowerCase())
              )) return false;
            }
          }
          return true;
        });
      }
      
      const blockedIds = new Set(user?.blockedUsers || []);
      if (blockedIds.size > 0) {
        otherGroups = otherGroups.filter(g =>
          !blockedIds.has(g.createdBy || '') &&
          !(g.members || []).some(m => blockedIds.has(m))
        );
      }
      setMyGroups(userGroups);
      setAllGroups(otherGroups);
      setCurrentIndex(0);
      loadGroupLikeCounts(userGroups);

      if (user?.id) {
        Promise.all([
          getPendingAutoGroupCount(user.id),
          isAutoMatchEnabled(user.id),
        ]).then(([count, active]) => {
          setPiPendingCount(count);
          setPiAutoMatchActive(active);
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentGroup = allGroups[currentIndex];

  const calculateGroupCompatibility = (group: Group): number => {
    if (!user) return 0;
    
    const memberProfiles = (group.members || [])
      .map(id => profileCache.find(p => p.id === id))
      .filter((p): p is RoommateProfile => p !== null && p !== undefined);
    
    if (memberProfiles.length === 0) return 0;
    
    const scores = memberProfiles.map(profile => calculateCompatibility(user, profile));
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return Math.round(averageScore);
  };

  const getCompatibilityColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 70) return '#2196F3'; // Blue
    if (score >= 60) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getCompatibilityLabel = (score: number): string => {
    if (score >= 80) return 'Great Match';
    if (score >= 70) return 'Good Match';
    if (score >= 60) return 'Fair Match';
    return 'Low Match';
  };

  const MemberAvatarStack = ({ group }: { group: Group }) => {
    const MAX_VISIBLE = 4;
    const AVATAR_SIZE = 90;
    const OVERLAP = 28;
    const EXPANDED_SPACING = 110;

    const memberProfiles = (group.members || [])
      .map(id => profileCache.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined)
      .slice(0, MAX_VISIBLE);

    const remainingCount = Math.max(0, (group.members || []).length - MAX_VISIBLE);

    const handleMemberPress = (profile: RoommateProfile) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMember(profile);
      setShowMemberProfile(true);
      setAvatarsExpanded(false);
    };

    const handleStackPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAvatarsExpanded(!avatarsExpanded);
    };

    const totalMembers = memberProfiles.length + (remainingCount > 0 ? 1 : 0);
    const stackWidth = avatarsExpanded 
      ? totalMembers * EXPANDED_SPACING
      : AVATAR_SIZE + (totalMembers - 1) * (AVATAR_SIZE - OVERLAP);
    const centerOffset = (CARD_WIDTH - stackWidth) / 2;

    return (
      <Pressable 
        onPress={handleStackPress}
        style={styles.avatarStackContainer}
      >
        <View style={{ position: 'relative', width: stackWidth, height: AVATAR_SIZE }}>
          {memberProfiles.map((profile, index) => {
            const baseLeft = index * (AVATAR_SIZE - OVERLAP);
            const expandedLeft = index * EXPANDED_SPACING;
            
            return (
              <Pressable
                key={profile.id}
                onPress={(e) => {
                  e.stopPropagation();
                  handleMemberPress(profile);
                }}
                style={[
                  styles.avatarWrapper,
                  {
                    left: avatarsExpanded ? expandedLeft : baseLeft,
                    zIndex: MAX_VISIBLE - index,
                  }
                ]}
              >
                {profile.photos && profile.photos.length > 0 ? (
                  <Image
                    source={{ uri: profile.photos[0] }}
                    style={[styles.avatar, { borderColor: theme.backgroundDefault }]}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primary, borderColor: theme.backgroundDefault }]}>
                    <Feather name="user" size={32} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            );
          })}
          
          {remainingCount > 0 ? (
            <View
              style={[
                styles.avatarWrapper,
                {
                  left: avatarsExpanded 
                    ? memberProfiles.length * EXPANDED_SPACING 
                    : memberProfiles.length * (AVATAR_SIZE - OVERLAP),
                  zIndex: 0,
                }
              ]}
            >
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.textSecondary, borderColor: theme.backgroundDefault }]}>
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  +{remainingCount}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const handleLikeGroup = async (group: Group) => {
    if (!user) return;

    const alreadyLiked = likedGroupIds.has(group.id);
    if (alreadyLiked) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { likeGroup: likeGroupSupabase } = await import('../../services/groupService');
      await likeGroupSupabase(user.id, group.id);
    } catch {
      await StorageService.addGroupLike(group.id, user.id);
    }

    setLikedGroupIds(prev => new Set([...prev, group.id]));

    setLikedGroupName(group.name);
    setShowLikedNotification(true);
    setTimeout(() => { setShowLikedNotification(false); }, 1800);
  };

  const handleRequestToJoin = async (group: Group) => {
    if (!user) return;
    const isMutual = mutualGroupIds.has(group.id);
    if (!isMutual) {
      await showAlert({ title: 'Not Yet', message: 'Like this group first. If the admin likes you back, you can request to join.', variant: 'info' });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { requestToJoinGroup } = await import('../../services/groupService');
      await requestToJoinGroup(user.id, group.id);
    } catch {
      await StorageService.likeGroup(group.id, user.id);
    }
    await showAlert({ title: 'Request Sent', message: 'Join request sent! The admin will review it.', variant: 'success' });
  };

  const advanceGroupCard = () => {
    InteractionManager.runAfterInteractions(() => {
      setCurrentIndex(prev => prev + 1);
      translateX.value = 0;
      translateY.value = 0;
      rotation.value = 0;
      cardOpacity.value = 1;
      isAnimatingSwipe.value = false;
    });
  };

  const handleSwipeAction = async (action: 'like' | 'skip') => {
    if (!currentGroup || isAnimatingSwipe.value) return;

    isAnimatingSwipe.value = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setLastSwipedGroup({ group: currentGroup, action });

    const direction = action === 'like' ? 1 : -1;
    const toX = direction * SCREEN_WIDTH * 1.5;
    const exitDuration = 200;

    cardOpacity.value = 0;
    translateX.value = withTiming(toX, { duration: exitDuration });
    rotation.value = withTiming(direction * 15, { duration: exitDuration }, () => {
      runOnJS(advanceGroupCard)();
    });

    if (action === 'like') {
      handleLikeGroup(currentGroup).catch(err =>
        console.warn('[GroupsScreen] Background like error:', err)
      );
    }
  };

  const handleUndo = () => {
    if (!hasActiveUndoPass()) {
      setShowUndoUpgradeModal(true);
      return;
    }
    
    if (!lastSwipedGroup || isAnimatingSwipe.value) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    undoLastSwipeAsync(lastSwipedGroup.group.id, lastSwipedGroup.action);
    
    translateX.value = 0;
    translateY.value = 0;
    rotation.value = 0;
    cardOpacity.value = 1;
    setCurrentIndex(currentIndex - 1);
    setLastSwipedGroup(null);
  };

  const undoLastSwipeAsync = async (groupId: string, action: 'like' | 'skip') => {
    try {
      if (action === 'like') {
        try {
          const { unlikeGroupLike } = await import('../../services/groupService');
          await unlikeGroupLike(user!.id, groupId);
        } catch {
          await StorageService.removeGroupLike(groupId, user!.id);
        }
        setLikedGroupIds(prev => { const s = new Set(prev); s.delete(groupId); return s; });
      }
    } catch (error) {
      console.error('[GroupsScreen] Error undoing swipe:', error);
    }
  };

  const handlePurchaseUndoPass = async () => {
    setProcessingUndoPass(true);
    const result = await purchaseUndoPass();
    setProcessingUndoPass(false);
    
    if (result.success) {
      setShowUndoUpgradeModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (result.message.includes('payment method')) {
        (navigation as any).navigate('Plans');
        setShowUndoUpgradeModal(false);
      }
    }
  };

  const handleMessageGroup = async (group: any) => {
    if (!user) return;

    const conversations = await StorageService.getConversations();
    const groupConvId = `group-${group.id}`;
    const existing = conversations.find(c => c.id === groupConvId);

    if (!existing) {
      const memberIds: string[] = (group.members || []).map((m: any) => m.userId || m.id).filter((id: string) => id !== user.id);
      const roommateProfiles = await StorageService.getRoommateProfiles();
      const firstMember = roommateProfiles.find(p => memberIds.includes(p.id));

      const newConversation = {
        id: groupConvId,
        participant: {
          id: firstMember?.id || group.createdBy,
          name: group.name,
          photo: firstMember?.photos?.[0],
          online: false,
        },
        lastMessage: '',
        timestamp: new Date(),
        unread: 0,
        messages: [],
        isGroup: true,
        groupName: group.name,
      };
      await StorageService.addOrUpdateConversation(newConversation);
    }

    navigation.navigate('Chat', { conversationId: groupConvId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSendDirectMessage = async (targetUserId: string) => {
    if (!user) return;
    
    const conversations = await StorageService.getConversations();
    const existingConversation = conversations.find(c =>
      c.participant.id === targetUserId
    );
    
    let conversationId: string;
    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const roommateProfiles = await StorageService.getRoommateProfiles();
      const targetProfile = roommateProfiles.find(p => p.id === targetUserId);
      
      if (!targetProfile) return;
      
      const newConversation = {
        id: `conv-${targetUserId}-${Date.now()}`,
        participant: {
          id: targetProfile.id,
          name: targetProfile.name,
          photo: targetProfile.photos?.[0],
          online: false,
        },
        lastMessage: '',
        timestamp: new Date(),
        unread: 0,
        messages: [],
      };
      await StorageService.addOrUpdateConversation(newConversation);
      conversationId = newConversation.id;
    }
    
    navigation.navigate('Chat', { conversationId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handlePurchaseMessageCredit = async () => {
    setProcessingMessagePurchase(true);
    
    // NOTE: This is a simulated payment flow for demonstration purposes.
    // In a production app, you would need to:
    // 1. Set up a backend API server (Express, etc.)
    // 2. Create a Stripe payment intent for $0.99
    // 3. Handle the payment confirmation
    // 4. Grant the message credit upon successful payment
    // 5. Track message credits in user data
    
    // Simulated payment processing (1 second delay)
    setTimeout(async () => {
      // In production, this would only execute after successful payment
      const users = await StorageService.getUsers();
      const currentUser = users.find(u => u.id === user?.id);
      if (currentUser) {
        // In production: increment message credits
        // currentUser.messageCredits = (currentUser.messageCredits || 0) + 1;
        // await StorageService.updateUser(currentUser);
      }
      
      setProcessingMessagePurchase(false);
      setShowMessageModal(false);
      if (messageTargetUserId) {
        await handleSendDirectMessage(messageTargetUserId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1000);
  };

  const handleUpgradeForMessaging = () => {
    setShowMessageModal(false);
    (navigation as any).navigate('Plans');
  };

  const openGroupDetail = () => {
    setShowGroupDetail(true);
  };

  const tap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(openGroupDetail)();
    });

  const pan = Gesture.Pan()
    .minDistance(10)
    .onChange((event) => {
      if (isAnimatingSwipe.value) return;
      translateX.value = event.translationX;
      rotation.value = event.translationX / 20;
    })
    .onEnd((event) => {
      if (isAnimatingSwipe.value) return;
      if (Math.abs(event.translationX) > 80) {
        const action = event.translationX > 0 ? 'like' : 'skip';
        runOnJS(handleSwipeAction)(action);
      } else {
        translateX.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const cardGesture = Gesture.Race(pan, tap);

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = `${rotation.value}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { rotate },
      ],
      opacity: cardOpacity.value,
      zIndex: 10,
    };
  });

  const handleAcceptInvite = async (invite: any) => {
    try {
      await respondToInvite(user!.id, invite.id, 'accepted');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await showAlert({ title: 'Joined!', message: `You have joined "${invite.groupName}".`, variant: 'success' });
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      await loadGroups();
    } catch {
      await showAlert({ title: 'Error', message: 'Could not accept invite. Try again.', variant: 'warning' });
    }
  };

  const handleDeclineInvite = async (invite: any) => {
    try {
      await respondToInvite(user!.id, invite.id, 'declined');
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch {
      await showAlert({ title: 'Error', message: 'Could not decline invite. Try again.', variant: 'warning' });
    }
  };

  const handleLeaveGroup = async (group: Group) => {
    if (!user) return;
    const isGroupAdmin = group.createdBy === user.id;
    const hasOtherMembers = group.members.length > 1;

    if (isGroupAdmin && hasOtherMembers) {
      await showAlert({ title: 'Promote Someone First', message: 'You are the admin. Open group settings to promote another member before leaving.', variant: 'warning' });
      return;
    }

    const isLast = group.members.length <= 1;
    const confirmed = await confirm({
      title: isLast ? 'Delete Group?' : 'Leave Group?',
      message: isLast
        ? `You are the last member of "${group.name}". Leaving will permanently delete this group.`
        : `Are you sure you want to leave "${group.name}"?`,
      confirmText: isLast ? 'Delete' : 'Leave',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        await leaveGroupSupabase(user.id, group.id);
      } catch (supabaseError) {
        console.warn('[GroupsScreen] Supabase leaveGroup failed, falling back:', supabaseError);
        await StorageService.leaveGroup(group.id, user.id);
      }
      loadGroups();
    }
  };

  const handleRemoveMember = async (groupId: string, memberId: string, memberName: string) => {
    const confirmed = await confirm({
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberName} from the group?`,
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (confirmed) {
      await StorageService.removeMemberFromGroup(groupId, memberId);
      loadGroups();
    }
  };

  const handleAcceptMember = async (groupId: string, userId: string, userName: string) => {
    const success = await StorageService.acceptGroupMember(groupId, userId);
    if (!success) {
      await showAlert({
        title: 'Cannot Accept',
        message: `${userName} has already joined another group. They must leave that group first before joining this one.`,
        variant: 'warning',
      });
    }
    loadGroups();
  };

  const handleRejectMember = async (groupId: string, userId: string) => {
    await StorageService.rejectGroupMember(groupId, userId);
    loadGroups();
  };

  const handleArchiveInquiry = async (group: any) => {
    const confirmed = await confirm({
      title: 'Archive Inquiry',
      message: `Archive the inquiry for "${group.listingAddress || group.name}"? The chat will become read-only.`,
      confirmText: 'Archive',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        await archiveGroupSupabase(group.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadGroups();
      } catch (err) {
        console.error('Failed to archive inquiry:', err);
        await showAlert({ title: 'Error', message: 'Failed to archive inquiry', variant: 'warning' });
      }
    }
  };

  const handleOpenGroupChat = (group: Group) => {
    navigation.navigate('Chat', { conversationId: `group-${group.id}` });
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDescription(group.description || '');
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateGroupSupabase(editingGroup.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      } as any);
    } catch (err) {
      console.warn('Supabase group update failed (expected in demo):', err);
    }
    setMyGroups(prev =>
      prev.map(g =>
        g.id === editingGroup.id
          ? { ...g, name: editName.trim(), description: editDescription.trim() || '' }
          : g
      )
    );
    setEditingGroup(null);
    setSavingEdit(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderInquiryGroup = (group: any) => {
    return (
      <Pressable
        key={group.id}
        style={[styles.myGroupCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          navigation.navigate('Chat', { conversationId: `inquiry_${group.id}`, inquiryGroup: group });
        }}
        onLongPress={() => {
          if (!group.isArchived) handleArchiveInquiry(group);
        }}
      >
        <View style={styles.groupHeader}>
          {(group as any).listingPhoto ? (
            <Image source={{ uri: (group as any).listingPhoto }} style={[styles.groupIcon, { borderRadius: 12 }]} />
          ) : (
            <View style={[styles.groupIcon, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
              <Feather name="home" size={20} color="#ff6b5b" />
            </View>
          )}
          <View style={styles.groupInfo}>
            <ThemedText style={[Typography.h3]} numberOfLines={1}>
              {group.addressRevealed
                ? (group.listingAddress || group.name)
                : (group.listingAddress?.split(',').slice(-2).join(',').trim() || group.name)}
            </ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              With {group.hostName || 'Host'} · {group.memberCount || 0} members
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {group.isArchived ? (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>Archived</ThemedText>
              </View>
            ) : group.inquiryStatus === 'accepted' ? (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(255,107,91,0.15)' }]}>
                <ThemedText style={[Typography.small, { color: '#ff6b5b' }]}>Address Unlocked 🔓</ThemedText>
              </View>
            ) : group.inquiryStatus === 'declined' ? (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <ThemedText style={[Typography.small, { color: '#ef4444' }]}>Declined</ThemedText>
              </View>
            ) : (
              <View style={[styles.inquiryBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>Pending</ThemedText>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderMyGroup = (group: Group) => {
    const isCreator = group.createdBy === user?.id;
    const memberProfiles = (group.members || [])
      .map(id => profileCache.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined);
    const pendingCount = (group.pendingMembers || []).length;
    const filled = group.members.length;
    const total = group.maxMembers || 4;
    const fillPercent = filled / total;

    return (
      <Pressable
        key={group.id}
        style={[styles.redesignCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => handleOpenGroupChat(group)}
      >
        <View style={[styles.accentBar, { backgroundColor: theme.primary }]} />

        <View style={{ flex: 1, paddingLeft: 14 }}>
          <View style={styles.cardTopRow}>
            <View style={styles.avatarStack}>
              {memberProfiles.slice(0, 3).map((profile, i) => {
                const photo = profile?.photos?.[0] || profile?.profilePicture;
                return photo ? (
                  <Image
                    key={profile.id}
                    source={{ uri: photo }}
                    style={[
                      styles.stackAvatar,
                      { borderColor: theme.card, zIndex: 3 - i, marginLeft: i === 0 ? 0 : -10 },
                    ]}
                  />
                ) : (
                  <View
                    key={profile.id}
                    style={[
                      styles.stackAvatar,
                      { backgroundColor: theme.primary, borderColor: theme.card, zIndex: 3 - i, marginLeft: i === 0 ? 0 : -10, alignItems: 'center', justifyContent: 'center' },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>
                      {(profile.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                );
              })}
              {memberProfiles.length === 0 ? (
                <View style={[styles.stackAvatar, { backgroundColor: theme.primary, borderColor: theme.card, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="users" size={14} color="#fff" />
                </View>
              ) : null}
              {filled > 3 ? (
                <View style={[styles.stackAvatar, { backgroundColor: theme.border, borderColor: theme.card, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary }}>+{filled - 3}</Text>
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <ThemedText style={[Typography.body, { fontWeight: '800' }]} numberOfLines={1}>
                  {group.name}
                </ThemedText>
                {isCreator ? (
                  <View style={[styles.adminPill, { backgroundColor: theme.primary + '25' }]}>
                    <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '700' }}>Admin</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: fillPercent >= 1 ? '#22C55E' : theme.primary,
                        width: `${Math.min(fillPercent * 100, 100)}%` as any,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.slotText, { color: theme.textSecondary }]}>{filled}/{total}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
                {filled} member{filled !== 1 ? 's' : ''} · {filled} room{filled !== 1 ? 's' : ''} needed
              </Text>

            </View>

            {pendingCount > 0 ? (
              <View style={[styles.pendingBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{pendingCount}</Text>
              </View>
            ) : null}
            {isCreator && (groupLikeCounts.get(group.id) ?? 0) > 0 ? (
              <Pressable
                style={styles.likeBadge}
                onPress={(e) => {
                  e.stopPropagation?.();
                  navigation.navigate('InterestedUsers', { groupId: group.id, groupName: group.name });
                }}
              >
                <Feather name="heart" size={11} color="#fff" />
                <Text style={styles.likeBadgeText}>
                  {(groupLikeCounts.get(group.id) ?? 0) > 9 ? '9+' : groupLikeCounts.get(group.id)}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {group.description ? (
            <ThemedText
              style={[Typography.small, { color: theme.textSecondary, marginTop: 8, marginBottom: 8 }]}
              numberOfLines={2}
            >
              {group.description}
            </ThemedText>
          ) : null}

          <View style={styles.chipRow}>
            {group.budget ? (
              <View style={[styles.chip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                <Feather name="dollar-sign" size={10} color={theme.primary} />
                <Text style={[styles.chipText, { color: theme.primary }]}>${group.budget}/mo</Text>
              </View>
            ) : null}
            {group.preferredLocation ? (
              <View style={[styles.chip, { backgroundColor: theme.border + '60', borderColor: theme.border }]}>
                <Feather name="map-pin" size={10} color={theme.textSecondary} />
                <Text style={[styles.chipText, { color: theme.textSecondary }]}>{group.preferredLocation}</Text>
              </View>
            ) : null}
            {group.linkedListing || group.listingId ? (
              <View style={[styles.chip, { backgroundColor: '#22C55E15', borderColor: '#22C55E40' }]}>
                <Feather name="home" size={10} color="#22C55E" />
                <Text style={[styles.chipText, { color: '#22C55E' }]}>Property Linked</Text>
              </View>
            ) : null}
            {group.bedrooms ? (
              <View style={[styles.chip, { backgroundColor: theme.border + '60', borderColor: theme.border }]}>
                <Feather name="grid" size={10} color={theme.textSecondary} />
                <Text style={[styles.chipText, { color: theme.textSecondary }]}>{group.bedrooms} bed</Text>
              </View>
            ) : null}
          </View>

          {companyInvites.some(ci => ci.groupId === group.id) ? (
            <Pressable
              style={styles.companyInviteBadge}
              onPress={() => {
                const ci = companyInvites.find(c => c.groupId === group.id);
                if (ci) navigation.navigate('CompanyGroupInvite', { listingId: ci.listingId, groupId: ci.groupId });
              }}
            >
              <Feather name="briefcase" size={12} color="#ff6b5b" />
              <Text style={styles.companyInviteBadgeText}>A property manager selected your group</Text>
              <Feather name="chevron-right" size={12} color="#ff6b5b" />
            </Pressable>
          ) : null}

          {groupHealthScores[group.id] ? (
            <View style={styles.healthRow}>
              <View style={[styles.healthDot, { backgroundColor: groupHealthScores[group.id].statusColor }]} />
              <Text style={[styles.healthLabel, { color: groupHealthScores[group.id].statusColor }]}>
                {groupHealthScores[group.id].statusLabel}
              </Text>
              <Text style={styles.healthScore}>
                {' '}· {groupHealthScores[group.id].score}%
              </Text>
              {groupHealthScores[group.id].topConflict ? (
                <Feather name="alert-circle" size={12} color="#f39c12" />
              ) : null}
            </View>
          ) : null}

          {groupHealthScores[group.id]?.status === 'conflict' ? (
            <Text style={styles.conflictSnippet} numberOfLines={1}>
              {groupHealthScores[group.id].topConflict}
            </Text>
          ) : null}

          {groupQuickStats[group.id] && (groupQuickStats[group.id].suggestedMemberCount > 0 || groupQuickStats[group.id].matchingApartmentCount > 0) ? (
            <View style={styles.quickStatsRow}>
              {groupQuickStats[group.id].suggestedMemberCount > 0 ? (
                <Pressable
                  style={styles.quickStatChip}
                  onPress={() => navigation.navigate('GroupInfo', { groupId: group.id, scrollTo: 'suggestions' })}
                >
                  <Feather name="user-plus" size={11} color="#ff6b5b" />
                  <Text style={styles.quickStatText}>
                    {groupQuickStats[group.id].suggestedMemberCount} suggested
                  </Text>
                </Pressable>
              ) : null}
              {groupQuickStats[group.id].matchingApartmentCount > 0 ? (
                <Pressable
                  style={styles.quickStatChip}
                  onPress={() => {
                    if (renterLimits.hasAIApartmentSuggestions) {
                      navigation.navigate('GroupApartmentSuggestions', { groupId: group.id });
                    } else {
                      navigation.navigate('Plans');
                    }
                  }}
                >
                  <Feather name={renterLimits.hasAIApartmentSuggestions ? "home" : "lock"} size={11} color={renterLimits.hasAIApartmentSuggestions ? "#3498db" : "rgba(168,85,247,0.6)"} />
                  <Text style={[styles.quickStatText, { color: renterLimits.hasAIApartmentSuggestions ? '#3498db' : 'rgba(168,85,247,0.6)' }]}>
                    {groupQuickStats[group.id].matchingApartmentCount} apt{groupQuickStats[group.id].matchingApartmentCount !== 1 ? 's' : ''} match
                  </Text>
                  {!renterLimits.hasAIApartmentSuggestions ? <PlanBadgeInline plan="Plus" locked /> : null}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
            {group.members.length <= 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
                <Feather name="user-plus" size={12} color={theme.primary} />
                <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>Looking for roommates</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
                {memberProfiles.map(p => p.name?.split(' ')[0] || '').filter(Boolean).join(', ')}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={[styles.cardActionBtn, { backgroundColor: theme.primary }]}
                onPress={() => handleOpenGroupChat(group)}
              >
                <Feather name="message-circle" size={13} color="#fff" />
                <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700', marginLeft: 4 }}>Chat</Text>
              </Pressable>
              <Pressable
                style={[styles.cardActionBtn, { backgroundColor: theme.border }]}
                onPress={() => navigation.navigate('GroupInfo', { groupId: group.id, groupName: group.name })}
              >
                <Feather name="info" size={13} color={theme.text} />
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    if (activeTab === 'my-groups') {
      const activeInquiries = inquiryGroups.filter(g => !g.isArchived);
      const archivedInquiries = inquiryGroups.filter(g => g.isArchived);

      return (
        <Animated.ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={styles.myGroupsList}
          showsVerticalScrollIndicator={false}
          onScroll={grpScrollHandler}
          scrollEventThrottle={16}
        >
          {companyInvites.length > 0 ? (
            <View style={styles.invitesSection}>
              <View style={styles.sectionHeader}>
                <Feather name="home" size={16} color="#ff6b5b" />
                <ThemedText style={[Typography.h3, { marginLeft: 8 }]}>Property Invites</ThemedText>
              </View>
              {companyInvites.map(invite => (
                <Pressable
                  key={invite.id}
                  style={[styles.inviteCard, { borderColor: 'rgba(255,107,91,0.3)', borderWidth: 1 }]}
                  onPress={() => navigation.navigate('CompanyGroupInvite', {
                    listingId: invite.listingId,
                    groupId: invite.groupId,
                  })}
                >
                  <View style={styles.inviteInfo}>
                    <Feather name="zap" size={16} color="#ff6b5b" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <ThemedText style={styles.inviteGroupName}>
                        {invite.bedrooms}BR in {invite.neighborhood || 'Available Area'}
                      </ThemedText>
                      <ThemedText style={styles.inviteFrom}>
                        {invite.companyName} selected {invite.groupName} · {invite.matchScore}% match
                      </ThemedText>
                      {invite.price ? (
                        <ThemedText style={{ fontSize: 12, color: '#ff6b5b', marginTop: 2 }}>
                          ${invite.price.toLocaleString()}/mo
                        </ThemedText>
                      ) : null}
                    </View>
                    <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {pendingInvites.length > 0 ? (
            <View style={styles.invitesSection}>
              <View style={styles.sectionHeader}>
                <Feather name="mail" size={16} color="#ff6b5b" />
                <ThemedText style={[Typography.h3, { marginLeft: 8 }]}>Group Invites</ThemedText>
              </View>
              {pendingInvites.map(invite => (
                <View key={invite.id} style={styles.inviteCard}>
                  <View style={styles.inviteInfo}>
                    <Feather name="users" size={16} color="#ff6b5b" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <ThemedText style={styles.inviteGroupName}>{invite.groupName}</ThemedText>
                      <ThemedText style={styles.inviteFrom}>
                        Invited by {invite.invitedByName}{invite.listingTitle ? ` · ${invite.listingTitle}` : ''}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.inviteActions}>
                    <Pressable
                      style={styles.inviteAccept}
                      onPress={() => handleAcceptInvite(invite)}
                    >
                      <Text style={styles.inviteAcceptText}>Join</Text>
                    </Pressable>
                    <Pressable
                      style={styles.inviteDecline}
                      onPress={() => handleDeclineInvite(invite)}
                    >
                      <Text style={styles.inviteDeclineText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {bestGroupId && groupHealthScores[bestGroupId] && myGroups.length > 1 ? (
            <Pressable
              style={styles.bestGroupBanner}
              onPress={() => navigation.navigate('GroupInfo', { groupId: bestGroupId })}
            >
              <LinearGradient
                colors={['#1a1a1a', '#222']}
                style={styles.bestGroupGradient}
              >
                <View style={styles.bestGroupHeader}>
                  <Feather name="zap" size={13} color="#ff6b5b" />
                  <Text style={styles.bestGroupLabel}>BEST GROUP TO SEARCH WITH</Text>
                </View>
                <Text style={styles.bestGroupName}>
                  {myGroups.find((g: any) => g.id === bestGroupId)?.name ?? 'Your Group'}
                </Text>
                <View style={styles.bestGroupMeta}>
                  <Text style={[styles.bestGroupScore, { color: groupHealthScores[bestGroupId].statusColor }]}>
                    {groupHealthScores[bestGroupId].score}% compatible
                  </Text>
                  {groupHealthScores[bestGroupId].sharedNeighborhoods.length > 0 ? (
                    <Text style={styles.bestGroupNeighborhoods}>
                      {' '}· {groupHealthScores[bestGroupId].sharedNeighborhoods.slice(0, 2).join(', ')}
                    </Text>
                  ) : null}
                </View>
                {groupHealthScores[bestGroupId].readyToSearch ? (
                  <Text style={styles.readyBadge}>Ready to search</Text>
                ) : null}
              </LinearGradient>
            </Pressable>
          ) : null}

          <View style={[styles.sectionHeader, styles.sectionRow]}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              MY ROOMMATE GROUPS
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              {myGroups.length} {myGroups.length === 1 ? 'group' : 'groups'}
            </ThemedText>
          </View>
          <AIGroupSuggestionCard
            onAccepted={() => loadGroups()}
          />
          {piPendingCount > 0 ? (
            <Pressable
              style={[styles.piCtaCard, { backgroundColor: '#1a1a2e', borderColor: 'rgba(255,107,91,0.3)', borderWidth: 1 }]}
              onPress={() => navigation.navigate('PiGroupInvite', {})}
            >
              <View style={styles.piCtaIconWrap}>
                <Text style={styles.piCtaIcon}>π</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={styles.piCtaTitle}>Pi found you a match!</ThemedText>
                <ThemedText style={[styles.piCtaDesc, { color: 'rgba(255,255,255,0.6)' }]}>
                  {piPendingCount} pending {piPendingCount === 1 ? 'invite' : 'invites'} from Pi Auto-Match
                </ThemedText>
              </View>
              <View style={[styles.piCtaBadge, { backgroundColor: '#ff6b5b' }]}>
                <Text style={styles.piCtaBadgeText}>{piPendingCount}</Text>
              </View>
            </Pressable>
          ) : null}

          {myGroups.length === 0 ? (
            <View style={[styles.emptyState, { paddingVertical: 30 }]}>
              <Feather name="users" size={40} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                {piAutoMatchActive
                  ? 'No groups yet — Pi is looking for your perfect roommates!'
                  : 'No groups yet — let AI find your perfect roommates!'}
              </ThemedText>
              {piAutoMatchActive ? (
                piPendingCount > 0 ? (
                  <Pressable
                    style={[styles.piCtaBtn, { backgroundColor: '#ff6b5b', marginTop: 16 }]}
                    onPress={() => navigation.navigate('PiGroupInvite', {})}
                  >
                    <Text style={styles.piCtaIcon}>π</Text>
                    <Text style={styles.piCtaBtnText}>View Pi match ({piPendingCount})</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.piCtaBtn, { backgroundColor: '#ff6b5b', marginTop: 16 }]}
                    onPress={() => navigation.navigate('Profile', { screen: 'PiAutoMatchSettings' })}
                  >
                    <Text style={styles.piCtaIcon}>π</Text>
                    <Text style={styles.piCtaBtnText}>Let Pi find my roommates</Text>
                  </Pressable>
                )
              ) : (
                <Pressable
                  style={[styles.piCtaBtn, { backgroundColor: '#ff6b5b', marginTop: 16 }]}
                  onPress={() => navigation.navigate('Profile', { screen: 'PiAutoMatchSettings' })}
                >
                  <Text style={styles.piCtaIcon}>π</Text>
                  <Text style={styles.piCtaBtnText}>Enable Pi Auto-Match</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.piCtaBtn, { backgroundColor: '#3B82F6', marginTop: 12 }]}
                onPress={() => navigation.navigate('OpenGroups')}
              >
                <Feather name="search" size={16} color="#fff" />
                <Text style={styles.piCtaBtnText}>Find a Group to Join</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {myGroups.map(group => renderMyGroup(group))}
              <Pressable
                style={[styles.findGroupBtn, { borderColor: theme.border }]}
                onPress={() => navigation.navigate('OpenGroups')}
              >
                <Feather name="search" size={16} color={theme.primary} />
                <Text style={[styles.findGroupBtnText, { color: theme.primary }]}>
                  Find a Group to Join
                </Text>
              </Pressable>
            </>
          )}

          <View style={[styles.sectionHeader, styles.sectionRow, { marginTop: 24 }]}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              LISTING INQUIRIES
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              {activeInquiries.length} {activeInquiries.length === 1 ? 'inquiry' : 'inquiries'}
            </ThemedText>
          </View>
          {activeInquiries.length === 0 ? (
            <View style={[styles.emptyState, { paddingVertical: 30 }]}>
              <Feather name="home" size={40} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                No listing inquiries yet
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                Tap "Inquire Together" on any listing to start one
              </ThemedText>
            </View>
          ) : (
            activeInquiries.map(group => renderInquiryGroup(group))
          )}

          {archivedInquiries.length > 0 ? (
            <>
              <Pressable
                style={[styles.sectionHeader, { marginTop: 24 }]}
                onPress={() => setShowPastInquiries(!showPastInquiries)}
              >
                <Feather name="archive" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { marginLeft: 8, color: theme.textSecondary }]}>
                  Past Inquiries ({archivedInquiries.length})
                </ThemedText>
                <Feather
                  name={showPastInquiries ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.textSecondary}
                  style={{ marginLeft: 'auto' }}
                />
              </Pressable>
              {showPastInquiries ? archivedInquiries.map(group => renderInquiryGroup(group)) : null}
            </>
          ) : null}
        </Animated.ScrollView>
      );
    }

    if (activeTab === 'discover') {
      if (!currentGroup) {
        return (
          <View style={styles.emptyState}>
            <Feather name="users" size={64} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              {activeCity ? `No Groups in ${activeCity}` : 'No More Groups'}
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              {activeCity
                ? 'Try browsing All Cities or switch to a different city'
                : "You've seen all available groups.\nCheck back later for new groups!"}
            </ThemedText>
          </View>
        );
      }

      const compatibility = calculateGroupCompatibility(currentGroup);
      const spotsLeft = currentGroup.maxMembers - currentGroup.members.length;
      const memberProfiles = currentGroup.members
        .map(id => profileCache.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);

      return (
        <View style={styles.cardContainer}>
          <GestureDetector gesture={cardGesture}>
            <Animated.View style={[styles.card, animatedCardStyle]}>
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={styles.cardContent}
                showsVerticalScrollIndicator={false}
              >
                <LinearGradient
                  colors={[
                    compatibility >= 80 ? 'rgba(46,204,113,0.12)' :
                    compatibility >= 60 ? 'rgba(255,107,91,0.10)' :
                    'rgba(255,255,255,0.04)',
                    'transparent'
                  ]}
                  style={styles.dkCardHeaderGlow}
                />

                <View style={styles.dkAvatarCluster}>
                  {memberProfiles.slice(0, 3).map((profile, i) => {
                    const gradients: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d']];
                    return (
                      <Pressable
                        key={profile.id}
                        onPress={() => { setSelectedMember(profile); setShowMemberProfile(true); }}
                        style={[styles.dkAvatar, i > 0 && { marginLeft: -16 }, { zIndex: 3 - i }]}
                      >
                        {profile.photos?.[0] ? (
                          <Image source={{ uri: profile.photos[0] }} style={styles.dkAvatarImg} />
                        ) : (
                          <LinearGradient colors={gradients[i % 3]} style={styles.dkAvatarImg}>
                            <Text style={styles.dkAvatarLetter}>{profile.name[0]}</Text>
                          </LinearGradient>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.dkMembersCount}>
                  <Feather name="users" size={12} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.dkMembersCountText}>
                    {currentGroup.members.length} of {currentGroup.maxMembers} filled
                  </Text>
                  {spotsLeft > 0 ? (
                    <View style={styles.dkSpotPill}>
                      <Text style={styles.dkSpotPillText}>{spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left</Text>
                    </View>
                  ) : (
                    <View style={[styles.dkSpotPill, { backgroundColor: 'rgba(255,107,91,0.1)', borderColor: 'rgba(255,107,91,0.2)' }]}>
                      <Text style={[styles.dkSpotPillText, { color: '#ff6b5b' }]}>Full</Text>
                    </View>
                  )}
                </View>

                <View style={styles.dkMatchBadge}>
                  <Feather name="heart" size={12} color="#ff8070" />
                  <Text style={styles.dkMatchBadgeText}>{compatibility}% Group Match</Text>
                </View>

                <Text style={styles.dkGroupName}>{currentGroup.name}</Text>

                {currentGroup.description ? (
                  <Text style={styles.dkGroupDesc}>{currentGroup.description}</Text>
                ) : null}

                <View style={styles.dkStatsRow}>
                  <View style={styles.dkStatCard}>
                    <View style={styles.dkStatIcon}>
                      <Feather name="dollar-sign" size={16} color="#ff6b5b" />
                    </View>
                    <View>
                      <Text style={styles.dkStatLabel}>BUDGET</Text>
                      <Text style={styles.dkStatValue}>${currentGroup.budget?.toLocaleString()}/mo</Text>
                    </View>
                  </View>
                  <View style={styles.dkStatCard}>
                    <View style={styles.dkStatIcon}>
                      <Feather name="map-pin" size={16} color="#ff6b5b" />
                    </View>
                    <View>
                      <Text style={styles.dkStatLabel}>LOCATION</Text>
                      <Text style={styles.dkStatValue} numberOfLines={1}>{currentGroup.preferredLocation}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.dkDivider} />

                {memberProfiles.length > 0 ? (
                  <View style={styles.dkMembersSection}>
                    <Text style={styles.dkMembersLabel}>CURRENT MEMBERS</Text>
                    <View style={styles.dkMembersList}>
                      {memberProfiles.map((profile, i) => {
                        const gradients: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d']];
                        return (
                          <Pressable
                            key={profile.id}
                            style={styles.dkMemberChip}
                            onPress={() => { setSelectedMember(profile); setShowMemberProfile(true); }}
                          >
                            {profile.photos?.[0] ? (
                              <Image source={{ uri: profile.photos[0] }} style={styles.dkMemberAvatar} />
                            ) : (
                              <LinearGradient colors={gradients[i % 3]} style={styles.dkMemberAvatar}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{profile.name[0]}</Text>
                              </LinearGradient>
                            )}
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.dkMemberName}>{profile.name.split(' ')[0]}</Text>
                                {getVerificationLevel(profile.verification) >= 2 ? (
                                  <Feather name="check-circle" size={12} color="#2563EB" style={{ marginLeft: 3 }} />
                                ) : null}
                              </View>
                              <Text style={styles.dkMemberMeta}>
                                {profile.occupation?.split(' ')[0] || 'Member'}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </Animated.View>
          </GestureDetector>

          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.dkActBtn, styles.dkActSm, styles.dkActUndo, { opacity: lastSwipedGroup ? 1 : 0.4 }]}
              onPress={handleUndo}
            >
              <Feather name="rotate-ccw" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <View style={styles.dkActGlowRed}>
              <Pressable
                style={[styles.dkActBtn, styles.dkActLg, styles.dkActPass]}
                onPress={() => handleSwipeAction('skip')}
              >
                <Feather name="x" size={26} color="#ff4d4d" />
              </Pressable>
            </View>
            <View style={styles.dkActGlowGreen}>
              <Pressable
                style={[styles.dkActBtn, styles.dkActXl, styles.dkActJoin]}
                onPress={() => handleSwipeAction('like')}
              >
                <Feather name="heart" size={30} color={likedGroupIds.has(currentGroup?.id ?? '') ? '#22C55E' : '#2ecc71'} />
              </Pressable>
            </View>
          </View>

          <View style={styles.swipeHint}>
            <View style={styles.swipeHintItem}>
              <Feather name="arrow-left" size={12} color="rgba(255,255,255,0.2)" />
              <Text style={styles.dkHintText}>Skip</Text>
            </View>
            {mutualGroupIds.has(currentGroup?.id ?? '') ? (
              <Pressable style={styles.swipeHintItem} onPress={() => currentGroup && handleRequestToJoin(currentGroup)}>
                <Text style={[styles.dkHintText, { color: '#ff6b5b', fontWeight: '700' }]}>Request to Join</Text>
                <Feather name="arrow-right" size={12} color="#ff6b5b" />
              </Pressable>
            ) : (
              <View style={styles.swipeHintItem}>
                <Text style={styles.dkHintText}>Like</Text>
                <Feather name="arrow-right" size={12} color="rgba(255,255,255,0.2)" />
              </View>
            )}
          </View>
        </View>
      );
    }

    navigation.navigate('CreateGroup');
    setActiveTab('discover');
    return null;
  };


  return (
    <View style={[styles.container, { backgroundColor: '#111111', paddingTop: 0, paddingBottom: insets.bottom + 80 }]}>
      <AppHeader
        title="Groups"
        role="renter"
        hideSeparator
        rightActions={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => navigation.navigate('Events')}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(108,92,231,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="calendar" size={16} color="#6C5CE7" />
            </Pressable>
            <AIFloatingButton onPress={() => setShowAISheet(true)} position="inline" />
          </View>
        }
      />

      <View style={styles.tabBar}>
        {(['my-groups', 'discover', 'create'] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'my-groups' ? 'My Groups' : tab === 'discover' ? 'Discover' : 'Create';
          return (
            <Pressable key={tab} style={styles.tab} onPress={() => { grpScrollY.value = 0; setActiveTab(tab); }}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
              {isActive ? (
                <LinearGradient
                  colors={['#ff6b5b', '#e83a2a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabIndicator}
                />
              ) : null}
            </Pressable>
          );
        })}
        <View style={styles.tabBarLine} />
      </View>

      <Animated.View style={grpCollapsibleStyle}>
        {activeTab === 'discover' ? (
          <View style={styles.citySelectorRow}>
            <CityPillButton activeCity={activeCity} activeSubArea={activeSubArea} onPress={() => setShowCityPicker(true)} />
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {showLikedNotification ? (
        <View style={styles.likedToast}>
          <Feather name="heart" size={16} color="#fff" />
          <Text style={styles.likedToastText}>
            Interest sent to {likedGroupName}
          </Text>
        </View>
      ) : null}

      <Modal
        visible={!!editingGroup}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingGroup(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editGroupModal, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.editGroupModalHeader}>
              <ThemedText style={[Typography.h3]}>Edit Group</ThemedText>
              <Pressable onPress={() => setEditingGroup(null)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: 6 }]}>Group Name</ThemedText>
            <TextInput
              style={[styles.editGroupInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Group name"
              placeholderTextColor={theme.textSecondary}
              maxLength={50}
            />

            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: 6, marginTop: 16 }]}>Description</ThemedText>
            <TextInput
              style={[styles.editGroupInput, styles.editGroupTextArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="What is your group about?"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            <View style={styles.editGroupActions}>
              <Pressable
                style={[styles.editGroupCancelBtn, { borderColor: theme.border }]}
                onPress={() => setEditingGroup(null)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.editGroupSaveBtn, { backgroundColor: theme.primary, opacity: savingEdit || !editName.trim() ? 0.5 : 1 }]}
                onPress={handleSaveGroupEdit}
                disabled={savingEdit || !editName.trim()}
              >
                {savingEdit
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '700' }]}>Save</ThemedText>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUndoUpgradeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUndoUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.warning }]}>
              <Feather name="rotate-ccw" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Undo Swipe
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Take back your last swipe and get a second chance!
              </ThemedText>
              
              <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.lg }]}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                  24-Hour Undo Pass
                </ThemedText>
                <ThemedText style={[Typography.h1, { color: theme.warning, marginBottom: Spacing.xs }]}>
                  $1.99
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Undo swipes for 24 hours
                </ThemedText>
              </View>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Take back your last swipe
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    24-hour unlimited undo access
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.warning, opacity: processingUndoPass ? 0.7 : 1 }]}
                onPress={handlePurchaseUndoPass}
                disabled={processingUndoPass}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  {processingUndoPass ? 'Processing...' : 'Get 24hr Pass - $1.99'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.primary, marginTop: Spacing.md }]}
                onPress={() => {
                  setShowUndoUpgradeModal(false);
                  navigation.navigate('Settings');
                }}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade to Plus
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowUndoUpgradeModal(false)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Maybe Later
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGroupDetail && currentGroup != null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGroupDetail(false)}
      >
        <View style={styles.gdOverlay}>
          <View style={styles.gdSheet}>

            <View style={styles.gdHandle} />

            <View style={styles.gdHeader}>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setShowGroupDetail(false)} style={styles.gdCloseBtn} hitSlop={8}>
                <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.gdScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {currentGroup ? (() => {
                const compatibility = calculateGroupCompatibility(currentGroup);
                const spotsLeft = currentGroup.maxMembers - currentGroup.members.length;
                const memberProfiles = currentGroup.members
                  .map(id => profileCache.find(p => p.id === id))
                  .filter((p): p is NonNullable<typeof p> => !!p);

                return (
                  <>
                    <View style={styles.gdHero}>

                      <View style={styles.gdAvatarStack}>
                        {memberProfiles.length === 0 ? (
                          <View style={styles.gdAvatarEmpty}>
                            <Feather name="users" size={28} color="rgba(255,255,255,0.4)" />
                          </View>
                        ) : (
                          memberProfiles.slice(0, 4).map((profile, i) => {
                            const gradients: [string, string][] = [
                              ['#667eea', '#764ba2'],
                              ['#f093fb', '#f5576c'],
                              ['#11998e', '#38ef7d'],
                              ['#f7971e', '#ffd200'],
                            ];
                            const size = 56;
                            const overlap = 16;
                            return profile.photos?.[0] ? (
                              <Image
                                key={profile.id}
                                source={{ uri: profile.photos[0] }}
                                style={[
                                  styles.gdAvatarImg,
                                  {
                                    position: 'absolute',
                                    left: i * (size - overlap),
                                    zIndex: 10 - i,
                                  },
                                ]}
                              />
                            ) : (
                              <LinearGradient
                                key={profile.id}
                                colors={gradients[i % 4]}
                                style={[
                                  styles.gdAvatarImg,
                                  {
                                    position: 'absolute',
                                    left: i * (size - overlap),
                                    zIndex: 10 - i,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  },
                                ]}
                              >
                                <Text style={styles.gdAvatarLetter}>
                                  {profile.name[0].toUpperCase()}
                                </Text>
                              </LinearGradient>
                            );
                          })
                        )}
                        {spotsLeft > 0 && memberProfiles.length > 0 ? (
                          <View
                            style={[
                              styles.gdAvatarImg,
                              styles.gdAvatarOpenSlot,
                              {
                                position: 'absolute',
                                left: Math.min(memberProfiles.length, 4) * (56 - 16),
                                zIndex: 0,
                              },
                            ]}
                          >
                            <Text style={styles.gdAvatarPlus}>+{spotsLeft}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={{
                        height: 56,
                        width: Math.min(memberProfiles.length, 4) * (56 - 16) + 56 + (spotsLeft > 0 ? 40 : 0),
                        marginBottom: 16,
                      }} />

                      <View style={[
                        styles.gdMatchBadge,
                        {
                          backgroundColor: compatibility >= 80
                            ? 'rgba(46,204,113,0.15)'
                            : 'rgba(255,107,91,0.15)',
                          borderColor: compatibility >= 80
                            ? 'rgba(46,204,113,0.3)'
                            : 'rgba(255,107,91,0.3)',
                        }
                      ]}>
                        <Feather
                          name="heart"
                          size={11}
                          color={compatibility >= 80 ? '#2ecc71' : '#ff8070'}
                        />
                        <Text style={[
                          styles.gdMatchBadgeText,
                          { color: compatibility >= 80 ? '#2ecc71' : '#ff8070' }
                        ]}>
                          {compatibility}% Match
                        </Text>
                      </View>

                      <Text style={styles.gdGroupName}>{currentGroup.name}</Text>

                      <View style={styles.gdMembersRow}>
                        <Feather name="users" size={12} color="rgba(255,255,255,0.35)" />
                        <Text style={styles.gdMembersText}>
                          {currentGroup.members.length} of {currentGroup.maxMembers} members
                        </Text>
                        <View style={[
                          styles.gdSpotPill,
                          spotsLeft === 0 && { backgroundColor: 'rgba(255,107,91,0.1)', borderColor: 'rgba(255,107,91,0.2)' }
                        ]}>
                          <Text style={[
                            styles.gdSpotPillText,
                            spotsLeft === 0 && { color: '#ff6b5b' }
                          ]}>
                            {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft > 1 ? 's' : ''} left` : 'Full'}
                          </Text>
                        </View>
                      </View>

                      {currentGroup.description ? (
                        <Text style={styles.gdDescription}>{currentGroup.description}</Text>
                      ) : null}
                    </View>

                    <View style={styles.gdInfoRow}>
                      <View style={styles.gdInfoCard}>
                        <View style={styles.gdInfoIconWrap}>
                          <Feather name="dollar-sign" size={15} color="#ff6b5b" />
                        </View>
                        <Text style={styles.gdInfoLabel}>BUDGET</Text>
                        <Text style={styles.gdInfoValue}>${currentGroup.budget?.toLocaleString()}/mo</Text>
                      </View>
                      <View style={styles.gdInfoCard}>
                        <View style={styles.gdInfoIconWrap}>
                          <Feather name="map-pin" size={15} color="#ff6b5b" />
                        </View>
                        <Text style={styles.gdInfoLabel}>LOCATION</Text>
                        <Text style={styles.gdInfoValue} numberOfLines={1}>{currentGroup.preferredLocation}</Text>
                      </View>
                    </View>

                    {(currentGroup.apartmentPrice || currentGroup.bedrooms) ? (
                      <View style={styles.gdInfoRow}>
                        {currentGroup.bedrooms ? (
                          <View style={styles.gdInfoCard}>
                            <View style={styles.gdInfoIconWrap}>
                              <Feather name="grid" size={15} color="#ff6b5b" />
                            </View>
                            <Text style={styles.gdInfoLabel}>BEDROOMS</Text>
                            <Text style={styles.gdInfoValue}>{currentGroup.bedrooms} bed</Text>
                          </View>
                        ) : null}
                        {currentGroup.apartmentPrice ? (
                          <View style={styles.gdInfoCard}>
                            <View style={styles.gdInfoIconWrap}>
                              <Feather name="home" size={15} color="#ff6b5b" />
                            </View>
                            <Text style={styles.gdInfoLabel}>TOTAL RENT</Text>
                            <Text style={styles.gdInfoValue}>${currentGroup.apartmentPrice?.toLocaleString()}/mo</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {memberProfiles.length > 0 ? (
                      <View style={styles.gdMembersSection}>
                        <Text style={styles.gdSectionLabel}>MEMBERS</Text>
                        {memberProfiles.map((profile, i) => {
                          const gradients: [string, string][] = [
                            ['#667eea', '#764ba2'],
                            ['#f093fb', '#f5576c'],
                            ['#11998e', '#38ef7d'],
                          ];
                          const memberPhoto = profile.photos?.[0] || profile.profilePicture;
                          const zodiacText = profile.zodiacSign
                            ? profile.zodiacSign.charAt(0).toUpperCase() + profile.zodiacSign.slice(1).toLowerCase()
                            : null;

                          return (
                            <View key={profile.id} style={styles.gdMemberCard}>
                              {memberPhoto ? (
                                <Image source={{ uri: memberPhoto }} style={styles.gdMemberPhoto} />
                              ) : (
                                <LinearGradient colors={gradients[i % 3]} style={[styles.gdMemberPhoto, { justifyContent: 'center', alignItems: 'center' }]}>
                                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>
                                    {profile.name[0].toUpperCase()}
                                  </Text>
                                </LinearGradient>
                              )}
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={styles.gdMemberName}>
                                    {profile.name}{profile.age ? `, ${profile.age}` : ''}
                                  </Text>
                                  {getVerificationLevel(profile.verification) >= 2 ? (
                                    <Feather name="check-circle" size={13} color="#3b82f6" />
                                  ) : null}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                  {profile.occupation ? (
                                    <View style={styles.gdMemberTag}>
                                      <Text style={styles.gdMemberTagText}>
                                        {profile.occupation.split(' ').slice(0, 2).join(' ')}
                                      </Text>
                                    </View>
                                  ) : null}
                                  {zodiacText ? (
                                    <View style={[styles.gdMemberTag, { backgroundColor: 'rgba(168,85,247,0.12)', borderColor: 'rgba(168,85,247,0.2)' }]}>
                                      <Text style={[styles.gdMemberTagText, { color: '#a855f7' }]}>
                                        {zodiacText}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={{ height: 100 }} />
                  </>
                );
              })() : null}
            </ScrollView>

            <View style={styles.gdActionBar}>
              <Pressable
                style={styles.gdActionLike}
                onPress={() => {
                  setShowGroupDetail(false);
                  if (currentGroup) handleSwipeAction('like');
                }}
              >
                <Feather name="heart" size={20} color="#2ecc71" />
                <Text style={styles.gdActionLikeText}>Interested</Text>
              </Pressable>
              <Pressable
                style={styles.gdActionMessage}
                onPress={() => {
                  setShowGroupDetail(false);
                  if (currentGroup) handleMessageGroup(currentGroup);
                }}
              >
                <Feather name="message-circle" size={20} color="#fff" />
                <Text style={styles.gdActionMessageText}>Message</Text>
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>

      <Modal
        visible={showMessageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.vipModalContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.vipModalHeader, { backgroundColor: theme.primary }]}>
              <Feather name="message-circle" size={32} color="#FFFFFF" />
            </View>
            
            <View style={styles.vipModalContent}>
              <ThemedText style={[Typography.h2, { textAlign: 'center', marginBottom: Spacing.sm }]}>
                Send Direct Message
              </ThemedText>
              <ThemedText style={[Typography.body, { textAlign: 'center', color: theme.textSecondary, marginBottom: Spacing.xl }]}>
                Plus members can send messages without matching. Choose an option below to message this group creator.
              </ThemedText>
              
              <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: Spacing.lg }]}>
                <ThemedText style={[Typography.h3, { marginBottom: Spacing.xs }]}>
                  One-Time Message
                </ThemedText>
                <ThemedText style={[Typography.h1, { color: theme.primary, marginBottom: Spacing.xs }]}>
                  $0.99
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Send a single message to this person
                </ThemedText>
              </View>
              
              <View style={styles.vipFeaturesList}>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    Start a conversation instantly
                  </ThemedText>
                </View>
                <View style={styles.vipFeatureItem}>
                  <Feather name="check-circle" size={20} color={theme.success} />
                  <ThemedText style={[Typography.body, { marginLeft: Spacing.md, flex: 1 }]}>
                    No matching required
                  </ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.vipModalActions}>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.primary, opacity: processingMessagePurchase ? 0.7 : 1 }]}
                onPress={handlePurchaseMessageCredit}
                disabled={processingMessagePurchase}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  {processingMessagePurchase ? 'Processing...' : 'Send Message - $0.99'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButton, { backgroundColor: theme.warning, marginTop: Spacing.md }]}
                onPress={handleUpgradeForMessaging}
              >
                <ThemedText style={[Typography.h3, { color: '#FFFFFF' }]}>
                  Upgrade to Plus
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.vipModalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowMessageModal(false)}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CityPickerModal
        visible={showCityPicker}
        activeCity={activeCity}
        activeSubArea={activeSubArea}
        recentCities={recentCities}
        onCitySelect={(city) => { setActiveCity(city); setShowCityPicker(false); }}
        onSubAreaSelect={setActiveSubArea}
        onClose={() => setShowCityPicker(false)}
      />

      <Modal
        visible={showMemberProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMemberProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.memberProfileModal, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.memberProfileHeader}>
              <ThemedText style={[Typography.h2]}>Member Profile</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {selectedMember ? (
                  <Pressable onPress={() => { setReportMemberTarget({ id: selectedMember.id, name: selectedMember.name }); setShowMemberReportModal(true); }}>
                    <Feather name="more-vertical" size={22} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setShowMemberProfile(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
            </View>
            {selectedMember ? (
              <ScrollView style={styles.memberProfileContent} showsVerticalScrollIndicator={false}>
                {selectedMember.photos && selectedMember.photos.length > 0 ? (
                  <Image source={{ uri: selectedMember.photos[0] }} style={styles.memberProfileImage} />
                ) : null}
                
                <View style={styles.memberProfileSection}>
                  <ThemedText style={[Typography.h2]}>{selectedMember.name}, {selectedMember.age}{selectedMember.zodiacSign ? ` ${getZodiacSymbol(selectedMember.zodiacSign)}` : ''}</ThemedText>
                  <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                    {selectedMember.occupation}
                  </ThemedText>
                </View>

                <View style={styles.memberProfileSection}>
                  <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>About</ThemedText>
                  <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                    {selectedMember.bio}
                  </ThemedText>
                </View>

                <View style={styles.memberProfileSection}>
                  <ThemedText style={[Typography.h3, { marginBottom: Spacing.md }]}>Budget</ThemedText>
                  <ThemedText style={[Typography.h2, { color: theme.primary }]}>
                    ${selectedMember.budget}/month
                  </ThemedText>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>


      <ReportBlockModal
        visible={showMemberReportModal}
        onClose={() => { setShowMemberReportModal(false); setReportMemberTarget(null); }}
        userName={reportMemberTarget?.name || 'User'}
        type="user"
        onReport={async (reason) => {
          try { if (reportMemberTarget) await reportUser(user!.id, reportMemberTarget.id, reason); } catch {}
        }}
        onBlock={async () => {
          try {
            if (reportMemberTarget) {
              await blockUserRemote(user!.id, reportMemberTarget.id);
              await blockUserLocal(reportMemberTarget.id);
              setShowMemberReportModal(false);
              setReportMemberTarget(null);
              setShowMemberProfile(false);
            }
          } catch {}
        }}
      />

      <RhomeAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="groups"
        contextData={activeTab === 'discover' && allGroups[currentIndex] ? {
          groups: {
            currentGroup: allGroups[currentIndex],
            groupCompatibility: calculateGroupCompatibility(allGroups[currentIndex]),
            memberProfiles: allGroups[currentIndex].members
              .map(id => profileCache.find(p => p.id === id))
              .filter((p): p is RoommateProfile => !!p),
            openSpots: allGroups[currentIndex].maxMembers - allGroups[currentIndex].members.length,
          },
        } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  groupsTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  groupsAiBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  groupsAiBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  groupsAiBtnLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    position: 'relative',
  },
  tabBarLine: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2.5,
    borderRadius: 2,
    zIndex: 1,
  },
  citySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myGroupsList: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  myGroupCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  leaveButton: {
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  groupActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  groupChatChevron: {
    marginLeft: 2,
  },
  editGroupModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: BorderRadius.large,
    padding: Spacing.xl,
  },
  editGroupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  editGroupInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  editGroupTextArea: {
    minHeight: 80,
    paddingTop: Spacing.sm,
  },
  editGroupActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.xl,
  },
  editGroupCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  editGroupSaveBtn: {
    flex: 1,
    borderRadius: BorderRadius.small,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  membersSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  pendingSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pendingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  dkAvatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dkAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#1f1f1f',
    overflow: 'hidden',
  },
  dkAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkAvatarLetter: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  dkCardHeaderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dkMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.35)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  dkMatchBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff8070',
  },
  dkGroupName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  dkMembersCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dkMembersCountText: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  dkSpotPill: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  dkSpotPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2ecc71',
  },
  dkGroupDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
    maxWidth: 280,
  },
  dkStatsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 18,
  },
  dkStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 12,
  },
  dkStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dkStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  dkDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  dkMembersSection: {
    width: '100%',
  },
  dkMembersLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  dkMembersList: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  dkMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 24,
    paddingVertical: 7,
    paddingRight: 14,
    paddingLeft: 7,
  },
  dkMemberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dkMemberName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 15,
  },
  dkMemberMeta: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  dkActGlowRed: {
    shadowColor: '#ff4d4d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    borderRadius: 100,
  },
  dkActGlowGreen: {
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
    borderRadius: 100,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 6,
  },
  dkActBtn: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  dkActSm: { width: 46, height: 46 },
  dkActLg: { width: 60, height: 60 },
  dkActXl: { width: 72, height: 72 },
  dkActUndo: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dkActPass: {
    borderColor: '#ff4d4d',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  dkActJoin: {
    borderColor: '#2ecc71',
    backgroundColor: 'rgba(46,204,113,0.1)',
  },
  swipeHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 4,
    width: '100%',
  },
  swipeHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dkHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: 0.3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#111111',
  },
  createForm: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    padding: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  createButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  likedToast: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(46,204,113,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  likedToastText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  vipModalContainer: {
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    paddingBottom: Spacing.xl,
  },
  vipModalHeader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
  },
  vipModalContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  vipModalActions: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  vipModalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
  },
  vipModalButtonSecondary: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  vipFeaturesList: {
    gap: Spacing.md,
  },
  vipFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  gdOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  gdSheet: {
    height: '90%',
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  gdHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  gdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  gdCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gdScrollContent: {
    paddingBottom: 20,
  },
  gdHero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  gdAvatarStack: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 0,
  },
  gdAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#1a1a1a',
  },
  gdAvatarEmpty: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gdAvatarOpenSlot: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderStyle: 'dashed' as const,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 56,
    borderRadius: 20,
  },
  gdAvatarPlus: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  gdAvatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  gdMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  gdMatchBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gdGroupName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  gdMembersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  gdMembersText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  gdSpotPill: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  gdSpotPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2ecc71',
  },
  gdDescription: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  gdInfoRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  gdInfoCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  gdInfoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  gdInfoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.6,
  },
  gdInfoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  gdMembersSection: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  gdSectionLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingLeft: 2,
  },
  gdMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  gdMemberPhoto: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  gdMemberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  gdMemberTag: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gdMemberTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  gdActionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1a1a1a',
  },
  gdActionLike: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(46,204,113,0.3)',
  },
  gdActionLikeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2ecc71',
  },
  gdActionMessage: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#ff6b5b',
  },
  gdActionMessageText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  avatarStackContainer: {
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  avatarWrapper: {
    position: 'absolute',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberProfileModal: {
    height: '85%',
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    overflow: 'hidden',
  },
  memberProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  memberProfileContent: {
    flex: 1,
  },
  memberProfileImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  memberProfileSection: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  compatibilityBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  inquiryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  soloGroupBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 12,
    padding: 14,
    marginTop: Spacing.md,
    marginBottom: 16,
  },
  soloGroupTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  soloGroupDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  invitesSection: {
    marginBottom: 20,
  },
  inviteCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inviteGroupName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  inviteFrom: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteAccept: {
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteAcceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  inviteDecline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteDeclineText: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    fontSize: 13,
  },
  codeEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  codeEntryInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 2,
  },
  codeEntryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  redesignCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingRight: 14,
  },
  accentBar: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginLeft: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  adminPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  slotText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pendingBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  likeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  likeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 3,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  companyInviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
  },
  companyInviteBadgeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b5b',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 5,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  healthScore: {
    fontSize: 12,
    color: '#888',
  },
  conflictSnippet: {
    fontSize: 11,
    color: '#f39c12',
    marginTop: 2,
  },
  bestGroupBanner: {
    marginHorizontal: 0,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bestGroupGradient: {
    padding: 16,
  },
  bestGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  bestGroupLabel: {
    color: '#ff6b5b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bestGroupName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  bestGroupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestGroupScore: {
    fontSize: 13,
    fontWeight: '600',
  },
  bestGroupNeighborhoods: {
    fontSize: 13,
    color: '#888',
  },
  readyBadge: {
    color: '#2ecc71',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  quickStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quickStatText: {
    color: '#ff6b5b',
    fontSize: 11,
    fontWeight: '600',
  },
  piCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  piCtaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  piCtaIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  piCtaTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  piCtaDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  piCtaBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piCtaBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  piCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  piCtaBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  findGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  findGroupBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
