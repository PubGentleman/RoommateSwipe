import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { InterestCard, Conversation, Message } from '../../types/models';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { getReceivedInterestCards, acceptInterestCard, rejectInterestCard } from '../../services/discoverService';
import { updateGroup } from '../../services/groupService';
import { RhomeAISheet } from '../../components/RhomeAISheet';
import { getAgentPlanLimits, type AgentPlan } from '../../constants/planLimits';

type FilterStatus = 'all' | 'pending' | 'accepted' | 'passed';

export const HostInquiriesScreen = () => {
  const { theme } = useTheme();
  const { user, canRespondToInquiry, useInquiryResponse, getHostPlan } = useAuth();
  const { alert: showAlert } = useConfirm();
  const { refreshUnreadCount } = useNotificationContext();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isAgent = user?.hostType === 'agent';
  const agentPlan = isAgent ? (user?.agentPlan as AgentPlan) || 'pay_per_use' : null;
  const agentLimits = agentPlan ? getAgentPlanLimits(agentPlan) : null;
  const canUseAI = isAgent ? (agentLimits?.hasAIChat ?? false) : true;
  const [interestCards, setInterestCards] = useState<InterestCard[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>(route.params?.filter || 'all');
  const [showAISheet, setShowAISheet] = useState(false);

  React.useEffect(() => {
    if (route.params?.filter) {
      setActiveFilter(route.params.filter);
    }
  }, [route.params?.filter]);

  const loadInterestCards = useCallback(async () => {
    if (!user) return;
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
        groupId: c.group_id || undefined,
      }));
      const sorted = [...mapped].sort((a, b) => {
        if (a.isSuperInterest && !b.isSuperInterest) return -1;
        if (!a.isSuperInterest && b.isSuperInterest) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setInterestCards(sorted);
    } catch {
      await StorageService.expireOldInterestCards();
      const cards = await StorageService.getInterestCardsForHost(user.id);
      const sorted = [...cards].sort((a, b) => {
        if (a.isSuperInterest && !b.isSuperInterest) return -1;
        if (!a.isSuperInterest && b.isSuperInterest) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setInterestCards(sorted);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadInterestCards();
    }, [loadInterestCards])
  );

  const allCount = interestCards.length;
  const pendingCount = interestCards.filter(c => c.status === 'pending').length;
  const acceptedCount = interestCards.filter(c => c.status === 'accepted').length;
  const passedCount = interestCards.filter(c => c.status === 'passed').length;

  const filtered = interestCards
    .filter(card => {
      if (activeFilter === 'all') return true;
      return card.status === activeFilter;
    })
    .sort((a, b) => {
      if (a.isSuperInterest && !b.isSuperInterest) return -1;
      if (!a.isSuperInterest && b.isSuperInterest) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleAcceptInterest = async (card: InterestCard) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const responseCheck = await canRespondToInquiry();
    if (!responseCheck.allowed) {
      await showAlert({
        title: 'Response Limit Reached',
        message: responseCheck.reason || `You've used all ${responseCheck.limit} inquiry responses this month. Upgrade to Pro for unlimited responses.`,
        variant: 'warning',
      });
      return;
    }
    await useInquiryResponse();

    const now = new Date();

    let supabaseMatchId: string | undefined;
    try {
      const result = await acceptInterestCard(card.id, card.renterId);
      supabaseMatchId = result?.match?.id;
    } catch {
      await StorageService.updateInterestCard(card.id, {
        status: 'accepted',
        respondedAt: now.toISOString(),
      });
    }

    if (card.groupId) {
      try {
        await updateGroup(card.groupId, {
          address_revealed: true,
          inquiry_status: 'accepted',
        });
      } catch {
        console.warn('[HostInquiriesScreen] Failed to update group address reveal');
      }
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
      participant: {
        id: card.renterId,
        name: card.renterName,
        photo: card.renterPhoto,
        online: false,
      },
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

    if (card.groupId) {
      const inquiryConvId = `inquiry-conv-${card.groupId}`;
      await StorageService.updateConversation(inquiryConvId, {
        inquiryStatus: 'accepted',
        lastMessage: 'Inquiry accepted! The host wants to connect.',
      });
    }

    if (card.isSuperInterest) {
      const superConvId = `super-conv-${card.id}`;
      await StorageService.updateConversation(superConvId, {
        inquiryStatus: 'accepted',
        lastMessage: 'Host accepted your Super Interest! Say hello.',
      });
    }

    await StorageService.addNotification({
      id: `notif-${Date.now()}-accept-renter`,
      userId: card.renterId,
      type: 'interest_accepted',
      title: "It's a Match!",
      body: `${user.name} accepted your interest for ${card.propertyTitle}. You can now message each other`,
      isRead: false,
      createdAt: now,
      data: {
        interestCardId: card.id,
        conversationId,
        propertyId: card.propertyId,
        fromUserId: user.id,
        fromUserName: user.name,
        fromUserPhoto: user.profilePicture,
      },
    });

    await StorageService.addNotification({
      id: `notif-${Date.now()}-accept-host`,
      userId: user.id,
      type: 'interest_accepted',
      title: 'Interest Accepted',
      body: `You accepted ${card.renterName}'s interest for ${card.propertyTitle}`,
      isRead: false,
      createdAt: now,
      data: {
        interestCardId: card.id,
        conversationId,
        propertyId: card.propertyId,
        fromUserId: card.renterId,
        fromUserName: card.renterName,
        fromUserPhoto: card.renterPhoto,
      },
    });

    await refreshUnreadCount();
    setInterestCards(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'accepted' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const handlePassInterest = async (card: InterestCard) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const responseCheck = await canRespondToInquiry();
    if (!responseCheck.allowed) {
      await showAlert({
        title: 'Response Limit Reached',
        message: responseCheck.reason || `You've used all ${responseCheck.limit} inquiry responses this month. Upgrade to Pro for unlimited responses.`,
        variant: 'warning',
      });
      return;
    }
    await useInquiryResponse();

    const now = new Date();

    try {
      await rejectInterestCard(card.id);
    } catch {
      await StorageService.updateInterestCard(card.id, {
        status: 'passed',
        respondedAt: now.toISOString(),
      });
    }

    if (card.groupId) {
      try {
        await updateGroup(card.groupId, {
          inquiry_status: 'declined',
        });
      } catch {
        console.warn('[HostInquiriesScreen] Failed to update group decline status');
      }
      const inquiryConvId = `inquiry-conv-${card.groupId}`;
      await StorageService.updateConversation(inquiryConvId, {
        inquiryStatus: 'declined',
        lastMessage: 'The host passed on this inquiry.',
      });
    }

    const mainConvId = `conv-interest-${card.id}`;
    await StorageService.updateConversation(mainConvId, {
      inquiryStatus: 'declined',
      lastMessage: 'The host passed on this inquiry.',
    });

    if (card.isSuperInterest) {
      const superConvId = `super-conv-${card.id}`;
      await StorageService.updateConversation(superConvId, {
        inquiryStatus: 'declined',
        lastMessage: 'This listing is no longer available.',
      });
    }

    await StorageService.addNotification({
      id: `notif-${Date.now()}-pass`,
      userId: card.renterId,
      type: 'interest_passed',
      title: 'Interest Update',
      body: `They passed this time for ${card.propertyTitle}`,
      isRead: false,
      createdAt: now,
      data: {
        interestCardId: card.id,
        propertyId: card.propertyId,
        fromUserId: user.id,
        fromUserName: user.name,
      },
    });

    await refreshUnreadCount();
    setInterestCards(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'passed' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const emptyConfig = {
    all: {
      icon: 'inbox' as const,
      title: 'No inquiries yet',
      subtitle: 'Renters who tap "I\'m Interested" on your listing will appear here.',
      ctaLabel: 'Browse Renter Groups',
      ctaAction: () => navigation.navigate('BrowseRenterGroups'),
    },
    pending: {
      icon: 'clock' as const,
      title: 'No pending inquiries',
      subtitle: 'New inquiries will land here for you to accept or pass.',
      ctaLabel: 'Browse Renter Groups',
      ctaAction: () => navigation.navigate('BrowseRenterGroups'),
    },
    accepted: {
      icon: 'check-circle' as const,
      title: 'No accepted inquiries',
      subtitle: 'Inquiries you accept move here so you can track active conversations.',
      ctaLabel: null as string | null,
      ctaAction: null as (() => void) | null,
    },
    passed: {
      icon: 'x-circle' as const,
      title: 'No passed inquiries',
      subtitle: 'Renters you pass on will be archived here.',
      ctaLabel: null as string | null,
      ctaAction: null as (() => void) | null,
    },
  };

  const renderInquiryCard = (card: InterestCard) => (
    <View
      key={card.id}
      style={[
        styles.inquiryCard,
        card.isSuperInterest ? { borderColor: 'rgba(255,215,0,0.35)' } : null,
      ]}
    >
      {card.isSuperInterest ? (
        <View style={styles.superBanner}>
          <Feather name="star" size={12} color="#FFD700" />
          <Text style={styles.superBannerText}>Super Interest</Text>
        </View>
      ) : null}

      <View style={styles.inquiryRow}>
        <View style={styles.inquiryAvatarWrap}>
          {card.renterPhoto ? (
            <Image source={{ uri: card.renterPhoto }} style={styles.inquiryAvatar} />
          ) : (
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.inquiryAvatar}>
              <Text style={styles.inquiryAvatarLetter}>{card.renterName[0]}</Text>
            </LinearGradient>
          )}
          <View style={[
            styles.matchBadge,
            { backgroundColor: card.compatibilityScore >= 70 ? '#2ecc71' : card.compatibilityScore >= 40 ? '#f39c12' : '#e74c3c' }
          ]}>
            <Text style={styles.matchBadgeText}>{card.compatibilityScore}%</Text>
          </View>
        </View>

        <View style={styles.inquiryInfo}>
          <Text style={styles.inquiryName} numberOfLines={1}>{card.renterName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="home" size={11} color="rgba(255,255,255,0.3)" />
            <Text style={styles.inquiryListing} numberOfLines={1}>{card.propertyTitle}</Text>
          </View>
          <Text style={styles.inquiryTime}>{formatTimeAgo(card.createdAt)}</Text>
        </View>

        <View style={styles.inquiryActions}>
          {card.status === 'pending' ? (
            <>
              <Pressable style={styles.actionPass} onPress={() => handlePassInterest(card)}>
                <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
              <Pressable style={styles.actionAccept} onPress={() => handleAcceptInterest(card)}>
                <Feather name="check" size={16} color="#fff" />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.actionMessage}
              onPress={() => {
                const convId = `conv-interest-${card.id}`;
                navigation.navigate('Chat', { conversationId: convId });
              }}
            >
              <Feather name="message-circle" size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  const empty = emptyConfig[activeFilter];

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Inquiries</Text>
          {canUseAI ? (
            <Pressable style={styles.aiBtn} onPress={() => setShowAISheet(true)}>
              <LinearGradient
                colors={['#ff6b5b', '#ff8c7a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.aiBtnInner}
              >
                <Feather name="cpu" size={13} color="#fff" />
                <Text style={styles.aiBtnText}>AI Sort</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{allCount}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Text style={[styles.statNum, { color: '#ff6b5b' }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#2ecc71' }]}>{acceptedCount}</Text>
            <Text style={styles.statLabel}>Accepted</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: 'rgba(255,255,255,0.35)' }]}>{passedCount}</Text>
            <Text style={styles.statLabel}>Passed</Text>
          </View>
        </View>

        <View style={styles.filterWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {(['all', 'pending', 'accepted', 'passed'] as const).map((tab) => {
              const label = tab.charAt(0).toUpperCase() + tab.slice(1);
              const count = tab === 'all' ? allCount : tab === 'pending' ? pendingCount : tab === 'accepted' ? acceptedCount : passedCount;
              const isActive = activeFilter === tab;
              return (
                <Pressable
                  key={tab}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setActiveFilter(tab)}
                >
                  <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                    {label}
                  </Text>
                  {count > 0 ? (
                    <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                      <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <LinearGradient
                colors={['rgba(255,107,91,0.15)', 'rgba(255,107,91,0.05)']}
                style={styles.emptyIconCircle}
              >
                <Feather name={empty.icon} size={32} color="rgba(255,107,91,0.6)" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>{empty.title}</Text>
            <Text style={styles.emptySubtitle}>{empty.subtitle}</Text>
            {empty.ctaLabel ? (
              <Pressable style={styles.emptyCta} onPress={empty.ctaAction ?? undefined}>
                <Text style={styles.emptyCtaText}>{empty.ctaLabel}</Text>
                <Feather name="arrow-right" size={14} color="#ff6b5b" />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            {filtered.map(card => renderInquiryCard(card))}
          </View>
        )}
      </View>
      {canUseAI ? <RhomeAISheet
        visible={showAISheet}
        onDismiss={() => setShowAISheet(false)}
        screenContext="host_inquiries"
        contextData={{
          host: {
            totalInquiries: interestCards.length,
            pendingInquiries: pendingCount,
            responseRate: interestCards.length > 0
              ? Math.round((interestCards.filter(c => c.status !== 'pending').length / interestCards.length) * 100)
              : 0,
            planName: getHostPlan() || 'starter',
          }
        }}
        onNavigate={(screen, params) => {
          try { navigation.navigate(screen as any, params); } catch {}
        }}
      /> : null}
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  aiBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  aiBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statCardAccent: {
    borderColor: 'rgba(255,107,91,0.2)',
    backgroundColor: 'rgba(255,107,91,0.07)',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterWrap: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterTabActive: {
    backgroundColor: '#ff6b5b',
    borderColor: 'transparent',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    marginBottom: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCta: {
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
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  inquiryCard: {
    flexDirection: 'column',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  superBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  superBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
  },
  inquiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inquiryAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  inquiryAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inquiryAvatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  matchBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#111',
  },
  matchBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  inquiryInfo: {
    flex: 1,
    gap: 3,
  },
  inquiryName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  inquiryListing: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
  inquiryTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 1,
  },
  inquiryActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionPass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAccept: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2ecc71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMessage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff6b5b',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
