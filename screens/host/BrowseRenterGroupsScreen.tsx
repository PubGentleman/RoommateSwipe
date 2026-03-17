import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
    Alert.alert(
      'Message This Group',
      'Your listing details will be sent to this group. They can accept or decline your inquiry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            setSentRequests(prev => [...prev, groupId]);
            Alert.alert('Sent!', 'Your listing was shared with this group.');
          },
        },
      ]
    );
  };

  if (hostSub && isFreePlan(hostSub.plan)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Renter Groups</Text>
          <Text style={styles.subtitle}>Groups actively looking for a place together</Text>
        </View>
        <View style={styles.lockedContainer}>
          <Feather name="lock" size={40} color={PURPLE} />
          <Text style={styles.lockedTitle}>Available on Starter+</Text>
          <Text style={styles.lockedDesc}>
            Upgrade your host plan to browse renter groups and connect with renters looking for a place together.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Dashboard', { screen: 'HostSubscription' })}
            style={styles.upgradeCta}
          >
            <Text style={styles.upgradeCtaText}>See Plans</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const renderGroup = ({ item }: { item: RenterGroupCard }) => {
    const alreadySent = sentRequests.includes(item.groupId);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.memberBadge}>
            <Feather name="users" size={14} color={PURPLE} />
            <Text style={styles.memberText}>
                {item.memberCount === 1
                  ? '1 person looking — open to roommates'
                  : `${item.memberCount} people looking together`}
              </Text>
          </View>
          <Text style={styles.moveIn}>Move-in: {item.moveInDate}</Text>
        </View>

        <Text style={styles.budget}>
          ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}/mo
        </Text>

        <View style={styles.tagsRow}>
          {item.neighborhoods.slice(0, 3).map(n => (
            <View key={n} style={styles.neighborhoodChip}>
              <Feather name="map-pin" size={10} color="rgba(255,255,255,0.5)" />
              <Text style={styles.neighborhoodText}>{n}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tagsRow}>
          {item.lifestyleTags.slice(0, 4).map(t => (
            <View key={t} style={styles.lifestyleChip}>
              <Text style={styles.lifestyleText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.occupationRow}>
          {item.occupationTypes.map(o => (
            <View key={o} style={styles.occupationChip}>
              <Feather name="briefcase" size={10} color="rgba(255,255,255,0.4)" />
              <Text style={styles.occupationText}>{o}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.ctaButton, alreadySent ? styles.ctaButtonSent : null]}
          onPress={() => !alreadySent ? handleMessage(item.groupId) : null}
          disabled={alreadySent}
        >
          {alreadySent ? (
            <View style={styles.ctaInner}>
              <Feather name="check" size={14} color="rgba(255,255,255,0.4)" />
              <Text style={[styles.ctaText, { color: 'rgba(255,255,255,0.4)' }]}>Request Sent</Text>
            </View>
          ) : (
            <LinearGradient colors={[ROOMDR_PURPLE, '#6a4d96']} style={styles.ctaGradient}>
              <Feather name="send" size={14} color="#fff" />
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
        <Text style={styles.title}>Renter Groups</Text>
        <Text style={styles.subtitle}>Groups actively looking for a place together</Text>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading groups...</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberText: { color: PURPLE, fontSize: 13, fontWeight: '600' },
  moveIn: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  budget: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 14 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  neighborhoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  neighborhoodText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  lifestyleChip: {
    backgroundColor: 'rgba(123,94,167,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lifestyleText: { fontSize: 12, color: PURPLE },
  occupationRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  occupationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  occupationText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  ctaButton: { borderRadius: 12, overflow: 'hidden' },
  ctaButtonSent: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockedTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16, textAlign: 'center' },
  lockedDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  upgradeCta: {
    marginTop: 20,
    backgroundColor: 'rgba(168,85,247,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  upgradeCtaText: { fontSize: 15, fontWeight: '700', color: PURPLE },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  emptySubtext: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' },
});
