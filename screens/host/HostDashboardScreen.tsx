import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Modal, Linking } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { Property, InterestCard, Message, Conversation, HostSubscriptionData } from '../../types/models';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { useHostBadge } from '../../hooks/useHostBadge';
import { HostBadge } from '../../components/HostBadge';
import { BadgeProgressCard } from '../../components/BadgeProgressCard';
import { getMyListings, mapListingToProperty, getAgentStats, getCompanyAgents, reassignListingAgent, getCompanyListingsWithAgents, getAgentDetailData, reassignConversation, AgentConversationSummary, AgentBookingSummary } from '../../services/listingService';
import { getReceivedInterestCards, acceptInterestCard, rejectInterestCard } from '../../services/discoverService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { RhomeLogo } from '../../components/RhomeLogo';
import { updateGroup } from '../../services/groupService';
import { RhomeAISheet } from '../../components/RhomeAISheet';
import { AIFloatingButton } from '../../components/AIFloatingButton';
import { HostPlanBadge } from '../../components/HostPlanBadge';
import { isFreePlan } from '../../utils/hostPricing';
import { getAgentPlanLimits, type AgentPlan } from '../../constants/planLimits';
import { resolveEffectiveAgentPlan } from '../../utils/planResolver';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAgentResponseAlerts } from '../../services/responseTrackingService';
import { getHostCompletionPercentage } from '../../utils/profileReminderUtils';
import { HostReviewsScreen } from '../shared/HostReviewsScreen';
import { getMonthlyUsageCount, getHostPiMonthlyLimit } from '../../services/piMatchingService';
import { getAvailableGroups } from '../../services/piAutoMatchService';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const GOLD = '#ffd700';
const PURPLE = '#a855f7';
const UPGRADE_BANNER_KEY = 'hostFreeBannerDismissedAt';

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function getAvatarGradient(name: string): [string, string] {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatBudget(range?: string): string {
  if (!range) return '';
  const match = range.match(/\d[\d,]*/);
  if (!match) return range;
  const num = parseInt(match[0].replace(',', ''), 10);
  if (num >= 1000) return `$${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k budget`;
  return `$${num} budget`;
}

export const HostDashboardScreen = () => {
  const { user, getHostPlan, canAddListing, canRespondToInquiry, useInquiryResponse } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const { refreshUnreadCount } = useNotificationContext();
  const hostPlan = getHostPlan();
  const isAgent = user?.hostType === 'agent';
  const isCompany = user?.hostType === 'company';
  const { badge: hostBadge } = useHostBadge(user?.id);
  const VALID_AGENT_PLANS = ['pay_per_use', 'agent_starter', 'agent_pro', 'agent_business', 'starter', 'pro', 'business'] as const;
  const rawResolvedPlan = isAgent ? resolveEffectiveAgentPlan(user) : '';
  const agentPlan = isAgent
    ? (VALID_AGENT_PLANS.includes(rawResolvedPlan as any) ? (rawResolvedPlan as AgentPlan) : 'pay_per_use')
    : null;
  const agentLimits = agentPlan ? getAgentPlanLimits(agentPlan) : null;
  const canUseAI = isAgent ? (agentLimits?.hasAIChat ?? false) : true;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<InterestCard[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [showAISheet, setShowAISheet] = useState(false);
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [completionBannerDismissed, setCompletionBannerDismissed] = useState(false);
  const hostCompletion = user ? getHostCompletionPercentage(user) : 100;
  const [agentStats, setAgentStats] = useState<{ agentId: string; agentName: string; activeListings: number; pendingBookings: number; confirmedBookings: number }[]>([]);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<'all' | 'active' | 'pending' | 'confirmed'>('all');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignListingId, setReassignListingId] = useState<string | null>(null);
  const [companyAgents, setCompanyAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [unassignedListings, setUnassignedListings] = useState<Property[]>([]);
  const [responseAlerts, setResponseAlerts] = useState<{ agentId: string; agentName: string; conversationId: string; renterName: string; status: string; hoursSinceMessage: number; listingTitle?: string; listingId?: string }[]>([]);
  const [agentDetailMap, setAgentDetailMap] = useState<Map<string, { conversations: AgentConversationSummary[]; bookings: AgentBookingSummary[]; loading: boolean }>>(new Map());
  const [reassignConvId, setReassignConvId] = useState<string | null>(null);
  const [reassignConvListingId, setReassignConvListingId] = useState<string | null>(null);
  const [piMatchCount, setPiMatchCount] = useState(0);
  const [piUsedThisMonth, setPiUsedThisMonth] = useState(0);
  const [piMonthlyLimit, setPiMonthlyLimit] = useState(0);
  const [piTopPicks, setPiTopPicks] = useState<{ name: string; reason: string; strength: string }[]>([]);
  const [piAvailableGroups, setPiAvailableGroups] = useState(0);
  const [agentPlacementCount, setAgentPlacementCount] = useState(0);
  const [agentCancellationRate, setAgentCancellationRate] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [hostReviewCount, setHostReviewCount] = useState(0);
  const [hostAvgRating, setHostAvgRating] = useState(0);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [showHostReviews, setShowHostReviews] = useState(false);

  const DASH_COLLAPSE_H = 50;
  const dashScrollY = useSharedValue(0);
  const dashScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { dashScrollY.value = event.contentOffset.y; },
  });
  const dashCollapsibleStyle = useAnimatedStyle(() => {
    const translateY = interpolate(dashScrollY.value, [0, DASH_COLLAPSE_H], [0, -DASH_COLLAPSE_H], Extrapolation.CLAMP);
    const opacity = interpolate(dashScrollY.value, [0, DASH_COLLAPSE_H * 0.6], [1, 0], Extrapolation.CLAMP);
    const maxH = interpolate(dashScrollY.value, [0, DASH_COLLAPSE_H], [DASH_COLLAPSE_H, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity, maxHeight: maxH, overflow: 'hidden' as const };
  });
  const AnimatedScrollView = Animated.ScrollView;

  const agentPlanBase = agentPlan ? agentPlan.replace(/^(agent_|company_)/, '') : '';
  const isOnFreeTier = isAgent
    ? (!agentPlan || agentPlan === 'pay_per_use' || agentPlan === 'free' || agentPlanBase === 'pay_per_use' || agentPlanBase === 'free')
    : isCompany
    ? (!hostSub?.plan || isFreePlan(hostSub.plan.replace(/^company_/, '') as any))
    : (hostSub && isFreePlan(hostSub.plan));
  useEffect(() => {
    if (isOnFreeTier) {
      AsyncStorage.getItem(UPGRADE_BANNER_KEY).then(val => {
        if (!val) { setShowUpgradeBanner(true); return; }
        const dismissed = parseInt(val, 10);
        if (Date.now() - dismissed > 24 * 60 * 60 * 1000) setShowUpgradeBanner(true);
        else setShowUpgradeBanner(false);
      });
    } else {
      setShowUpgradeBanner(false);
    }
  }, [hostSub, isOnFreeTier]);

  const dismissUpgradeBanner = () => {
    AsyncStorage.setItem(UPGRADE_BANNER_KEY, Date.now().toString());
    setShowUpgradeBanner(false);
  };

  const loadData = useCallback(async () => {
    if (!user) return;

    let freshListings: Property[] = [];
    try {
      const supaListings = await getMyListings(user.id);
      if (supaListings && supaListings.length > 0) {
        freshListings = supaListings.map((l: any) => mapListingToProperty(l, user.name));
        setListings(freshListings);
      } else {
        const allProperties = await StorageService.getProperties();
        const myListings = allProperties.filter(p => p.hostId === user.id || p.hostProfileId === user.id);
        freshListings = myListings.length > 0 ? myListings : allProperties;
        setListings(freshListings);
      }
    } catch {
      const allProperties = await StorageService.getProperties();
      const myListings = allProperties.filter(p => p.hostId === user.id || p.hostProfileId === user.id);
      freshListings = myListings.length > 0 ? myListings : allProperties;
      setListings(freshListings);
    }

    let unreadMessages = 0;
    try {
      const { data: userGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      const groupIds = userGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('group_id', groupIds)
          .eq('read', false)
          .neq('sender_id', user.id);
        unreadMessages = unreadCount || 0;
      }
    } catch {
      const allConvos = await StorageService.getConversations();
      unreadMessages = allConvos.reduce((sum, c) => sum + (c.unread || 0), 0);
    }
    setMessageCount(unreadMessages);

    try {
      const supaCards = await getReceivedInterestCards(user.id);
      const mapped: InterestCard[] = (supaCards || []).map((c: any) => ({
        id: c.id,
        renterId: c.sender?.id || c.sender_id,
        renterName: c.sender?.full_name || 'Unknown',
        renterPhoto: c.sender?.avatar_url,
        hostId: c.recipient_id || user.id,
        propertyId: c.listing_id || '',
        propertyTitle: c.listing_title || '',
        status: c.status || 'pending',
        isSuperInterest: c.action === 'super_interest',
        compatibilityScore: c.compatibility_score || 0,
        budgetRange: c.budget_range || '',
        moveInDate: c.move_in_date || '',
        lifestyleTags: c.lifestyle_tags || [],
        personalNote: c.personal_note || '',
        createdAt: c.created_at || new Date().toISOString(),
        respondedAt: c.responded_at,
        groupId: c.group_id || null,
      }));
      setInquiries(mapped);
    } catch {
      const interestCards = await StorageService.getInterestCardsForHost(user.id);
      setInquiries(interestCards);
    }

    const sub = await StorageService.getHostSubscription(user.id);
    setHostSub(sub);

    try {
      const rawPlan = sub?.plan || 'free';
      const hostType = user.hostType;
      const limit = getHostPiMonthlyLimit(rawPlan, hostType);
      setPiMonthlyLimit(limit);
      const used = await getMonthlyUsageCount(user.id);
      setPiUsedThisMonth(used);

      const { data: piRecs } = await supabase
        .from('pi_host_recommendations')
        .select('recommendations')
        .eq('host_id', user.id);
      let total = 0;
      const topPicks: { name: string; reason: string; strength: string }[] = [];
      (piRecs || []).forEach((r: any) => {
        const recs = r.recommendations;
        if (Array.isArray(recs)) {
          total += recs.length;
          recs.forEach((rec: any) => {
            if (topPicks.length < 3 && rec.target_name) {
              topPicks.push({
                name: rec.target_name || 'Renter',
                reason: rec.reason || 'Strong match for your listing',
                strength: rec.match_strength || 'good',
              });
            }
          });
        }
      });
      setPiMatchCount(total);
      setPiTopPicks(topPicks);

      try {
        const available = await getAvailableGroups(user.city ? { city: user.city } : undefined);
        setPiAvailableGroups(available.length);
      } catch (e) { console.warn('[HostDashboard] Failed to load available groups:', e); }
    } catch (e) { console.warn('[HostDashboard] Failed to load Pi matchmaker data:', e); }

    if (user.hostType === 'company') {
      try {
        const stats = await getAgentStats(user.id);
        setAgentStats(stats);
        const agents = await getCompanyAgents(user.id);
        setCompanyAgents(agents);
        const listingsToCheck = freshListings.length > 0 ? freshListings : listings;
        const noAgent = listingsToCheck.filter(l => !l.assigned_agent_id && l.available);
        setUnassignedListings(noAgent);
        const alerts = await getAgentResponseAlerts(user.id);
        setResponseAlerts(alerts);
      } catch (e) { console.warn('[HostDashboard] Failed to load company data:', e); }
    }

    if (isSupabaseConfigured && user.id) {
      try {
        const { count: placementCount } = await supabase
          .from('agent_placements')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .eq('status', 'completed');
        setAgentPlacementCount(placementCount || 0);

        const { count: cancelledCount } = await supabase
          .from('agent_placements')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .eq('status', 'cancelled');
        const totalPlacements = (placementCount || 0) + (cancelledCount || 0);
        setAgentCancellationRate(totalPlacements > 0 ? (cancelledCount || 0) / totalPlacements : 0);
      } catch (e) { console.warn('[HostDashboard] Failed to load placement data:', e); setAgentPlacementCount(0); setAgentCancellationRate(0); }

      try {
        const listingIds = freshListings.length > 0
          ? freshListings.map(l => l.id)
          : listings.map(l => l.id);
        if (listingIds.length > 0) {
          const { data: reviewData } = await supabase
            .from('reviews')
            .select('rating')
            .in('listing_id', listingIds);
          if (reviewData && reviewData.length > 0) {
            setReviewCount(reviewData.length);
            const avg = reviewData.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviewData.length;
            setAvgRating(Math.round(avg * 10) / 10);
          } else {
            setReviewCount(0);
            setAvgRating(0);
          }
        } else {
          setReviewCount(0);
          setAvgRating(0);
        }
      } catch { setReviewCount(0); setAvgRating(0); }

      try {
        const { data: hostReviewData } = await supabase
          .from('host_reviews')
          .select('rating')
          .eq('host_id', user.id);
        if (hostReviewData && hostReviewData.length > 0) {
          setHostReviewCount(hostReviewData.length);
          const avg = hostReviewData.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / hostReviewData.length;
          setHostAvgRating(Math.round(avg * 10) / 10);
        } else {
          setHostReviewCount(0);
          setHostAvgRating(0);
        }
      } catch { setHostReviewCount(0); setHostAvgRating(0); }

      if (user.hostType === 'company') {
        try {
          const { count: tmCount } = await supabase
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .eq('company_user_id', user.id)
            .eq('status', 'active');
          setTeamMemberCount(tmCount || 0);
        } catch { setTeamMemberCount(0); }
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const activeCount = listings.filter(p => p.available && !p.rentedDate).length;
  const rentedCount = listings.filter(p => !!p.rentedDate).length;
  const pendingInquiries = inquiries.filter(c => c.status === 'pending').length;
  const recentPendingInquiries = useMemo(() =>
    [...inquiries]
      .filter(c => c.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3),
    [inquiries]
  );

  const navigateToTab = (tabName: string) => {
    if (tabName === 'Listings') {
      if (isAgent || isCompany) {
        navigation.navigate('MyListings');
      } else {
        const parent = navigation.getParent();
        if (parent) parent.navigate('Listings');
      }
      return;
    }
    if (tabName === 'Team' && isCompany) {
      const parent = navigation.getParent();
      if (parent) parent.navigate('Profile', { screen: 'TeamManagement' });
      return;
    }
    const parent = navigation.getParent();
    if (parent) parent.navigate(tabName);
  };

  const handleAcceptInterest = async (card: InterestCard) => {
    if (!user) return;

    const responseCheck = await canRespondToInquiry();
    if (!responseCheck.allowed) {
      await showAlert({
        title: 'Response Limit Reached',
        message: responseCheck.reason || `You've used all ${responseCheck.limit} inquiry responses for this period. Upgrade your plan for more.`,
        variant: 'warning',
      });
      return;
    }
    await useInquiryResponse();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = new Date();

    let supabaseMatchId: string | undefined;
    try {
      const result = await acceptInterestCard(user!.id, card.id, card.renterId);
      supabaseMatchId = result?.match?.id;
    } catch {
      await StorageService.updateInterestCard(card.id, {
        status: 'accepted',
        respondedAt: now.toISOString(),
      });
    }

    if (card.groupId) {
      try {
        await updateGroup(card.groupId, { address_revealed: true, inquiry_status: 'accepted' });
      } catch (e) { console.warn('[HostDashboard] Failed to update group on accept:', e); }
    }

    const conversationId = `conv-interest-${card.id}`;
    const acceptedMessage: Message = {
      id: `msg-accept-${Date.now()}`,
      senderId: 'system',
      text: `${user.name} accepted your interest! You can now message each other.`,
      content: `${user.name} accepted your interest! You can now message each other.`,
      timestamp: now,
      read: false,
    };
    const existingConvs = await StorageService.getConversations();
    const existingConv = existingConvs.find(c => c.id === conversationId);
    const priorMessages = existingConv?.messages || [];
    const conversation: Conversation = {
      id: conversationId,
      participant: { id: card.renterId, name: card.renterName, photo: card.renterPhoto, online: false },
      lastMessage: acceptedMessage.text || '',
      timestamp: now,
      unread: 0,
      messages: [...priorMessages, acceptedMessage],
      isInquiryThread: true,
      isSuperInterest: card.isSuperInterest || false,
      inquiryStatus: 'accepted',
      inquiryId: card.id,
      listingTitle: card.propertyTitle,
      hostId: user.id,
      hostName: user.name,
      propertyId: card.propertyId,
      matchId: supabaseMatchId,
    };
    await StorageService.addOrUpdateConversation(conversation);

    await StorageService.addNotification({
      id: `notif-${Date.now()}-accept-renter`,
      userId: card.renterId,
      type: 'interest_accepted',
      title: "It's a Match!",
      body: `${user.name} accepted your interest for ${card.propertyTitle}. You can now message each other`,
      isRead: false,
      createdAt: now,
      data: { interestCardId: card.id, conversationId, propertyId: card.propertyId, fromUserId: user.id, fromUserName: user.name, fromUserPhoto: user.profilePicture },
    });

    try {
      await supabase.from('notifications').insert({
        user_id: card.renterId,
        type: 'match',
        title: "It's a Match!",
        message: `${user.name} accepted your interest for ${card.propertyTitle}`,
        metadata: {
          match_id: supabaseMatchId,
          listing_id: card.propertyId,
          host_id: user.id,
          conversation_id: conversationId,
        },
        is_read: false,
        created_at: now.toISOString(),
      });
    } catch (e) {
      console.warn('Failed to insert Supabase match notification:', e);
    }

    await refreshUnreadCount();
    setInquiries(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'accepted' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const handlePassInterest = async (card: InterestCard) => {
    if (!user) return;

    const responseCheck = await canRespondToInquiry();
    if (!responseCheck.allowed) {
      await showAlert({
        title: 'Response Limit Reached',
        message: responseCheck.reason || `You've used all ${responseCheck.limit} inquiry responses for this period. Upgrade your plan for more.`,
        variant: 'warning',
      });
      return;
    }
    await useInquiryResponse();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();

    try {
      await rejectInterestCard(user!.id, card.id);
    } catch {
      await StorageService.updateInterestCard(card.id, {
        status: 'passed',
        respondedAt: now.toISOString(),
      });
    }

    if (card.groupId) {
      try {
        await updateGroup(card.groupId, { inquiry_status: 'declined' });
      } catch (e) { console.warn('[HostDashboard] Failed to update group on decline:', e); }
      await StorageService.updateConversation(`inquiry-conv-${card.groupId}`, {
        inquiryStatus: 'declined',
        lastMessage: 'The host passed on this inquiry.',
      });
    }

    await StorageService.updateConversation(`conv-interest-${card.id}`, {
      inquiryStatus: 'declined',
      lastMessage: 'The host passed on this inquiry.',
    });

    await StorageService.addNotification({
      id: `notif-${Date.now()}-pass`,
      userId: card.renterId,
      type: 'interest_passed',
      title: 'Interest Update',
      body: `They passed this time for ${card.propertyTitle}`,
      isRead: false,
      createdAt: now,
      data: { interestCardId: card.id, propertyId: card.propertyId, fromUserId: user.id, fromUserName: user.name },
    });

    await refreshUnreadCount();
    setInquiries(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'passed' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const getStatArrowText = (label: string, value: number): { text: string; color: string } => {
    if (label === 'Active') {
      return value > 0
        ? { text: `${value} listed`, color: '#3b82f6' }
        : { text: 'No active listings', color: 'rgba(255,255,255,0.2)' };
    }
    if (label === 'Inquiries') {
      return value > 0
        ? { text: 'Awaiting review', color: GOLD }
        : { text: 'All reviewed', color: 'rgba(255,255,255,0.2)' };
    }
    if (label === 'Rented') {
      return value > 0
        ? { text: `${value} rented`, color: GREEN }
        : { text: 'No rentals yet', color: 'rgba(255,255,255,0.2)' };
    }
    if (label === 'Placements') {
      return value > 0
        ? { text: `${value} placed`, color: GREEN }
        : { text: 'No placements yet', color: 'rgba(255,255,255,0.2)' };
    }
    if (label === 'Messages') {
      return value > 0
        ? { text: `${value} unread`, color: ACCENT }
        : { text: 'All caught up', color: 'rgba(255,255,255,0.2)' };
    }
    return { text: '', color: 'rgba(255,255,255,0.2)' };
  };

  const statCards = [
    { icon: 'home' as const, value: activeCount, label: 'Active', color: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)', iconBorder: 'rgba(59,130,246,0.2)', onPress: () => navigateToTab('Listings') },
    { icon: 'heart' as const, value: pendingInquiries, label: 'Inquiries', color: ACCENT, iconBg: 'rgba(255,107,91,0.15)', iconBorder: 'rgba(255,107,91,0.2)', onPress: () => navigation.navigate('Inquiries', { filter: 'pending' }) },
    isAgent
      ? { icon: 'award' as const, value: agentPlacementCount, label: 'Placements', color: GREEN, iconBg: 'rgba(46,204,113,0.12)', iconBorder: 'rgba(46,204,113,0.18)', onPress: () => navigateToTab('Listings') }
      : { icon: 'check' as const, value: rentedCount, label: 'Rented', color: GREEN, iconBg: 'rgba(46,204,113,0.12)', iconBorder: 'rgba(46,204,113,0.18)', onPress: () => navigateToTab('Listings') },
    { icon: 'message-square' as const, value: messageCount, label: 'Messages', color: 'rgba(255,255,255,0.5)', iconBg: 'rgba(255,255,255,0.06)', iconBorder: 'rgba(255,255,255,0.08)', onPress: () => navigateToTab('Messages') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.topNav, { paddingTop: insets.top + 14 }]}>
        <RhomeLogo variant="icon-only" size="sm" onPress={() => {
          const parent = navigation.getParent?.();
          if (parent) parent.navigate('Dashboard', { screen: 'DashboardMain' });
        }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.greetingTitle}>{isAgent ? 'Agent Dashboard' : isCompany ? 'Company Dashboard' : 'Host Dashboard'}</Text>
        </View>
        <View style={styles.navActions}>
          {canUseAI ? <AIFloatingButton onPress={() => setShowAISheet(true)} position="inline" /> : null}
          <Pressable style={styles.iconBtn} onPress={() => {
            navigation.navigate('Notifications');
          }}>
            <Feather name="bell" size={16} color="rgba(255,255,255,0.6)" />
            {pendingInquiries > 0 ? <View style={styles.notifDot} /> : null}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigateToTab('Profile')}>
            <Feather name="settings" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      </View>
      <Animated.View style={dashCollapsibleStyle}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.greetingSub}>{getGreeting()}{user?.city ? ` \u00B7 ${user.city}` : ''}</Text>
            {hostSub ? <HostPlanBadge plan={hostSub.plan} isVerifiedAgent={hostSub.isVerifiedAgent} /> : null}
          </View>
          {hostSub ? (
            <Text style={styles.planSummaryText}>
              {isAgent
                ? (agentPlanBase === 'pay_per_use' || !agentPlanBase || agentPlanBase === 'free' ? 'Pay Per Use \u00B7 Upgrade for more features' :
                   agentPlanBase === 'starter' ? 'Agent Starter \u00B7 $49/mo' :
                   agentPlanBase === 'pro' ? 'Agent Pro \u00B7 $99/mo' :
                   `Agent Business \u00B7 $149/mo \u00B7 ${activeCount} listings active`)
                : isCompany
                  ? (() => { const cp = (hostSub.plan || '').replace(/^company_/, ''); return (
                     cp === 'starter' ? 'Company Starter \u00B7 $199/mo' :
                     cp === 'pro' ? 'Company Pro \u00B7 $399/mo' :
                     cp === 'enterprise' ? `Company Enterprise \u00B7 Custom \u00B7 ${activeCount} listings active` :
                     'Company Free \u00B7 Upgrade to unlock all features'); })()
                  : (() => { const bp = (hostSub.plan || '').replace(/^(agent_|company_)/, ''); return (
                     isFreePlan(hostSub.plan) ? 'Free Plan \u00B7 Upgrade to unlock all features' :
                     bp === 'starter' ? 'Host Starter \u00B7 $19.99/mo' :
                     bp === 'pro' ? 'Host Pro \u00B7 $49.99/mo' :
                     `Host Business \u00B7 $99/mo \u00B7 ${activeCount} listings active`); })()}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <AnimatedScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={dashScrollHandler}
        scrollEventThrottle={16}
      >
        {showUpgradeBanner ? (
          <View style={styles.upgradeBanner}>
            <View style={styles.upgradeBannerContent}>
              <Feather name="zap" size={16} color={PURPLE} />
              <Text style={styles.upgradeBannerText}>
                {isAgent
                  ? "You're on Pay Per Use. Upgrade for AI tools, more placements, and priority support."
                  : isCompany
                    ? "You're on the Free plan. Upgrade to manage your portfolio and team more effectively."
                    : "You're on the Free plan. Upgrade to browse renter groups and fill your room faster."}
              </Text>
            </View>
            <View style={styles.upgradeBannerActions}>
              <Pressable style={styles.remindBtn} onPress={dismissUpgradeBanner}>
                <Text style={styles.remindBtnText}>Remind me later</Text>
              </Pressable>
              <Pressable
                style={styles.seePlansBtn}
                onPress={() => navigation.navigate('HostSubscription')}
              >
                <Text style={styles.seePlansBtnText}>See Plans</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {hostCompletion < 100 && !completionBannerDismissed ? (
          <Pressable
            style={styles.completionBanner}
            onPress={() => navigation.dispatch(CommonActions.navigate({ name: 'ProfileCompletion' }))}
          >
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.completionBannerText}>
                Complete your profile — {hostCompletion}% done
              </Text>
              <View style={styles.completionBarTrack}>
                <LinearGradient
                  colors={[ACCENT, '#e83a2a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.completionBarFill, { width: `${Math.max(hostCompletion, 5)}%` }]}
                />
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.4)" />
            <Pressable
              style={styles.completionDismissBtn}
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation();
                setCompletionBannerDismissed(true);
              }}
            >
              <Feather name="x" size={14} color="rgba(255,255,255,0.35)" />
            </Pressable>
          </Pressable>
        ) : null}

        <View style={styles.roleRow}>
          <View style={styles.hostBadge}>
            <Feather name={isAgent ? 'briefcase' : isCompany ? 'grid' : 'home'} size={12} color={ACCENT} />
            <Text style={styles.hostBadgeText}>{isAgent ? 'Agent Mode' : isCompany ? 'Company Mode' : 'Host Mode'}</Text>
          </View>
          <Pressable style={styles.periodPill} onPress={() => navigation.navigate('Analytics')}>
            <Feather name="clock" size={11} color="rgba(255,255,255,0.4)" />
            <Text style={styles.periodPillText}>Last 30 days</Text>
            <Feather name="chevron-down" size={10} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        <Pressable style={styles.heroStat} onPress={() => navigateToTab('Listings')}>
          <View style={styles.heroGlow} />
          <View>
            <Text style={styles.heroLabel}>TOTAL LISTINGS</Text>
            <Text style={styles.heroValue}>{listings.length}</Text>
            <Text style={styles.heroSub}>Across all cities</Text>
          </View>
          <View style={styles.heroRight}>
            <LinearGradient
              colors={[ACCENT, '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIcon}
            >
              <Feather name="home" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{activeCount} Active</Text>
            </View>
            <Text style={styles.heroMyListings}>My Listings</Text>
          </View>
        </Pressable>

        <View style={styles.statGrid}>
          {statCards.map((stat, idx) => {
            const arrow = getStatArrowText(stat.label, stat.value);
            return (
              <Pressable key={stat.label} style={styles.statCard} onPress={stat.onPress}>
                <View style={[styles.statIcon, { backgroundColor: stat.iconBg, borderColor: stat.iconBorder, borderWidth: 1 }]}>
                  <Feather name={stat.icon} size={17} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { color: stat.color === 'rgba(255,255,255,0.5)' ? '#fff' : stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <View style={styles.statArrow}>
                  {arrow.color === GREEN ? (
                    <Feather name="arrow-up" size={10} color={arrow.color} />
                  ) : null}
                  <Text style={[styles.statArrowText, { color: arrow.color }]}>{arrow.text}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT INQUIRIES</Text>
          <Pressable onPress={() => navigation.navigate('Inquiries')}>
            <Text style={styles.sectionLink}>View all</Text>
          </Pressable>
        </View>

        {recentPendingInquiries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="inbox" size={28} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>No pending inquiries</Text>
          </View>
        ) : (
          recentPendingInquiries.map((card) => {
            const grad = getAvatarGradient(card.renterName);
            const initial = card.renterName.charAt(0).toUpperCase();
            return (
              <Pressable
                key={card.id}
                style={[styles.inquiryCard, card.isSuperInterest ? styles.superBorder : null]}
                onPress={() => navigation.navigate('Inquiries')}
              >
                <LinearGradient colors={grad} style={styles.inqAvatar}>
                  <Text style={styles.inqAvatarText}>{initial}</Text>
                </LinearGradient>
                <View style={styles.inqBody}>
                  <View style={styles.inqTop}>
                    <Text style={styles.inqName} numberOfLines={1}>{card.renterName}</Text>
                    <Text style={styles.inqTime}>{formatTimeAgo(card.createdAt)}</Text>
                  </View>
                  <Text style={styles.inqListing} numberOfLines={1}>{card.propertyTitle}</Text>
                  <View style={styles.inqTags}>
                    {card.compatibilityScore ? (
                      <View style={styles.inqTagMatch}>
                        <Text style={styles.inqTagMatchText}>{card.compatibilityScore}% match</Text>
                      </View>
                    ) : null}
                    {card.budgetRange ? (
                      <View style={styles.inqTagBudget}>
                        <Text style={styles.inqTagBudgetText}>{formatBudget(card.budgetRange)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.inqActions}>
                  <Pressable
                    style={styles.inqBtnAccept}
                    onPress={(e) => { e.stopPropagation(); handleAcceptInterest(card); }}
                  >
                    <Text style={styles.inqBtnAcceptText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inqBtnPass}
                    onPress={(e) => { e.stopPropagation(); handlePassInterest(card); }}
                  >
                    <Text style={styles.inqBtnPassText}>Pass</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}

        {activeCount > 0 ? (
          <Pressable
            style={styles.groupMatchCard}
            onPress={() => {
              const activeListing = listings.find(l => l.available && !l.rentedDate);
              if (activeListing) navigation.navigate('GroupMatches', { listingId: activeListing.id });
            }}
          >
            <View style={styles.groupMatchLeft}>
              <View style={styles.groupMatchIconWrap}>
                <Feather name="users" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupMatchTitle}>Group Matches</Text>
                <Text style={styles.groupMatchSub}>See renter groups that match your listings</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#888" />
          </Pressable>
        ) : null}

        {activeCount > 0 ? (
          <Pressable
            style={styles.groupMatchCard}
            onPress={() => {
              const activeListing = listings.find(l => l.available && !l.rentedDate);
              navigation.navigate('BrowseRenters', activeListing ? { listingId: activeListing.id } : undefined);
            }}
          >
            <View style={styles.groupMatchLeft}>
              <View style={[styles.groupMatchIconWrap, { backgroundColor: PURPLE + '20' }]}>
                <Feather name="cpu" size={18} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupMatchTitle}>{'\u03C0'} Pi Matchmaker</Text>
                <Text style={styles.groupMatchSub}>
                  {piMatchCount > 0
                    ? `Pi found ${piMatchCount} match${piMatchCount !== 1 ? 'es' : ''} for your listings`
                    : 'Pi finds renters that fit your listings'}
                </Text>
                {piMonthlyLimit !== 0 ? (
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>
                    {piMonthlyLimit === -1 ? 'Unlimited' : `${Math.max(0, piMonthlyLimit - piUsedThisMonth)}/${piMonthlyLimit}`} Pi calls remaining this month
                  </Text>
                ) : null}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#888" />
          </Pressable>
        ) : null}

        {(isAgent || isCompany) && !hostBadge ? (
          <BadgeProgressCard
            badgeType={isAgent ? 'top_agent' : 'top_company'}
            earned={false}
            checks={isAgent ? [
              { label: 'License verified', met: user?.licenseVerificationStatus === 'verified' },
              { label: 'Paid plan', met: !!agentPlanBase && agentPlanBase !== 'pay_per_use' && agentPlanBase !== 'free' },
              { label: '2+ months on Rhome', met: !!user?.createdAt && (Date.now() - new Date(user.createdAt).getTime()) > 60 * 24 * 60 * 60 * 1000 },
              { label: '85%+ response rate', met: inquiries.length < 3 || (typeof user?.responseRate === 'number' && user.responseRate >= 85) },
              { label: '3+ successful placements', met: agentPlacementCount >= 3 },
              { label: '5+ reviews', met: reviewCount >= 5 },
              { label: '4.7+ average rating', met: avgRating >= 4.7 },
              { label: '<15% cancellation rate', met: agentPlacementCount >= 3 && agentCancellationRate <= 0.15 },
            ] : [
              { label: 'Company name set', met: !!user?.companyName },
              { label: 'Pro or Enterprise plan', met: !!hostSub && !isFreePlan(hostSub.plan) && (() => { const bp = (hostSub.plan || '').replace(/^(agent_|company_)/, ''); return bp === 'pro' || bp === 'enterprise'; })() },
              { label: '3+ months on Rhome', met: !!user?.createdAt && (Date.now() - new Date(user.createdAt).getTime()) > 90 * 24 * 60 * 60 * 1000 },
              { label: '90%+ response rate', met: inquiries.length < 5 || (typeof user?.responseRate === 'number' && user.responseRate >= 90) },
              { label: '5+ active listings', met: listings.filter(l => l.available).length >= 5 },
              { label: '10+ reviews', met: reviewCount >= 10 },
              { label: '4.6+ average rating', met: avgRating >= 4.6 },
              { label: 'Under 45 day avg vacancy', met: listings.length >= 3 && listings.filter(l => !!l.rentedDate).length >= Math.ceil(listings.length * 0.6) },
              { label: '60%+ fill rate', met: listings.length >= 3 && listings.filter(l => !!l.rentedDate).length / Math.max(1, listings.length) >= 0.6 },
              { label: '2+ team members', met: teamMemberCount >= 2 },
            ]}
          />
        ) : null}

        {hostBadge ? (
          <View style={{ marginBottom: 12 }}>
            <HostBadge badge={hostBadge} size="large" />
          </View>
        ) : null}

        <Pressable
          style={styles.groupMatchCard}
          onPress={() => setShowHostReviews(true)}
        >
          <View style={styles.groupMatchLeft}>
            <View style={[styles.groupMatchIconWrap, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
              <Feather name="message-circle" size={18} color="#a78bfa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupMatchTitle}>My Reviews</Text>
              <Text style={styles.groupMatchSub}>
                {hostReviewCount > 0
                  ? `${hostAvgRating} avg rating · ${hostReviewCount} review${hostReviewCount !== 1 ? 's' : ''} from renters`
                  : 'No reviews yet — renters can review you after connecting'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {hostReviewCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Feather name="star" size={13} color="#a78bfa" />
                <Text style={{ color: '#a78bfa', fontSize: 13, fontWeight: '700' }}>{hostAvgRating}</Text>
              </View>
            ) : null}
            <Feather name="chevron-right" size={18} color="#888" />
          </View>
        </Pressable>

        {(user?.hostType === 'agent' || user?.hostType === 'company') ? (
          <Pressable
            style={styles.groupMatchCard}
            onPress={() => navigation.navigate('PiMatchedGroups')}
          >
            <View style={styles.groupMatchLeft}>
              <View style={[styles.groupMatchIconWrap, { backgroundColor: PURPLE + '20' }]}>
                <Feather name="users" size={18} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupMatchTitle}>{'\u03C0'} Pi Matched Groups</Text>
                <Text style={styles.groupMatchSub}>
                  {piAvailableGroups > 0
                    ? `${piAvailableGroups} confirmed group${piAvailableGroups !== 1 ? 's' : ''} ready to claim`
                    : 'Browse pre-vetted roommate groups matched by Pi'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {piAvailableGroups > 0 ? (
                <View style={{ backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{piAvailableGroups}</Text>
                </View>
              ) : null}
              <Feather name="chevron-right" size={18} color="#888" />
            </View>
          </Pressable>
        ) : null}

        {(user?.hostType === 'company' || user?.hostType === 'agent') ? (
          <Pressable
            style={styles.groupMatchCard}
            onPress={() => navigation.navigate('CompanyFillPipeline')}
          >
            <View style={styles.groupMatchLeft}>
              <View style={[styles.groupMatchIconWrap, { backgroundColor: PURPLE + '20' }]}>
                <Feather name="zap" size={18} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupMatchTitle}>AI Fill Pipeline</Text>
                <Text style={styles.groupMatchSub}>Match renter groups to your units automatically</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#888" />
          </Pressable>
        ) : null}

        {(user?.hostType === 'company' || user?.hostType === 'agent') && activeCount > 0 ? (
          <View style={[styles.groupMatchCard, { flexDirection: 'column' as const }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={[styles.groupMatchIconWrap, { backgroundColor: PURPLE + '20' }]}>
                <Feather name="cpu" size={18} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupMatchTitle}>{'\u03C0'} Pi Matchmaker Summary</Text>
                <Text style={styles.groupMatchSub}>AI-powered renter matching across all {user?.hostType === 'company' ? 'company' : 'your'} listings</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: piTopPicks.length > 0 ? 12 : 0 }}>
              <View style={{ flex: 1, backgroundColor: PURPLE + '10', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: PURPLE, fontSize: 20, fontWeight: '700' }}>{piMatchCount}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Total Matches</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: PURPLE + '10', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: PURPLE, fontSize: 20, fontWeight: '700' }}>{piUsedThisMonth}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Calls Used</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: PURPLE + '10', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: PURPLE, fontSize: 20, fontWeight: '700' }}>
                  {piMonthlyLimit === -1 ? '\u221E' : Math.max(0, piMonthlyLimit - piUsedThisMonth)}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Remaining</Text>
              </View>
            </View>
            {piTopPicks.length > 0 ? (
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 8 }}>TOP PICKS</Text>
                {piTopPicks.map((pick, idx) => {
                  const strengthColor = pick.strength === 'strong' ? GREEN : pick.strength === 'good' ? GOLD : '#3b82f6';
                  return (
                    <View key={pick.id || `${pick.name}-${pick.reason}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: strengthColor }} />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', flex: 0 }} numberOfLines={1}>{pick.name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, flex: 1 }} numberOfLines={1}>{pick.reason}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: strengthColor + '20' }}>
                        <Text style={{ color: strengthColor, fontSize: 9, fontWeight: '700', textTransform: 'capitalize' }}>{pick.strength}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {user?.hostType === 'company' && unassignedListings.length > 0 ? (
          <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="alert-triangle" size={16} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600', flex: 1 }}>
                {unassignedListings.length} listing{unassignedListings.length > 1 ? 's have' : ' has'} no assigned agent and won't receive messages until one is assigned.
              </Text>
            </View>
          </View>
        ) : null}

        {user?.hostType === 'company' && responseAlerts.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: 6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="bell" size={14} color="#ff6b5b" />
                <Text style={styles.sectionTitle}>RESPONSE ALERTS</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{responseAlerts.length} alert{responseAlerts.length !== 1 ? 's' : ''}</Text>
            </View>
            {responseAlerts.map((alertItem, idx) => {
              const isCritical = alertItem.status === 'critical';
              const isDelayed = alertItem.status === 'delayed';
              const statusColor = isCritical ? '#ef4444' : isDelayed ? '#F59E0B' : '#f97316';
              const statusLabel = isCritical ? 'Critical' : isDelayed ? 'Delayed' : 'Unresponsive';
              return (
                <Pressable
                  key={alertItem.conversationId || `alert-${alertItem.agentId}`}
                  style={{
                    backgroundColor: isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    borderWidth: 1,
                    borderColor: isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    borderRadius: 12, padding: 14, marginBottom: 8,
                  }}
                  onPress={() => {
                    try {
                      navigation.navigate('Chat' as any, {
                        conversationId: alertItem.conversationId,
                        readOnly: true,
                      });
                    } catch (e) { console.warn('[HostDashboard] Alert nav failed:', e); }
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{alertItem.agentName}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                        {alertItem.renterName} waiting {Math.floor(alertItem.hoursSinceMessage)}h
                        {alertItem.listingTitle ? ` · ${alertItem.listingTitle}` : ''}
                      </Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                      backgroundColor: statusColor + '20',
                    }}>
                      <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
                  </View>
                  {isCritical && alertItem.listingId ? (
                    <Pressable
                      style={{
                        marginTop: 10, padding: 10, borderRadius: 8, alignItems: 'center',
                        backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                      }}
                      onPress={() => {
                        setReassignListingId(alertItem.listingId!);
                        setShowReassignModal(true);
                      }}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Reassign Conversation</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {user?.hostType === 'company' && agentStats.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: 6 }]}>
              <Text style={styles.sectionTitle}>TEAM ACTIVITY</Text>
              <Pressable onPress={() => navigateToTab('Team')}>
                <Text style={styles.sectionLink}>Manage</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}>
                {(['all', 'active', 'pending', 'confirmed'] as const).map(f => (
                  <Pressable
                    key={f}
                    onPress={() => setTeamFilter(f)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: teamFilter === f ? ACCENT : 'rgba(255,255,255,0.06)',
                      borderWidth: 1, borderColor: teamFilter === f ? ACCENT : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: teamFilter === f ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      {f === 'all' ? 'All Agents' : f === 'active' ? 'Active Listings' : f === 'pending' ? 'Pending Requests' : 'Confirmed Bookings'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {agentStats.filter(a => {
              if (teamFilter === 'active') return a.activeListings > 0;
              if (teamFilter === 'pending') return a.pendingBookings > 0;
              if (teamFilter === 'confirmed') return a.confirmedBookings > 0;
              return true;
            }).map(agent => {
              const expanded = expandedAgentId === agent.agentId;
              const detail = agentDetailMap.get(agent.agentId);
              const handleExpand = async () => {
                if (expanded) {
                  setExpandedAgentId(null);
                  return;
                }
                setExpandedAgentId(agent.agentId);
                if (!agentDetailMap.has(agent.agentId)) {
                  setAgentDetailMap(prev => {
                    const next = new Map(prev);
                    next.set(agent.agentId, { conversations: [], bookings: [], loading: true });
                    return next;
                  });
                  try {
                    const data = await getAgentDetailData(agent.agentId, user?.id);
                    setAgentDetailMap(prev => {
                      const next = new Map(prev);
                      next.set(agent.agentId, { ...data, loading: false });
                      return next;
                    });
                  } catch (e) {
                    console.warn('[Dashboard] Failed to load agent detail:', e);
                    setAgentDetailMap(prev => {
                      const next = new Map(prev);
                      next.set(agent.agentId, { conversations: [], bookings: [], loading: false });
                      return next;
                    });
                  }
                }
              };
              const statusColor = (s: string) => {
                if (s === 'accepted' || s === 'confirmed') return '#22c55e';
                if (s === 'declined' || s === 'cancelled_by_host' || s === 'cancelled_by_renter') return '#ef4444';
                return '#f59e0b';
              };
              const statusLabel = (s: string) => {
                if (s === 'cancelled_by_host') return 'Cancelled';
                if (s === 'cancelled_by_renter') return 'Cancelled';
                return s.charAt(0).toUpperCase() + s.slice(1);
              };
              const timeAgo = formatTimeAgo;
              return (
                <Pressable
                  key={agent.agentId}
                  style={{
                    backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: expanded ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                  }}
                  onPress={handleExpand}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Feather name="user" size={16} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{agent.agentName}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                        {agent.activeListings} active listing{agent.activeListings !== 1 ? 's' : ''} · {agent.pendingBookings} pending · {agent.confirmedBookings} confirmed
                      </Text>
                    </View>
                    <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.3)" />
                  </View>
                  {expanded ? (
                    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                      {detail?.loading ? (
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', paddingVertical: 12 }}>Loading...</Text>
                      ) : (
                        <>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>RECENT CONVERSATIONS</Text>
                          {(detail?.conversations || []).length === 0 ? (
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontStyle: 'italic', marginBottom: 12 }}>No conversations yet</Text>
                          ) : (
                            (detail?.conversations || []).map(conv => (
                              <View key={conv.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <Feather name="message-circle" size={12} color="rgba(255,255,255,0.3)" />
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{conv.renterName}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ backgroundColor: `${statusColor(conv.status)}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                      <Text style={{ color: statusColor(conv.status), fontSize: 10, fontWeight: '600' }}>{statusLabel(conv.status)}</Text>
                                    </View>
                                    <Pressable
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        setReassignConvId(conv.id);
                                        setReassignConvListingId(conv.listingId);
                                        setShowReassignModal(true);
                                      }}
                                      style={{ backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                    >
                                      <Text style={{ color: '#3b82f6', fontSize: 10, fontWeight: '600' }}>Reassign</Text>
                                    </Pressable>
                                  </View>
                                </View>
                                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                                  {conv.listingTitle} · {timeAgo(conv.lastActivity)}
                                </Text>
                              </View>
                            ))
                          )}

                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 10, marginBottom: 8 }}>BOOKINGS</Text>
                          {(detail?.bookings || []).length === 0 ? (
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontStyle: 'italic' }}>No bookings yet</Text>
                          ) : (
                            (detail?.bookings || []).map(bk => (
                              <View key={bk.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <Feather name="calendar" size={12} color="rgba(255,255,255,0.3)" />
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{bk.renterName}</Text>
                                  </View>
                                  <View style={{ backgroundColor: `${statusColor(bk.status)}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ color: statusColor(bk.status), fontSize: 10, fontWeight: '600' }}>{statusLabel(bk.status)}</Text>
                                  </View>
                                </View>
                                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                                  {bk.listingTitle} · ${bk.monthlyRent}/mo · Move-in {bk.moveInDate ? new Date(bk.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                                </Text>
                              </View>
                            ))
                          )}

                          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontStyle: 'italic', marginTop: 8, textAlign: 'center' }}>
                            Read-only view. The agent handles all interactions directly.
                          </Text>
                        </>
                      )}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        <View style={[styles.sectionHeader, { marginTop: 6 }]}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.quickActions}>
          <Pressable style={styles.qaPrimary} onPress={() => {
            const result = canAddListing(activeCount);
            if (!result.allowed) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              confirm({
                title: 'Listing Limit Reached',
                message: result.reason || 'You have reached your listing limit.',
                confirmText: 'Upgrade Plan',
                variant: 'warning',
              }).then(confirmed => {
                if (confirmed) navigation.navigate('HostSubscription');
              });
              return;
            }
            navigation.navigate('CreateEditListing');
          }}>
            <LinearGradient
              colors={[ACCENT, '#e83a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.qaPrimaryInner}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.qaPrimaryText}>Add Listing</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.qaSecondary} onPress={() => navigateToTab('Listings')}>
            <Feather name="grid" size={15} color="rgba(255,255,255,0.6)" />
            <Text style={styles.qaSecondaryText}>My Listings</Text>
          </Pressable>
          <Pressable style={styles.qaSecondary} onPress={() => navigation.navigate('Analytics')}>
            <Feather name="bar-chart-2" size={15} color="rgba(255,255,255,0.6)" />
            <Text style={styles.qaSecondaryText}>Analytics</Text>
            {(() => {
              const planBase = isAgent ? agentPlanBase : hostPlan.replace(/^(agent_|company_)/, '');
              const needsPro = !planBase || planBase === 'pay_per_use' || planBase === 'free' || planBase === 'none' || planBase === 'starter';
              return needsPro ? <View style={styles.proBadge}><Text style={styles.proBadgeText}>Pro</Text></View> : null;
            })()}
          </Pressable>
          <Pressable style={styles.qaSecondary} onPress={() => navigation.navigate('HostSubscription')}>
            <Feather name="star" size={15} color={GOLD} />
            <Text style={styles.qaSecondaryText}>Plans</Text>
          </Pressable>
          {(() => {
            const planBase = isAgent ? agentPlanBase : hostPlan.replace(/^(agent_|company_)/, '');
            return planBase === 'business' || planBase === 'enterprise';
          })() ? (
            <Pressable style={styles.qaSecondary} onPress={() => {
              Linking.openURL(`mailto:support@rhomeapp.io?subject=${encodeURIComponent('Support Request — ' + (user?.name || 'Business Account'))}`).catch(() => {
                showAlert({
                  title: 'Dedicated Support',
                  message: 'Email: support@rhomeapp.io\nResponse time: Within 2 hours\n\nOur dedicated team is here to help you with any questions or issues.',
                  variant: 'info',
                });
              });
            }}>
              <Feather name="headphones" size={15} color="#667eea" />
              <Text style={styles.qaSecondaryText}>Support</Text>
            </Pressable>
          ) : null}
        </View>
      </AnimatedScrollView>
      {canUseAI ? <RhomeAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="host_dashboard"
        contextData={{
          host: {
            totalListings: listings.length,
            activeListings: listings.filter(l => l.available).length,
            totalInquiries: inquiries.length,
            pendingInquiries: inquiries.filter(c => c.status === 'pending').length,
            planName: hostPlan || 'starter',
          }
        }}
        onNavigate={(screen, params) => {
          try { navigation.navigate(screen as any, params); } catch (e) { console.warn('[HostDashboard] Navigation failed:', screen, e); }
        }}
      /> : null}
      <Modal visible={showReassignModal} transparent animationType="fade" onRequestClose={() => { setShowReassignModal(false); setReassignListingId(null); setReassignConvId(null); setReassignConvListingId(null); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
              {reassignConvId ? 'Reassign Conversation' : 'Reassign Agent'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
              {reassignConvId
                ? 'Select a new agent for this conversation. The listing will also be reassigned.'
                : 'Select a new agent for this listing'}
            </Text>
            {companyAgents.map(agent => (
              <Pressable
                key={agent.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 12, borderRadius: 10, marginBottom: 6,
                  backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}
                onPress={async () => {
                  if (reassignConvId) {
                    const ok = await reassignConversation(reassignConvId, reassignConvListingId || '', agent.id, user?.id);
                    if (ok) {
                      showAlert({ title: 'Reassigned', message: `Conversation reassigned to ${agent.full_name}. They will handle all future interactions.`, variant: 'success' });
                      setAgentDetailMap(new Map());
                      loadData();
                    } else {
                      showAlert({ title: 'Error', message: 'Failed to reassign conversation. Please try again.', variant: 'warning' });
                    }
                  } else if (reassignListingId) {
                    const ok = await reassignListingAgent(reassignListingId, agent.id, user?.id);
                    if (ok) {
                      showAlert({ title: 'Reassigned', message: `Listing reassigned to ${agent.full_name}. Future messages will go to them.`, variant: 'success' });
                      loadData();
                    }
                  }
                  setShowReassignModal(false);
                  setReassignListingId(null);
                  setReassignConvId(null);
                  setReassignConvListingId(null);
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="user" size={14} color="#3b82f6" />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, flex: 1 }}>{agent.full_name}</Text>
                <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ))}
            <Pressable
              onPress={() => { setShowReassignModal(false); setReassignListingId(null); setReassignConvId(null); setReassignConvListingId(null); }}
              style={{ marginTop: 8, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {showHostReviews ? (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHostReviews(false)}>
          <HostReviewsScreen
            hostId={user?.id || ''}
            hostName={user?.name || 'Host'}
            onClose={() => setShowHostReviews(false)}
          />
        </Modal>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  greetingSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginBottom: 2 },
  greetingTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  planSummaryText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  navActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  aiGradientBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 7,
    width: 7, height: 7, backgroundColor: ACCENT,
    borderRadius: 4, borderWidth: 1.5, borderColor: BG,
  },
  scroll: { flex: 1, paddingHorizontal: 16 },

  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.25)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  hostBadgeText: { fontSize: 12, fontWeight: '700', color: '#ff8070' },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  periodPillText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },

  heroStat: {
    backgroundColor: '#1e1212',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 20,
    padding: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -30, right: -30,
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,107,91,0.08)',
  },
  heroLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4,
  },
  heroValue: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    letterSpacing: -1, lineHeight: 40, marginBottom: 4,
  },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  heroRight: { alignItems: 'flex-end', gap: 8 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  activeBadge: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN },
  heroMyListings: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'center' },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 15,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    letterSpacing: -0.8, lineHeight: 30, marginBottom: 3,
  },
  statLabel: {
    fontSize: 11.5, fontWeight: '500', color: 'rgba(255,255,255,0.35)',
  },
  statArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  statArrowText: { fontSize: 10, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionLink: { fontSize: 12, fontWeight: '600', color: ACCENT },

  emptyCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 8 },

  inquiryCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  superBorder: {
    borderColor: 'rgba(255,215,0,0.35)',
    borderWidth: 1.5,
  },
  inqAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  inqAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  inqBody: { flex: 1, minWidth: 0 },
  inqTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  inqName: { fontSize: 13.5, fontWeight: '700', color: '#fff', flex: 1 },
  inqTime: { fontSize: 10.5, color: 'rgba(255,255,255,0.25)', marginLeft: 6 },
  inqListing: {
    fontSize: 11.5, color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  },
  inqTags: { flexDirection: 'row', gap: 6 },
  inqTagMatch: {
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  inqTagMatchText: { fontSize: 10, fontWeight: '600', color: '#ff8070' },
  inqTagBudget: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  inqTagBudgetText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  inqActions: { gap: 6 },
  inqBtnAccept: {
    height: 30,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inqBtnAcceptText: { fontSize: 11, fontWeight: '700', color: GREEN },
  inqBtnPass: {
    height: 30,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inqBtnPassText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },

  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  qaPrimary: { flex: 1 },
  qaPrimaryInner: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  qaPrimaryText: { fontSize: 12.5, fontWeight: '700', color: '#fff', includeFontPadding: false },
  qaSecondary: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  qaSecondaryText: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.6)', includeFontPadding: false },
  proBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,107,91,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  proBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: ACCENT,
  },
  upgradeBanner: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  upgradeBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  upgradeBannerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
    lineHeight: 19,
  },
  upgradeBannerActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  remindBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  remindBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  seePlansBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.2)',
  },
  seePlansBtnText: { fontSize: 12, fontWeight: '700', color: '#a855f7' },
  groupMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
  },
  groupMatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  groupMatchIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupMatchTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  groupMatchSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.15)',
    borderRadius: 14,
    gap: 12,
  },
  completionBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completionBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden' as const,
  },
  completionBarFill: {
    height: '100%' as any,
    borderRadius: 2,
  },
  completionDismissBtn: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
