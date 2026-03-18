import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../utils/storage';
import { isFreePlan } from '../../utils/hostPricing';
import { HostSubscriptionData } from '../../types/models';

const isDev = __DEV__;
const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const PURPLE = '#a855f7';
const ROOMDR_PURPLE = '#7B5EA7';

interface RenterGroupCard {
  groupId: string;
  memberCount: number;
  budgetMin: number;
  budgetMax: number;
  moveInDate: string;
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
        memberCount: 3,
        budgetMin: 2000,
        budgetMax: 2800,
        moveInDate: 'April 2026',
        neighborhoods: ['Brooklyn', 'Bushwick', 'Bed-Stuy'],
        lifestyleTags: ['Pet-friendly', 'Non-smoker', 'Remote work'],
        occupationTypes: ['Professional', 'Creative'],
        createdAt: new Date().toISOString(),
      },
      {
        groupId: 'group_mock_2',
        memberCount: 2,
        budgetMin: 1500,
        budgetMax: 2200,
        moveInDate: 'May 2026',
        neighborhoods: ['Astoria', 'Long Island City'],
        lifestyleTags: ['Early riser', 'Clean', 'Social'],
        occupationTypes: ['Student', 'Professional'],
        createdAt: new Date().toISOString(),
      },
      {
        groupId: 'group_mock_3',
        memberCount: 4,
        budgetMin: 3000,
        budgetMax: 4000,
        moveInDate: 'March 2026',
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

  const confirmSendMessage = () => {
    if (!pendingMessageGroupId) return;
    setMessageSending(true);
    setTimeout(() => {
      setSentRequests(prev => [...prev, pendingMessageGroupId]);
      setMessageSending(false);
      setShowMessageModal(false);
      setPendingMessageGroupId(null);
    }, 800);
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

    const memberColors = ['#7B5EA7', '#4A90E2', '#22c55e', '#ff6b5b', '#f59e0b'];
    const memberLabels = Array.from({ length: item.memberCount }, (_, i) => ({
      color: memberColors[i % memberColors.length],
      label: String.fromCharCode(65 + i),
    }));

    return (
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          {memberLabels.map((m, i) => (
            <View
              key={i}
              style={[
                styles.memberAvatar,
                { backgroundColor: m.color, marginLeft: i > 0 ? -10 : 0, zIndex: memberLabels.length - i },
              ]}
            >
              <Text style={styles.memberAvatarText}>{m.label}</Text>
            </View>
          ))}
          <View style={styles.memberCountPill}>
            <Feather name="users" size={11} color={PURPLE} />
            <Text style={styles.memberCountText}>
              {item.memberCount === 1 ? '1 person' : `${item.memberCount} people`}
            </Text>
          </View>
        </View>

        <View style={styles.budgetRow}>
          <Text style={styles.budget}>
            ${item.budgetMin.toLocaleString()} – ${item.budgetMax.toLocaleString()}
            <Text style={styles.budgetSuffix}>/mo</Text>
          </Text>
          <View style={styles.moveInPill}>
            <Feather name="calendar" size={11} color="rgba(255,255,255,0.4)" />
            <Text style={styles.moveInText}>{item.moveInDate}</Text>
          </View>
        </View>

        {item.neighborhoods.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.neighborhoods.slice(0, 3).map(n => (
              <View key={n} style={styles.neighborhoodChip}>
                <Feather name="map-pin" size={10} color="rgba(255,255,255,0.45)" />
                <Text style={styles.neighborhoodText}>{n}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.lifestyleTags.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.lifestyleTags.slice(0, 4).map(t => (
              <View key={t} style={styles.lifestyleChip}>
                <Text style={styles.lifestyleText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.occupationTypes.length > 0 ? (
          <View style={styles.occupationRow}>
            {item.occupationTypes.map(o => (
              <View key={o} style={styles.occupationChip}>
                <Feather name="briefcase" size={10} color="rgba(255,255,255,0.35)" />
                <Text style={styles.occupationText}>{o}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.cardDivider} />

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
              Your listing details will be shared with this group. They can review your property and respond to your inquiry.
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
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CARD_BG,
  },
  memberAvatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  memberCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(123,94,167,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 14,
  },
  memberCountText: { fontSize: 12, fontWeight: '600', color: PURPLE },

  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  budget: { fontSize: 24, fontWeight: '800', color: '#fff' },
  budgetSuffix: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  moveInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moveInText: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  neighborhoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  neighborhoodText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  lifestyleChip: {
    backgroundColor: 'rgba(123,94,167,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lifestyleText: { fontSize: 12, fontWeight: '500', color: PURPLE },
  occupationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  occupationChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  occupationText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },

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
