import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { InterestCard, Conversation, Message } from '../../types/models';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

type FilterStatus = 'all' | 'pending' | 'accepted' | 'passed';

export const HostInquiriesScreen = () => {
  const { theme } = useTheme();
  const { user, canRespondToInquiry, useInquiryResponse, getHostPlan } = useAuth();
  const [interestCards, setInterestCards] = useState<InterestCard[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const loadInterestCards = useCallback(async () => {
    if (!user) return;
    await StorageService.expireOldInterestCards();
    const cards = await StorageService.getInterestCardsForHost(user.id);
    const sorted = [...cards].sort((a, b) => {
      if (a.isSuperInterest && !b.isSuperInterest) return -1;
      if (!a.isSuperInterest && b.isSuperInterest) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setInterestCards(sorted);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadInterestCards();
    }, [loadInterestCards])
  );

  const filtered = interestCards.filter(card => {
    if (filter === 'all') return true;
    return card.status === filter;
  });

  const handleAcceptInterest = async (card: InterestCard) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const responseCheck = await canRespondToInquiry();
    if (!responseCheck.allowed) {
      Alert.alert(
        'Response Limit Reached',
        responseCheck.reason || `You've used all ${responseCheck.limit} inquiry responses this month. Upgrade to Pro for unlimited responses.`,
        [{ text: 'OK' }]
      );
      return;
    }
    await useInquiryResponse();

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

    setInterestCards(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'accepted' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const handlePassInterest = async (card: InterestCard) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const responseCheck = await canRespondToInquiry();
    if (!responseCheck.allowed) {
      Alert.alert(
        'Response Limit Reached',
        responseCheck.reason || `You've used all ${responseCheck.limit} inquiry responses this month. Upgrade to Pro for unlimited responses.`,
        [{ text: 'OK' }]
      );
      return;
    }
    await useInquiryResponse();

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
      data: {
        interestCardId: card.id,
        propertyId: card.propertyId,
        fromUserId: user.id,
        fromUserName: user.name,
      },
    });

    setInterestCards(prev =>
      prev.map(c => c.id === card.id ? { ...c, status: 'passed' as const, respondedAt: now.toISOString() } : c)
    );
  };

  const formatDateString = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'accepted') return theme.success;
    if (status === 'passed') return '#999';
    if (status === 'expired') return '#666';
    return theme.warning;
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'passed', label: 'Passed' },
  ];

  const pendingCount = interestCards.filter(c => c.status === 'pending').length;

  const renderCard = (card: InterestCard) => (
    <View
      key={card.id}
      style={[
        styles.card,
        { backgroundColor: theme.backgroundDefault },
        card.isSuperInterest ? { borderWidth: 2, borderColor: '#FFD700' } : null,
      ]}
    >
      {card.isSuperInterest ? (
        <View style={styles.superBadge}>
          <Feather name="star" size={12} color="#FFD700" />
          <ThemedText style={[Typography.small, { color: '#FFD700', fontWeight: '700', marginLeft: 4 }]}>
            Super Interest
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.header}>
        {card.renterPhoto ? (
          <Image source={{ uri: card.renterPhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
            <Feather name="user" size={24} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.info}>
          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{card.renterName}</ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {card.propertyTitle}
          </ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            Sent {formatDateString(card.createdAt)}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(card.status) }]}>
          <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
            {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <View style={[styles.compatBadge, { backgroundColor: '#ff6b5b' }]}>
            <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700' }]}>
              {card.compatibilityScore}% Match
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: 4 }]}>
              {card.budgetRange}
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: 4 }]}>
              {card.moveInDate}
            </ThemedText>
          </View>
        </View>

        {card.lifestyleTags.length > 0 ? (
          <View style={styles.tagsRow}>
            {card.lifestyleTags.map((tag, idx) => (
              <View key={idx} style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[Typography.small, { color: theme.text }]}>{tag}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {card.personalNote ? (
        <View style={[styles.noteBox, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="message-square" size={14} color={theme.textSecondary} />
          <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.sm, flex: 1 }]}>
            "{card.personalNote}"
          </ThemedText>
        </View>
      ) : null}

      {card.status === 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.success, flex: 1 }]}
            onPress={() => handleAcceptInterest(card)}
          >
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Accept
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary, flex: 1 }]}
            onPress={() => handlePassInterest(card)}
          >
            <Feather name="x" size={20} color={theme.text} />
            <ThemedText style={[Typography.body, { marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Pass
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText style={[Typography.h2]}>Inquiries</ThemedText>
          {pendingCount > 0 ? (
            <View style={styles.pendingBadge}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700' }]}>
                {pendingCount} pending
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {filterTabs.map(tab => (
            <Pressable
              key={tab.key}
              style={[
                styles.filterPill,
                {
                  backgroundColor: filter === tab.key ? theme.primary : theme.backgroundSecondary,
                },
              ]}
              onPress={() => setFilter(tab.key)}
            >
              <ThemedText
                style={[
                  Typography.caption,
                  { color: filter === tab.key ? '#FFFFFF' : theme.text, fontWeight: filter === tab.key ? '600' : '400' },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="heart" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }]}>
              No inquiries
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
              {filter === 'all' ? 'No interest requests received yet' : `No ${filter} inquiries`}
            </ThemedText>
          </View>
        ) : (
          filtered.map(card => renderCard(card))
        )}
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  pendingBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  card: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  superBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: Spacing.md,
  },
  info: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  details: {
    marginTop: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  compatBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
    marginTop: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
});
