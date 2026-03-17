import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, Text, Alert, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { InterestCard } from '../../types/models';
import { PaywallSheet } from '../../components/PaywallSheet';
import { useNotificationContext } from '../../contexts/NotificationContext';
import { getSentInterestCards, getReceivedInterestCards, sendLike } from '../../services/discoverService';

type TabType = 'sent' | 'received';

export const MyInterestsScreen = () => {
  const { user, canSendInterest } = useAuth();
  const { refreshUnreadCount } = useNotificationContext();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [interests, setInterests] = useState<InterestCard[]>([]);
  const [receivedInterests, setReceivedInterests] = useState<InterestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('sent');
  const [showPaywall, setShowPaywall] = useState(false);

  const userPlan = user?.subscription?.plan || 'basic';
  const canSeeWhoLikedYou = userPlan === 'plus' || userPlan === 'elite';

  const loadInterests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [supabaseSent, supabaseReceived] = await Promise.all([
        getSentInterestCards(),
        getReceivedInterestCards(),
      ]);

      if (supabaseSent.length > 0 || supabaseReceived.length > 0) {
        const mappedSent: InterestCard[] = supabaseSent.map((card: any) => ({
          id: card.id,
          propertyId: card.listing_id || '',
          propertyTitle: card.listing_title || 'Roommate Match',
          hostId: card.recipient_id,
          hostName: card.recipient?.full_name || '',
          renterId: card.sender_id,
          renterName: user.name,
          renterPhoto: user.profilePicture,
          status: card.status || 'pending',
          isSuperInterest: card.action === 'super_interest',
          compatibilityScore: card.compatibility_score || 0,
          budgetRange: card.budget_range || '',
          moveInDate: card.move_in_date || '',
          lifestyleTags: card.lifestyle_tags || [],
          personalNote: card.personal_note || '',
          createdAt: card.created_at,
          respondedAt: card.responded_at,
        }));

        const mappedReceived: InterestCard[] = supabaseReceived.map((card: any) => ({
          id: card.id,
          propertyId: card.listing_id || '',
          propertyTitle: card.listing_title || 'Roommate Match',
          hostId: card.recipient_id,
          hostName: user.name,
          renterId: card.sender_id,
          renterName: card.sender?.full_name || '',
          renterPhoto: card.sender?.avatar_url || '',
          status: card.status || 'pending',
          isSuperInterest: card.action === 'super_interest',
          compatibilityScore: card.compatibility_score || 0,
          budgetRange: card.budget_range || '',
          moveInDate: card.move_in_date || '',
          lifestyleTags: card.lifestyle_tags || [],
          personalNote: card.personal_note || '',
          createdAt: card.created_at,
          respondedAt: card.responded_at,
        }));

        mappedSent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setInterests(mappedSent);
        mappedReceived.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReceivedInterests(mappedReceived);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.log('[MyInterests] Supabase fetch failed, falling back to StorageService:', error);
    }

    const expired = await StorageService.expireOldInterestCards();
    if (expired.length > 0) {
      for (const card of expired) {
        const notifId = `notif-expired-${card.id}-${Date.now()}`;
        await StorageService.addNotification({
          id: notifId,
          userId: card.renterId,
          type: 'interest_expired',
          title: 'Interest Expired',
          body: `Your interest in ${card.propertyTitle} has expired`,
          isRead: false,
          createdAt: new Date(),
          data: { interestCardId: card.id, propertyId: card.propertyId },
        });
      }
      await refreshUnreadCount();
    }
    const cards = await StorageService.getInterestCardsForRenter(user.id);
    cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setInterests(cards);

    const received = await StorageService.getInterestCardsForHost(user.id);
    received.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setReceivedInterests(received);

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadInterests();
    }, [loadInterests])
  );

  const getStatusBadge = (status: InterestCard['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', bg: 'rgba(255,193,7,0.15)', color: '#FFC107', borderColor: 'rgba(255,193,7,0.3)' };
      case 'accepted':
        return { label: 'Accepted', bg: 'rgba(46,204,113,0.15)', color: '#2ecc71', borderColor: 'rgba(46,204,113,0.3)' };
      case 'passed':
        return { label: 'Passed', bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.1)' };
      case 'expired':
        return { label: 'Expired', bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.08)' };
    }
  };

  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const expiry = created + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const remaining = expiry - now;
    if (remaining <= 0) return 'Expiring soon';
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleMessage = async (card: InterestCard) => {
    const conversationId = `conv-interest-${card.id}`;
    const conversations = await StorageService.getConversations();
    const existing = conversations.find(c => c.id === conversationId);
    if (existing) {
      (navigation as any).navigate('Messages', { screen: 'MessagesList' });
      setTimeout(() => {
        (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: existing.id } });
      }, 50);
    }
  };

  const handleResend = async (card: InterestCard) => {
    if (!user) return;
    const limitCheck = await canSendInterest();
    if (!limitCheck.canSend) {
      Alert.alert('Daily Limit Reached', limitCheck.reason || 'Upgrade to send more interest cards.', [{ text: 'OK' }]);
      return;
    }
    try {
      await sendLike(card.hostId);
    } catch (error) {
      console.log('[MyInterests] Supabase resend failed, using StorageService:', error);
    }
    const newCard: InterestCard = {
      ...card,
      id: `interest-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: undefined,
    };
    await StorageService.addInterestCard(newCard);
    await StorageService.addNotification({
      id: `notif-interest-${Date.now()}`,
      userId: card.hostId,
      type: 'interest_received',
      title: 'New Interest',
      body: `${user.name} is interested in ${card.propertyTitle}`,
      isRead: false,
      createdAt: new Date(),
      data: { interestCardId: newCard.id, propertyId: card.propertyId, fromUserId: user.id, fromUserName: user.name },
    });
    await refreshUnreadCount();
    await loadInterests();
  };

  const renderSentItem = ({ item }: { item: InterestCard }) => {
    const badge = getStatusBadge(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.propertyTitle} numberOfLines={1}>{item.propertyTitle}</Text>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.borderColor }]}>
              <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>
          {item.isSuperInterest ? (
            <View style={styles.superBadge}>
              <Feather name="star" size={10} color="#FFD700" />
              <Text style={styles.superBadgeText}>Super</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Feather name="percent" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.detailText}>{item.compatibilityScore}% match</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.detailText}>{item.budgetRange}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.detailText}>{item.moveInDate}</Text>
          </View>
        </View>

        {item.personalNote ? (
          <Text style={styles.noteText} numberOfLines={2}>{item.personalNote}</Text>
        ) : null}

        {item.status === 'pending' ? (
          <View style={styles.countdownRow}>
            <Feather name="clock" size={12} color="#FFC107" />
            <Text style={styles.countdownText}>{getTimeRemaining(item.createdAt)}</Text>
          </View>
        ) : null}

        {item.status === 'accepted' ? (
          <Pressable style={styles.messageBtn} onPress={() => handleMessage(item)}>
            <Feather name="message-circle" size={14} color="#fff" />
            <Text style={styles.messageBtnText}>Message</Text>
          </Pressable>
        ) : null}

        {item.status === 'expired' ? (
          <Pressable style={styles.resendBtn} onPress={() => handleResend(item)}>
            <Feather name="refresh-cw" size={14} color="#ff6b5b" />
            <Text style={styles.resendBtnText}>Send Again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderReceivedItem = ({ item }: { item: InterestCard }) => {
    const badge = getStatusBadge(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.receivedCardHeader}>
          <View style={styles.senderInfo}>
            {item.renterPhoto ? (
              <Image source={{ uri: item.renterPhoto }} style={styles.senderPhoto} />
            ) : (
              <View style={styles.senderPhotoPlaceholder}>
                <Feather name="user" size={18} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <View style={styles.senderDetails}>
              <Text style={styles.senderName} numberOfLines={1}>{item.renterName}</Text>
              <Text style={styles.receivedDate}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.borderColor }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.receivedPropertyTitle} numberOfLines={1}>{item.propertyTitle}</Text>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Feather name="percent" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.detailText}>{item.compatibilityScore}% match</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.detailText}>{item.budgetRange}</Text>
          </View>
        </View>

        {item.isSuperInterest ? (
          <View style={[styles.superBadge, { marginTop: 8, alignSelf: 'flex-start' }]}>
            <Feather name="star" size={10} color="#FFD700" />
            <Text style={styles.superBadgeText}>Super Interest</Text>
          </View>
        ) : null}

        {item.personalNote ? (
          <Text style={styles.noteText} numberOfLines={2}>{item.personalNote}</Text>
        ) : null}
      </View>
    );
  };

  const renderLockedReceivedItem = ({ item, index }: { item: InterestCard; index: number }) => {
    return (
      <View style={styles.card}>
        <View style={styles.receivedCardHeader}>
          <View style={styles.senderInfo}>
            <View style={styles.blurredPhoto}>
              <Feather name="user" size={18} color="rgba(255,255,255,0.2)" />
            </View>
            <View style={styles.senderDetails}>
              <View style={styles.blurredTextLine} />
              <View style={[styles.blurredTextLine, { width: 60 }]} />
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <View style={[styles.blurredTextLine, { width: 40, height: 10, marginBottom: 0 }]} />
          </View>
        </View>
        <View style={[styles.blurredTextLine, { width: '70%', height: 14, marginTop: 8 }]} />
        <View style={[styles.cardDetails, { marginTop: 10 }]}>
          <View style={[styles.blurredTextLine, { width: 70, height: 12, marginBottom: 0 }]} />
          <View style={[styles.blurredTextLine, { width: 80, height: 12, marginBottom: 0 }]} />
        </View>
        {index === 0 ? (
          <View style={styles.lockOverlay}>
            <Feather name="lock" size={20} color="#ff6b5b" />
            <Text style={styles.lockText}>Upgrade to see who liked you</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const pendingCount = interests.filter(i => i.status === 'pending').length;
  const receivedCount = receivedInterests.length;

  const handleTabPress = (tab: TabType) => {
    if (tab === 'received' && !canSeeWhoLikedYou && receivedInterests.length > 0) {
      setActiveTab(tab);
      return;
    }
    setActiveTab(tab);
  };

  const handleUpgradePress = () => {
    setShowPaywall(true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>My Interests</Text>
        {pendingCount > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{pendingCount}</Text>
          </View>
        ) : <View style={{ width: 28 }} />}
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'sent' ? styles.tabActive : null]}
          onPress={() => handleTabPress('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' ? styles.tabTextActive : null]}>Sent</Text>
          {interests.length > 0 ? (
            <View style={[styles.tabCount, activeTab === 'sent' ? styles.tabCountActive : null]}>
              <Text style={[styles.tabCountText, activeTab === 'sent' ? styles.tabCountTextActive : null]}>{interests.length}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'received' ? styles.tabActive : null]}
          onPress={() => handleTabPress('received')}
        >
          <Feather name="heart" size={14} color={activeTab === 'received' ? '#ff6b5b' : 'rgba(255,255,255,0.4)'} style={{ marginRight: 4 }} />
          <Text style={[styles.tabText, activeTab === 'received' ? styles.tabTextActive : null]}>Who Liked You</Text>
          {receivedCount > 0 ? (
            <View style={[styles.tabCount, activeTab === 'received' ? styles.tabCountActive : null]}>
              <Text style={[styles.tabCountText, activeTab === 'received' ? styles.tabCountTextActive : null]}>{receivedCount}</Text>
            </View>
          ) : null}
          {!canSeeWhoLikedYou ? (
            <Feather name="lock" size={12} color="rgba(255,255,255,0.3)" style={{ marginLeft: 4 }} />
          ) : null}
        </Pressable>
      </View>

      {activeTab === 'sent' ? (
        <FlatList
          data={interests}
          keyExtractor={(item) => item.id}
          renderItem={renderSentItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="heart" size={32} color="rgba(255,255,255,0.15)" />
                </View>
                <Text style={styles.emptyTitle}>No interest cards sent yet</Text>
                <Text style={styles.emptySubtitle}>Browse properties and send interest cards to get started</Text>
              </View>
            )
          }
        />
      ) : (
        canSeeWhoLikedYou ? (
          <FlatList
            data={receivedInterests}
            keyExtractor={(item) => item.id}
            renderItem={renderReceivedItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loading ? null : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Feather name="heart" size={32} color="rgba(255,255,255,0.15)" />
                  </View>
                  <Text style={styles.emptyTitle}>No interest cards received yet</Text>
                  <Text style={styles.emptySubtitle}>When someone sends you an interest card, it will appear here</Text>
                </View>
              )
            }
          />
        ) : (
          <View style={[styles.listContent, { flex: 1 }]}>
            <FlatList
              data={receivedInterests.length > 0 ? receivedInterests.slice(0, 3) : [{ id: 'placeholder-1' }, { id: 'placeholder-2' }, { id: 'placeholder-3' }] as any[]}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => renderLockedReceivedItem({ item, index })}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
            <View style={styles.upgradePrompt}>
              <View style={styles.upgradeIconWrap}>
                <Feather name="eye" size={24} color="#ff6b5b" />
              </View>
              <Text style={styles.upgradeTitle}>See Who Liked You</Text>
              <Text style={styles.upgradeSubtitle}>
                {receivedInterests.length > 0
                  ? `${receivedInterests.length} ${receivedInterests.length === 1 ? 'person has' : 'people have'} sent you interest cards`
                  : 'Upgrade to Plus to see who sends you interest cards'}
              </Text>
              <Pressable style={styles.upgradeBtn} onPress={handleUpgradePress}>
                <Feather name="zap" size={16} color="#fff" />
                <Text style={styles.upgradeBtnText}>Upgrade to Plus</Text>
              </Pressable>
            </View>
          </View>
        )
      )}

      <PaywallSheet
        visible={showPaywall}
        featureName="Who Liked You"
        requiredPlan="plus"
        onUpgrade={() => {
          setShowPaywall(false);
          (navigation as any).navigate('Plans');
        }}
        onDismiss={() => setShowPaywall(false)}
        role="renter"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    minWidth: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,107,91,0.2)',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  tabCountTextActive: {
    color: '#ff6b5b',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 6,
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  superBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  superBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  noteText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255,193,7,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFC107',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#2ecc71',
    borderRadius: 10,
    paddingVertical: 10,
  },
  messageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(255,107,91,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 18,
  },
  receivedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  senderPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  senderPhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  senderDetails: {
    flex: 1,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  receivedDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  receivedPropertyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  blurredPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  blurredTextLine: {
    height: 12,
    width: 100,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,17,17,0.7)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  upgradePrompt: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  upgradeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,107,91,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff6b5b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
