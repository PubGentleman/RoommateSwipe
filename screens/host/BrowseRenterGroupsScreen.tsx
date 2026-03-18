import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Modal, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { isFreePlan } from '../../utils/hostPricing';
import { HostSubscriptionData } from '../../types/models';
import { createListingInquiryGroup } from '../../services/groupService';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const PURPLE = '#a855f7';
const ROOMDR_PURPLE = '#7B5EA7';

interface RenterGroupCard {
  groupId: string;
  name: string;
  description: string;
  memberCount: number;
  maxMembers: number;
  budgetMin: number;
  budgetMax: number;
  moveInDate: string;
  location: string;
  neighborhoods: string[];
  lifestyleTags: string[];
  occupationTypes: string[];
  createdAt: string;
}

export const BrowseRenterGroupsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [groups, setGroups] = useState<RenterGroupCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [hostSub, setHostSub] = useState<HostSubscriptionData | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [pendingMessageGroupId, setPendingMessageGroupId] = useState<string | null>(null);
  const [messageSending, setMessageSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const sub = await StorageService.getHostSubscription(user.id);
      setHostSub(sub);
      if (isFreePlan(sub.plan)) {
        setLoading(false);
        return;
      }
      await loadGroups();
    };
    load();
  }, [user]);

  const loadGroups = async () => {
    try {
      const data = await StorageService.getVisibleRenterGroups();
      if (data.length > 0) {
        setGroups(data);
      } else {
        loadMockGroups();
      }
    } catch {
      loadMockGroups();
    } finally {
      setLoading(false);
    }
  };

  const loadMockGroups = () => {
    if (!isDev) return;
    setGroups([
      {
        groupId: 'group_mock_1',
        name: 'Creative Roommates',
        description: 'Artists, designers, and creative professionals seeking a collaborative living space',
        memberCount: 3,
        maxMembers: 4,
        budgetMin: 2000,
        budgetMax: 2800,
        moveInDate: 'April 2026',
        location: 'Williamsburg',
        neighborhoods: ['Brooklyn', 'Bushwick', 'Bed-Stuy'],
        lifestyleTags: ['Pet-friendly', 'Non-smoker', 'Remote work'],
        occupationTypes: ['Professional', 'Creative'],
        createdAt: new Date().toISOString(),
      },
      {
        groupId: 'group_mock_2',
        name: 'Young Professionals',
        description: 'Working professionals looking for a clean, quiet apartment near transit',
        memberCount: 2,
        maxMembers: 3,
        budgetMin: 1500,
        budgetMax: 2200,
        moveInDate: 'May 2026',
        location: 'Astoria',
        neighborhoods: ['Astoria', 'Long Island City'],
        lifestyleTags: ['Early riser', 'Clean', 'Social'],
        occupationTypes: ['Student', 'Professional'],
        createdAt: new Date().toISOString(),
      },
      {
        groupId: 'group_mock_3',
        name: 'Manhattan Movers',
        description: 'Finance and tech professionals seeking upscale shared living in Manhattan',
        memberCount: 4,
        maxMembers: 4,
        budgetMin: 3000,
        budgetMax: 4000,
        moveInDate: 'March 2026',
        location: 'Upper West Side',
        neighborhoods: ['Manhattan', 'Upper West Side', 'Harlem'],
        lifestyleTags: ['Quiet hours', 'Non-smoker', 'Professional'],
        occupationTypes: ['Professional', 'Finance'],
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleMessage = (groupId: string) => {
    if (sentRequests.includes(groupId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingMessageGroupId(groupId);
    setShowMessageModal(true);
  };

  const confirmSendMessage = async () => {
    if (!pendingMessageGroupId || !user) return;
    setMessageSending(true);

    try {
      const properties = await StorageService.getProperties();
      const activeListings = properties.filter(p => p.hostId === user.id && p.available);
      const listing = activeListings[0];

      if (!listing) {
        Alert.alert(
          'No Active Listing',
          'You need an active listing to message a group. Go to the Listings tab to create one.',
          [{ text: 'OK' }]
        );
        setMessageSending(false);
        setShowMessageModal(false);
        return;
      }

      const group = groups.find(g => g.groupId === pendingMessageGroupId);
      const groupName = group ? `Inquiry — ${group.location || group.neighborhoods[0] || 'Your Listing'}` : 'Listing Inquiry';

      const inquiryGroup = await createListingInquiryGroup(
        listing.id,
        user.id,
        listing.address || listing.city || 'Your listing',
        pendingMessageGroupId,
        groupName,
      );

      setSentRequests(prev => [...prev, pendingMessageGroupId]);
      setMessageSending(false);
      setShowMessageModal(false);
      setPendingMessageGroupId(null);

      const parent = navigation.getParent();
      if (parent) {
        parent.navigate('Messages', {
          screen: 'Chat',
          params: { conversationId: inquiryGroup.id, isGroupChat: true },
        });
      } else {
        navigation.navigate('Messages', {
          screen: 'Chat',
          params: { conversationId: inquiryGroup.id, isGroupChat: true },
        });
      }
    } catch (error) {
      console.error('[BrowseRenterGroups] Failed to create inquiry group:', error);
      setMessageSending(false);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  if (hostSub && isFreePlan(hostSub.plan)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Renter Groups</Text>
            <Text style={styles.subtitle}>Groups actively looking for a place together</Text>
          </View>
        </View>
        <View style={styles.lockedContainer}>
          <LinearGradient
            colors={['rgba(123,94,167,0.15)', 'transparent']}
            style={styles.lockedGradient}
          >
            <View style={styles.lockedIconWrap}>
              <Feather name="lock" size={32} color={PURPLE} />
            </View>
            <Text style={styles.lockedTitle}>Browse Renter Groups</Text>
            <Text style={styles.lockedDesc}>
              Upgrade your host plan to see groups of renters actively looking for a place together — and message them directly with your listing.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Dashboard', { screen: 'HostSubscription' })}
              style={styles.upgradeCta}
            >
              <LinearGradient
                colors={[ROOMDR_PURPLE, '#6a4d96']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeCtaGradient}
              >
                <Feather name="zap" size={14} color="#fff" />
                <Text style={styles.upgradeCtaText}>See Plans</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    );
  }

  const renderGroup = ({ item }: { item: RenterGroupCard }) => {
    const alreadySent = sentRequests.includes(item.groupId);
    const spotsLeft = item.maxMembers - item.memberCount;

    const memberColors = ['#7B5EA7', '#4A90E2', '#22c55e', '#ff6b5b', '#f59e0b'];
    const gradients: [string, string][] = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#11998e', '#38ef7d'], ['#f6d365', '#fda085']];
    const memberLabels = Array.from({ length: item.memberCount }, (_, i) => ({
      gradient: gradients[i % gradients.length],
      label: String.fromCharCode(65 + i),
    }));

    return (
      <View style={styles.card}>
        <View style={styles.avatarCluster}>
          {memberLabels.slice(0, 3).map((m, i) => (
            <View
              key={i}
              style={[styles.avatarWrap, i > 0 && { marginLeft: -18 }, { zIndex: memberLabels.length - i }]}
            >
              <LinearGradient colors={m.gradient} style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{m.label}</Text>
              </LinearGradient>
            </View>
          ))}
          {spotsLeft > 0 ? (
            <View style={[styles.avatarWrap, styles.avatarEmpty, { marginLeft: -18, zIndex: 0 }]}>
              <Text style={styles.avatarPlus}>+</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.memberCountRow}>
          <Feather name="users" size={13} color="rgba(255,255,255,0.4)" />
          <Text style={styles.memberCountText}>
            {item.memberCount} of {item.maxMembers} members filled
          </Text>
          {spotsLeft > 0 ? (
            <View style={styles.spotPill}>
              <Text style={styles.spotPillText}>{spotsLeft} left</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.groupName}>{item.name}</Text>

        {item.description ? (
          <Text style={styles.groupDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
              <Feather name="dollar-sign" size={16} color={ACCENT} />
            </View>
            <View>
              <Text style={styles.statLabel}>BUDGET</Text>
              <Text style={styles.statValue}>${item.budgetMin.toLocaleString()}/mo</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
              <Feather name="map-pin" size={16} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>LOCATION</Text>
              <Text style={styles.statValue} numberOfLines={1}>{item.location || item.neighborhoods[0] || 'Flexible'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {item.lifestyleTags.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.lifestyleTags.slice(0, 4).map(t => (
              <View key={t} style={styles.lifestyleChip}>
                <Text style={styles.lifestyleText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.moveInDate ? (
          <View style={styles.moveInRow}>
            <Feather name="calendar" size={12} color="rgba(255,255,255,0.35)" />
            <Text style={styles.moveInText}>Move-in: {item.moveInDate}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.ctaButton, alreadySent ? styles.ctaButtonSent : null]}
          onPress={() => handleMessage(item.groupId)}
          disabled={alreadySent}
        >
          {alreadySent ? (
            <View style={styles.ctaInner}>
              <Feather name="check-circle" size={15} color="#22c55e" />
              <Text style={[styles.ctaText, { color: '#22c55e' }]}>Request Sent</Text>
            </View>
          ) : (
            <LinearGradient
              colors={[ROOMDR_PURPLE, '#6a4d96']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Feather name="send" size={15} color="#fff" />
              <Text style={styles.ctaText}>Message This Group</Text>
            </LinearGradient>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Renter Groups</Text>
          <Text style={styles.subtitle}>
            {groups.length > 0 ? `${groups.length} groups looking for a place` : 'Groups actively looking for a place together'}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="users" size={14} color={PURPLE} />
          <Text style={styles.headerBadgeText}>{groups.length}</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PURPLE} />
          <Text style={styles.loadingText}>Finding renter groups...</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={item => item.groupId}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={32} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No groups visible right now</Text>
              <Text style={styles.emptySubtext}>Check back soon for new renter groups.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMessageModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Feather name="send" size={26} color={PURPLE} />
            </View>
            <Text style={styles.modalTitle}>Message This Group</Text>
            <Text style={styles.modalDesc}>
              A group chat will be created with all members of this group. Everyone will see your listing and can respond together.
            </Text>
            <Pressable
              style={[styles.modalConfirmBtn, { opacity: messageSending ? 0.7 : 1 }]}
              onPress={confirmSendMessage}
              disabled={messageSending}
            >
              <LinearGradient
                colors={[ROOMDR_PURPLE, '#6a4d96']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalConfirmGradient}
              >
                {messageSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={15} color="#fff" />
                    <Text style={styles.modalConfirmText}>Send My Listing</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowMessageModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 3, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(123,94,167,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: PURPLE },

  list: { padding: 16, paddingBottom: 100 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },

  avatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: CARD_BG,
  },
  avatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '800', color: '#fff' },
  avatarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlus: { fontSize: 22, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },

  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  memberCountText: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  spotPill: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  spotPillText: { fontSize: 11, fontWeight: '700', color: '#22c55e' },

  groupName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  groupDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 1 },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  lifestyleChip: {
    backgroundColor: 'rgba(123,94,167,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lifestyleText: { fontSize: 12, fontWeight: '500', color: PURPLE },

  moveInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  moveInText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  ctaButton: { borderRadius: 14, overflow: 'hidden' },
  ctaButtonSent: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 14,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    shadowColor: ROOMDR_PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  lockedGradient: { width: '100%', borderRadius: 24, padding: 32, alignItems: 'center' },
  lockedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(123,94,167,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  lockedDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  upgradeCta: { borderRadius: 14, overflow: 'hidden', width: '100%' },
  upgradeCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
  },
  upgradeCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', lineHeight: 19 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalSheet: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(123,94,167,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  modalDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  modalConfirmBtn: { borderRadius: 14, overflow: 'hidden', width: '100%', marginBottom: 10 },
  modalConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
  },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalCancelBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
});
