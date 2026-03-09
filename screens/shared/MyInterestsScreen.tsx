import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, Text, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { InterestCard } from '../../types/models';

export const MyInterestsScreen = () => {
  const { user, canSendInterest } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [interests, setInterests] = useState<InterestCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInterests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
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
    }
    const cards = await StorageService.getInterestCardsForRenter(user.id);
    cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setInterests(cards);
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

  const handleMessage = async (card: InterestCard) => {
    const conversationId = `conv-interest-${card.id}`;
    const conversations = await StorageService.getConversations();
    const existing = conversations.find(c => c.id === conversationId);
    if (existing) {
      (navigation as any).navigate('Messages', { screen: 'Chat', params: { conversationId: existing.id } });
    }
  };

  const handleResend = async (card: InterestCard) => {
    if (!user) return;
    const limitCheck = await canSendInterest();
    if (!limitCheck.canSend) {
      Alert.alert('Daily Limit Reached', limitCheck.reason || 'Upgrade to send more interest cards.', [{ text: 'OK' }]);
      return;
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
    await loadInterests();
  };

  const renderItem = ({ item }: { item: InterestCard }) => {
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

  const pendingCount = interests.filter(i => i.status === 'pending').length;

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

      <FlatList
        data={interests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
});
