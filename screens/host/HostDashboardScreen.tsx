import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Feather } from '../../components/VectorIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { Property, InterestCard, Message, Conversation, HostSubscriptionData } from '../../types/models';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { getMyListings, mapListingToProperty } from '../../services/listingService';
import { getReceivedInterestCards } from '../../services/discoverService';
import { RoomdrAISheet } from '../../components/RoomdrAISheet';
import { HostPlanBadge } from '../../components/HostPlanBadge';
import { canAddListingCheck, isFreePlan } from '../../utils/hostPricing';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { user, getHostPlan } = useAuth();
  const { refreshUnreadCount } = useNotificationContext();
  const hostPlan = getHostPlan();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<InterestCard[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [showAISheet, setShowAISheet] = useState(false);
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

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

  useEffect(() => {
    if (hostSub && isFreePlan(hostSub.plan)) {
      AsyncStorage.getItem(UPGRADE_BANNER_KEY).then(val => {
        if (!val) { setShowUpgradeBanner(true); return; }
        const dismissed = parseInt(val, 10);
        if (Date.now() - dismissed > 24 * 60 * 60 * 1000) setShowUpgradeBanner(true);
        else setShowUpgradeBanner(false);
      });
    } else {
      setShowUpgradeBanner(false);
    }
  }, [hostSub]);

  const dismissUpgradeBanner = () => {
    AsyncStorage.setItem(UPGRADE_BANNER_KEY, Date.now().toString());
    setShowUpgradeBanner(false);
  };

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const supaListings = await getMyListings();
      if (supaListings && supaListings.length > 0) {
        const mapped: Property[] = supaListings.map((l: any) => mapListingToProperty(l, user.name));
        setListings(mapped);
      } else {
        const allProperties = await StorageService.getProperties();
        const myListings = allProperties.filter(p => p.hostId === user.id);
        if (myListings.length > 0) {
          setListings(myListings);
        } else {
          setListings([]);
        }
      }
    } catch {
      const allProperties = await StorageService.getProperties();
      const myListings = allProperties.filter(p => p.hostId === user.id);
      setListings(myListings);
    }

    const allConvos = await StorageService.getConversations();
    const unreadMessages = allConvos.reduce((sum, c) => sum + (c.unread || 0), 0);
    setMessageCount(unreadMessages);

    try {
      const supaCards = await getReceivedInterestCards();
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
      }));
      setInquiries(mapped);
    } catch {
      const interestCards = await StorageService.getInterestCardsForHost(user.id);
      setInquiries(interestCards);
    }

    const sub = await StorageService.getHostSubscription(user.id);
    setHostSub(sub);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const activeCount = listings.filter(p => p.available && !p.rentedDate).length;
  const rentedCount = listings.filter(p => !!p.rentedDate).length;
  const pendingInquiries = inquiries.filter(c => c.status === 'pending').length;
  const recentPendingInquiries = [...inquiries]
    .filter(c => c.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const navigateToTab = (tabName: string) => {
    const parent = navigation.getParent();
    if (parent) parent.navigate(tabName);
  };

  const handleAcceptInterest = async (card: InterestCard) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await StorageService.updateInterestCard(card.id, {
      status: 'accepted',
      respondedAt: new Date().toISOString(),
    });

    const conversationId = `conv-interest-${card.id}`;
    const now = new Date();
    const initialMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'system',
      text: 'Interest accepted! Start chatting.',
      content: 'Interest accepted! Start chatting.',
      timestamp: now,
      read: false,
    };
    const conversation: Conversation = {
      id: conversationId,
      participant: {
        id: card.renterId,
        name: card.renterName,
        photo: card.renterPhoto,
        online: false,
      },
      lastMessage: initialMessage.text || '',
      timestamp: now,
      unread: 0,
      messages: [initialMessage],
    };
    await StorageService.addOrUpdateConversation(conversation);

    await StorageService.addNotification({
      id: `notif-${Date.now()}-accept-renter`,
      userId: card.renterId,
      type: 'interest_accepted',
      title: "It's a Match!",
      body: `${user.name} accepted your interest for ${card.propertyTitle}`,
      isRead: false,
      createdAt: now,
      data: { interestCardId: card.id, conversationId, propertyId: card.propertyId, fromUserId: user.id, fromUserName: user.name, fromUserPhoto: user.profilePicture },
    });

    await StorageService.addNotification({
      id: `notif-${Date.now()}-accept-host`,
      userId: user.id,
      type: 'interest_accepted',
      title: 'Interest Accepted',
      body: `You accepted ${card.renterName}'s interest for ${card.propertyTitle}`,
      isRead: false,
      createdAt: now,
      data: { interestCardId: card.id, conversationId, propertyId: card.propertyId, fromUserId: card.renterId, fromUserName: card.renterName, fromUserPhoto: card.renterPhoto },
    });

    await refreshUnreadCount();
    setInquiries(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'accepted' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const handlePassInterest = async (card: InterestCard) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await StorageService.updateInterestCard(card.id, {
      status: 'passed',
      respondedAt: new Date().toISOString(),
    });

    const now = new Date();
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
    { icon: 'check' as const, value: rentedCount, label: 'Rented', color: GREEN, iconBg: 'rgba(46,204,113,0.12)', iconBorder: 'rgba(46,204,113,0.18)', onPress: () => navigateToTab('Listings') },
    { icon: 'message-square' as const, value: messageCount, label: 'Messages', color: 'rgba(255,255,255,0.5)', iconBg: 'rgba(255,255,255,0.06)', iconBorder: 'rgba(255,255,255,0.08)', onPress: () => navigateToTab('Messages') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.topNav, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingTitle}>Host Dashboard</Text>
        </View>
        <View style={styles.navActions}>
          <Pressable style={styles.iconBtn} onPress={() => setShowAISheet(true)}>
            <LinearGradient
              colors={['#ff6b5b', '#e83a2a']}
              style={styles.aiGradientBtn}
            >
              <Feather name="cpu" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
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
            <Text style={styles.greetingSub}>{getGreeting()}</Text>
            {hostSub ? <HostPlanBadge plan={hostSub.plan} isVerifiedAgent={hostSub.isVerifiedAgent} /> : null}
          </View>
          {hostSub ? (
            <Text style={styles.planSummaryText}>
              {isFreePlan(hostSub.plan) ? 'Free Plan \u00B7 Upgrade to unlock all features' :
               hostSub.plan === 'starter' ? 'Host Starter \u00B7 $19.99/mo' :
               hostSub.plan === 'pro' ? 'Host Pro \u00B7 $49.99/mo' :
               `Host Business \u00B7 $99/mo \u00B7 ${activeCount} listings active`}
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
                You're on the Free plan. Upgrade to browse renter groups and fill your room faster.
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

        <View style={styles.roleRow}>
          <View style={styles.hostBadge}>
            <Feather name="home" size={12} color={ACCENT} />
            <Text style={styles.hostBadgeText}>Host Mode</Text>
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
          </View>
        </Pressable>

        <View style={styles.statGrid}>
          {statCards.map((stat, idx) => {
            const arrow = getStatArrowText(stat.label, stat.value);
            return (
              <Pressable key={idx} style={styles.statCard} onPress={stat.onPress}>
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

        <View style={[styles.sectionHeader, { marginTop: 6 }]}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.quickActions}>
          <Pressable style={styles.qaPrimary} onPress={() => {
            if (hostSub) {
              const result = canAddListingCheck({ ...hostSub, activeListingCount: activeCount });
              if (!result.allowed) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Listing Limit Reached', result.message, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Upgrade Plan', onPress: () => navigation.navigate('HostSubscription') },
                ]);
                return;
              }
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
            {hostPlan === 'starter' ? (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Pro</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.qaSecondary} onPress={() => navigation.navigate('HostSubscription')}>
            <Feather name="star" size={15} color={GOLD} />
            <Text style={styles.qaSecondaryText}>Plans</Text>
          </Pressable>
          {user?.hostPlan === 'business' ? (
            <Pressable style={styles.qaSecondary} onPress={() => {
              Alert.alert(
                'Dedicated Support',
                'As a Business host, you have access to priority support.\n\nEmail: support@roomdr.com\nResponse time: Within 2 hours\n\nOur dedicated team is here to help you with any questions or issues.',
                [{ text: 'OK' }]
              );
            }}>
              <Feather name="headphones" size={15} color="#667eea" />
              <Text style={styles.qaSecondaryText}>Support</Text>
            </Pressable>
          ) : null}
        </View>
      </AnimatedScrollView>
      <RoomdrAISheet
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
          try { navigation.navigate(screen as any, params); } catch {}
        }}
      />
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
});
