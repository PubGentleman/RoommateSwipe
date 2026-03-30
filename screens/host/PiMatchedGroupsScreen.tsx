import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal,
  ActivityIndicator, TextInput,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { PiAutoGroup } from '../../types/models';
import {
  getAvailableGroups,
  claimGroup,
  getClaimAllowance,
  getClaimsUsedThisMonth,
} from '../../services/piAutoMatchService';
import { getAgentPlanLimits, getAutoClaimLimits, type AgentPlan } from '../../constants/planLimits';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const PURPLE = '#a855f7';
const GOLD = '#ffd700';

type SortOption = 'score' | 'budget' | 'newest';

export const PiMatchedGroupsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();

  const [groups, setGroups] = useState<PiAutoGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<PiAutoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimsUsed, setClaimsUsed] = useState(0);
  const [freeClaimsTotal, setFreeClaimsTotal] = useState(0);
  const [freeRemaining, setFreeRemaining] = useState(0);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [cityFilter, setCityFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempCity, setTempCity] = useState('');
  const [tempSize, setTempSize] = useState<number | null>(null);

  const hostPlan = user?.hostSubscription?.plan || 'free';
  const hostType = user?.hostType || 'individual';
  const agentPlan = user?.agentPlan as AgentPlan | undefined;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [available, usage] = await Promise.all([
        getAvailableGroups(cityFilter ? { city: cityFilter } : undefined),
        getClaimsUsedThisMonth(user.id),
      ]);

      const limits = getAutoClaimLimits(
        agentPlan || hostPlan,
        hostType
      );
      setFreeClaimsTotal(limits.freePerMonth);
      setClaimsUsed(usage.total);
      setFreeRemaining(
        limits.freePerMonth === -1 ? -1 : Math.max(0, limits.freePerMonth - usage.free)
      );

      setGroups(available);
      applyFiltersAndSort(available, sizeFilter, sortBy);
    } catch {
      setGroups([]);
      setFilteredGroups([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, cityFilter, sizeFilter, sortBy, agentPlan, hostPlan, hostType]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const applyFiltersAndSort = (
    data: PiAutoGroup[],
    size: number | null,
    sort: SortOption
  ) => {
    let result = [...data];
    if (size) {
      result = result.filter(g => g.max_members === size);
    }
    switch (sort) {
      case 'score':
        result.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        break;
      case 'budget':
        result.sort((a, b) => (a.budget_min || 0) - (b.budget_min || 0));
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    setFilteredGroups(result);
  };

  const handleClaimGroup = async (group: PiAutoGroup) => {
    if (!user) return;

    const allowance = await getClaimAllowance(
      user.id,
      agentPlan || hostPlan,
      hostType
    );

    if (!allowance.allowed) {
      showAlert({
        title: 'Claims Not Available',
        message: 'Your current plan does not include group claims. Upgrade to access Pi matched groups.',
      });
      return;
    }

    if (!allowance.isFree && allowance.priceCents > 0) {
      const price = (allowance.priceCents / 100).toFixed(2);
      const confirmed = await confirm({
        title: 'Confirm Paid Claim',
        message: `You've used all free claims this month. This claim costs $${price}. Confirm?`,
        confirmText: `Pay $${price}`,
        cancelText: 'Cancel',
      });
      if (!confirmed) return;
    }

    setClaimingId(group.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const listingId = '';
    const success = await claimGroup(
      group.id,
      user.id,
      listingId,
      allowance.isFree,
      allowance.priceCents
    );

    if (success) {
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setFilteredGroups(prev => prev.filter(g => g.id !== group.id));
      setClaimsUsed(prev => prev + 1);
      if (freeRemaining > 0) setFreeRemaining(prev => prev - 1);

      navigation.navigate('PiClaimedGroupDetail', { groupId: group.id });
    } else {
      showAlert({
        title: 'Claim Failed',
        message: 'Could not claim this group. It may have already been claimed by someone else.',
      });
    }
    setClaimingId(null);
  };

  const applyFilterModal = () => {
    setCityFilter(tempCity);
    setSizeFilter(tempSize);
    setShowFilterModal(false);
    applyFiltersAndSort(
      tempCity ? groups.filter(g => g.city?.toLowerCase().includes(tempCity.toLowerCase())) : groups,
      tempSize,
      sortBy
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return GREEN;
    if (score >= 60) return GOLD;
    return ACCENT;
  };

  const formatBudget = (min: number, max: number) => {
    if (!min && !max) return '';
    const fmtMin = min >= 1000 ? `$${(min / 1000).toFixed(1)}k` : `$${min}`;
    const fmtMax = max >= 1000 ? `$${(max / 1000).toFixed(1)}k` : `$${max}`;
    return `${fmtMin} - ${fmtMax}`;
  };

  const renderGroupCard = ({ item }: { item: PiAutoGroup }) => {
    const score = item.match_score || 0;
    const scoreColor = getScoreColor(score);
    const isClaiming = claimingId === item.id;
    const moveIn = item.move_in_window_start
      ? new Date(item.move_in_window_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.sizeBadge, { backgroundColor: PURPLE + '20' }]}>
              <Feather name="users" size={14} color={PURPLE} />
              <Text style={[styles.sizeBadgeText, { color: PURPLE }]}>
                {item.max_members} {item.max_members === 1 ? 'person' : 'people'}
              </Text>
            </View>
            {item.desired_bedrooms > 0 ? (
              <View style={[styles.sizeBadge, { backgroundColor: '#3b82f6' + '20' }]}>
                <Feather name="home" size={12} color="#3b82f6" />
                <Text style={[styles.sizeBadgeText, { color: '#3b82f6' }]}>
                  {item.desired_bedrooms === -1 ? 'Studio' : `${item.desired_bedrooms}BR`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>{score}</Text>
          </View>
        </View>

        {item.city || (item.neighborhoods && item.neighborhoods.length > 0) ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.neighborhoods && item.neighborhoods.length > 0
                ? item.neighborhoods.slice(0, 3).join(', ')
                : item.city}
              {item.state ? `, ${item.state}` : ''}
            </Text>
          </View>
        ) : null}

        {item.budget_min > 0 && item.budget_max > 0 ? (
          <View style={styles.infoRow}>
            <Feather name="dollar-sign" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.infoText}>{formatBudget(item.budget_min, item.budget_max)}/mo</Text>
          </View>
        ) : null}

        {moveIn ? (
          <View style={styles.infoRow}>
            <Feather name="calendar" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.infoText}>Move-in: {moveIn}</Text>
          </View>
        ) : null}

        {item.pi_rationale ? (
          <Text style={styles.rationale} numberOfLines={2}>
            {item.pi_rationale}
          </Text>
        ) : null}

        <Pressable
          style={[styles.claimBtn, isClaiming ? { opacity: 0.5 } : null]}
          onPress={() => handleClaimGroup(item)}
          disabled={isClaiming}
        >
          {isClaiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={styles.claimBtnText}>Claim Group</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {freeClaimsTotal !== 0 ? (
        <View style={styles.allowanceBanner}>
          <Feather name="info" size={14} color={PURPLE} />
          <Text style={styles.allowanceText}>
            {freeRemaining === -1
              ? 'Unlimited claims on your plan'
              : freeRemaining > 0
                ? `${claimsUsed} of ${freeClaimsTotal} claims used this month. Next claim is free.`
                : `All ${freeClaimsTotal} free claims used. Additional claims are paid.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.sortRow}>
        {(['score', 'budget', 'newest'] as SortOption[]).map(opt => (
          <Pressable
            key={opt}
            style={[styles.sortChip, sortBy === opt ? styles.sortChipActive : null]}
            onPress={() => {
              setSortBy(opt);
              applyFiltersAndSort(groups, sizeFilter, opt);
            }}
          >
            <Text style={[styles.sortChipText, sortBy === opt ? styles.sortChipTextActive : null]}>
              {opt === 'score' ? 'Best Match' : opt === 'budget' ? 'Budget' : 'Newest'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrap, { backgroundColor: PURPLE + '15' }]}>
        <Feather name="cpu" size={36} color={PURPLE} />
      </View>
      <Text style={styles.emptyTitle}>No matched groups available</Text>
      <Text style={styles.emptySubtitle}>
        {cityFilter
          ? `No matched groups in "${cityFilter}" yet. Try removing the city filter.`
          : 'Pi is working on assembling compatible roommate groups in your area!'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{'\u03C0'} Pi Matched Groups</Text>
        <Pressable
          style={styles.filterBtn}
          onPress={() => {
            setTempCity(cityFilter);
            setTempSize(sizeFilter);
            setShowFilterModal(true);
          }}
        >
          <Feather name="sliders" size={18} color={(cityFilter || sizeFilter) ? PURPLE : '#888'} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PURPLE} />
          <Text style={styles.loadingText}>Loading matched groups...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          renderItem={renderGroupCard}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
        />
      )}

      <Modal visible={showFilterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Groups</Text>

            <Text style={styles.modalLabel}>City</Text>
            <TextInput
              style={styles.modalInput}
              value={tempCity}
              onChangeText={setTempCity}
              placeholder="e.g. New York"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.modalLabel}>Group Size</Text>
            <View style={styles.sizeFilterRow}>
              {[null, 2, 3, 4].map(size => (
                <Pressable
                  key={size ?? 'any'}
                  style={[styles.sizeChip, tempSize === size ? styles.sizeChipActive : null]}
                  onPress={() => setTempSize(size)}
                >
                  <Text style={[styles.sizeChipText, tempSize === size ? styles.sizeChipTextActive : null]}>
                    {size === null ? 'Any' : `${size}`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalClearBtn}
                onPress={() => {
                  setTempCity('');
                  setTempSize(null);
                }}
              >
                <Text style={styles.modalClearText}>Clear</Text>
              </Pressable>
              <Pressable style={styles.modalApplyBtn} onPress={applyFilterModal}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </Pressable>
            </View>

            <Pressable style={styles.modalCloseBtn} onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  filterBtn: { padding: 6 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  allowanceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PURPLE + '12', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  allowanceText: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sortChipActive: { backgroundColor: PURPLE + '20', borderColor: PURPLE + '40' },
  sortChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  sortChipTextActive: { color: PURPLE },
  card: {
    backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' },
  sizeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  sizeBadgeText: { fontSize: 12, fontWeight: '600' },
  scoreRing: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreText: { fontSize: 14, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  locationText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  rationale: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 17,
    marginTop: 6, marginBottom: 8, fontStyle: 'italic',
  },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PURPLE, borderRadius: 10, paddingVertical: 11, marginTop: 4,
  },
  claimBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 19,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  modalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 14, marginBottom: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sizeFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sizeChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sizeChipActive: { backgroundColor: PURPLE + '20', borderColor: PURPLE },
  sizeChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  sizeChipTextActive: { color: PURPLE, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  modalClearBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalClearText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  modalApplyBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: PURPLE,
  },
  modalApplyText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 10 },
  modalCloseText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
