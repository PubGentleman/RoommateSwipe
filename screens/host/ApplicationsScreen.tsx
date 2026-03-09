import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Image, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenScrollView } from '../../components/ScreenScrollView';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { StorageService } from '../../utils/storage';
import { Application, Property, InterestCard, Conversation, Message } from '../../types/models';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type InterestFilterStatus = 'all' | 'pending' | 'accepted' | 'passed';
type SectionTab = 'applications' | 'interests';

export const ApplicationsScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [interestCards, setInterestCards] = useState<InterestCard[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [interestFilter, setInterestFilter] = useState<InterestFilterStatus>('all');
  const [activeSection, setActiveSection] = useState<SectionTab>('interests');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const loadApplications = useCallback(async () => {
    if (!user) return;
    await StorageService.initializeWithMockData();
    await StorageService.assignPropertiesToHost(user.id, user.name);
    const allProperties = await StorageService.getProperties();
    const myPropertyIds = allProperties
      .filter((p: Property) => p.hostId === user.id)
      .map((p: Property) => p.id);
    const allApps = await StorageService.getApplications();
    const myApps = allApps.filter((a: Application) => myPropertyIds.includes(a.propertyId));
    setApplications(myApps);
    const notesMap: Record<string, string> = {};
    myApps.forEach((a: Application) => {
      if (a.notes) notesMap[a.id] = a.notes;
    });
    setEditingNotes(notesMap);
  }, [user]);

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
      loadApplications();
      loadInterestCards();
    }, [loadApplications, loadInterestCards])
  );

  const filteredApps = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const filteredInterests = interestCards.filter(card => {
    if (interestFilter === 'all') return true;
    return card.status === interestFilter;
  });

  const updateApplicationStatus = async (appId: string, status: 'approved' | 'rejected') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const updated = { ...app, status };
    await StorageService.addOrUpdateApplication(updated);
    setApplications(prev => prev.map(a => a.id === appId ? updated : a));
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

    const notifId1 = `notif-${Date.now()}-accept-renter`;
    await StorageService.addNotification({
      id: notifId1,
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

    const notifId2 = `notif-${Date.now()}-accept-host`;
    await StorageService.addNotification({
      id: notifId2,
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

    await StorageService.updateInterestCard(card.id, {
      status: 'passed',
      respondedAt: new Date().toISOString(),
    });

    const now = new Date();
    const notifId = `notif-${Date.now()}-pass`;
    await StorageService.addNotification({
      id: notifId,
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

  const saveNote = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const updated = { ...app, notes: editingNotes[appId] || '' };
    await StorageService.addOrUpdateApplication(updated);
    setApplications(prev => prev.map(a => a.id === appId ? updated : a));
  };

  const formatDate = (date: Date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Unknown';
    const days = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
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
    if (status === 'approved' || status === 'accepted') return theme.success;
    if (status === 'rejected' || status === 'passed') return theme.error;
    return theme.warning;
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getInterestStatusColor = (status: string) => {
    if (status === 'accepted') return theme.success;
    if (status === 'passed') return '#999';
    if (status === 'expired') return '#666';
    return theme.warning;
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const interestFilterTabs: { key: InterestFilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'passed', label: 'Passed' },
  ];

  const pendingInterestCount = interestCards.filter(c => c.status === 'pending').length;

  const renderInterestCard = (card: InterestCard) => (
    <View
      key={card.id}
      style={[
        styles.applicationCard,
        { backgroundColor: theme.backgroundDefault },
        card.isSuperInterest ? { borderWidth: 2, borderColor: '#FFD700' } : null,
      ]}
    >
      {card.isSuperInterest ? (
        <View style={styles.superInterestBadge}>
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
        <View style={styles.applicantInfo}>
          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{card.renterName}</ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {card.propertyTitle}
          </ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            Sent {formatDateString(card.createdAt)}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getInterestStatusColor(card.status) }]}>
          <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
            {getStatusLabel(card.status)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.interestDetails}>
        <View style={styles.detailRow}>
          <View style={[styles.compatibilityBadge, { backgroundColor: '#ff6b5b' }]}>
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
        <View style={[styles.noteContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="message-square" size={14} color={theme.textSecondary} />
          <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.sm, flex: 1 }]}>
            "{card.personalNote}"
          </ThemedText>
        </View>
      ) : null}

      {card.status === 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.success, flex: 1 }]}
            onPress={() => handleAcceptInterest(card)}
          >
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Accept
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, flex: 1 }]}
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

  const renderApplication = (app: Application) => (
    <View
      key={app.id}
      style={[styles.applicationCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.header}>
        <Image source={{ uri: app.applicantPhoto }} style={styles.avatar} />
        <View style={styles.applicantInfo}>
          <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{app.applicantName}</ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {app.propertyTitle}
          </ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            Applied {formatDate(app.submittedDate)}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) }]}>
          <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
            {getStatusLabel(app.status)}
          </ThemedText>
        </View>
      </View>
      {app.message ? (
        <ThemedText style={[Typography.body, { marginTop: Spacing.lg }]} numberOfLines={3}>
          {app.message}
        </ThemedText>
      ) : null}
      <View style={styles.notesContainer}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
          Notes
        </ThemedText>
        <TextInput
          style={[
            styles.notesInput,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Add a note about this applicant..."
          placeholderTextColor={theme.textSecondary}
          value={editingNotes[app.id] || ''}
          onChangeText={(text) => setEditingNotes(prev => ({ ...prev, [app.id]: text }))}
          onBlur={() => saveNote(app.id)}
          multiline
        />
      </View>
      {app.status === 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.success, flex: 1 }]}
            onPress={() => updateApplicationStatus(app.id, 'approved')}
          >
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Approve
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary, flex: 1 }]}
            onPress={() => updateApplicationStatus(app.id, 'rejected')}
          >
            <Feather name="x" size={20} color={theme.text} />
            <ThemedText style={[Typography.body, { marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Reject
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenScrollView>
      <View style={styles.container}>
        <View style={styles.sectionTabs}>
          <Pressable
            style={[
              styles.sectionTab,
              activeSection === 'interests'
                ? { backgroundColor: theme.primary }
                : { backgroundColor: theme.backgroundSecondary },
            ]}
            onPress={() => setActiveSection('interests')}
          >
            <Feather
              name="heart"
              size={16}
              color={activeSection === 'interests' ? '#FFFFFF' : theme.text}
            />
            <ThemedText
              style={[
                Typography.caption,
                {
                  color: activeSection === 'interests' ? '#FFFFFF' : theme.text,
                  fontWeight: activeSection === 'interests' ? '600' : '400',
                  marginLeft: Spacing.xs,
                },
              ]}
            >
              Interest Requests
            </ThemedText>
            {pendingInterestCount > 0 ? (
              <View style={styles.countBadge}>
                <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '700' }]}>
                  {pendingInterestCount}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[
              styles.sectionTab,
              activeSection === 'applications'
                ? { backgroundColor: theme.primary }
                : { backgroundColor: theme.backgroundSecondary },
            ]}
            onPress={() => setActiveSection('applications')}
          >
            <Feather
              name="file-text"
              size={16}
              color={activeSection === 'applications' ? '#FFFFFF' : theme.text}
            />
            <ThemedText
              style={[
                Typography.caption,
                {
                  color: activeSection === 'applications' ? '#FFFFFF' : theme.text,
                  fontWeight: activeSection === 'applications' ? '600' : '400',
                  marginLeft: Spacing.xs,
                },
              ]}
            >
              Applications
            </ThemedText>
          </Pressable>
        </View>

        {activeSection === 'interests' ? (
          <>
            <View style={styles.filterRow}>
              {interestFilterTabs.map(tab => (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: interestFilter === tab.key ? theme.primary : theme.backgroundSecondary,
                    },
                  ]}
                  onPress={() => setInterestFilter(tab.key)}
                >
                  <ThemedText
                    style={[
                      Typography.caption,
                      { color: interestFilter === tab.key ? '#FFFFFF' : theme.text, fontWeight: interestFilter === tab.key ? '600' : '400' },
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {filteredInterests.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="heart" size={48} color={theme.textSecondary} />
                <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }]}>
                  No interest requests
                </ThemedText>
                <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                  {interestFilter === 'all' ? 'No interest requests received yet' : `No ${interestFilter} interest requests`}
                </ThemedText>
              </View>
            ) : (
              filteredInterests.map(card => renderInterestCard(card))
            )}
          </>
        ) : (
          <>
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
            {filteredApps.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={48} color={theme.textSecondary} />
                <ThemedText style={[Typography.h3, { color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }]}>
                  No applications
                </ThemedText>
                <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
                  {filter === 'all' ? 'No applications received yet' : `No ${filter} applications`}
                </ThemedText>
              </View>
            ) : (
              filteredApps.map(app => renderApplication(app))
            )}
          </>
        )}
      </View>
    </ScreenScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  sectionTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.medium,
  },
  countBadge: {
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
    paddingHorizontal: 6,
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
  applicationCard: {
    borderRadius: BorderRadius.medium,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  superInterestBadge: {
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
  applicantInfo: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.small,
  },
  interestDetails: {
    marginTop: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  compatibilityBadge: {
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
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.small,
    marginTop: Spacing.md,
  },
  notesContainer: {
    marginTop: Spacing.lg,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    padding: Spacing.md,
    minHeight: 60,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
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
