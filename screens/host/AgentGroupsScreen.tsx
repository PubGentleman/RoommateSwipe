import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  AgentGroup,
  getAgentGroups,
  updateAgentGroupStatus,
  recordPlacement,
  chargeAgentPlacementFee,
  getMonthlyPlacementCount,
} from '../../services/agentMatchmakerService';
import { getAgentPlanLimits, canAgentPlace, type AgentPlan } from '../../constants/planLimits';

const BG = '#111';
const CARD_BG = '#1a1a1a';
const ACCENT = '#ff6b5b';
const GREEN = '#2ecc71';
const YELLOW = '#f39c12';
const BLUE = '#3b82f6';
const RED = '#e74c3c';

type StatusFilter = 'all' | 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved';

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  assembling: { color: BLUE, label: 'Assembling', icon: 'edit-3' },
  invited: { color: YELLOW, label: 'Invited', icon: 'send' },
  active: { color: GREEN, label: 'Active', icon: 'check-circle' },
  placed: { color: ACCENT, label: 'Placed', icon: 'award' },
  dissolved: { color: '#666', label: 'Dissolved', icon: 'x-circle' },
};

export const AgentGroupsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();

  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const agentPlan: AgentPlan = (user?.agentPlan as AgentPlan) || 'pay_per_use';
  const planLimits = getAgentPlanLimits(agentPlan);

  useFocusEffect(
    useCallback(() => {
      if (user) loadGroups();
    }, [user])
  );

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getAgentGroups(user.id);
      setGroups(data);
    } catch (e) {
      console.warn('[AgentGroups] Load error:', e);
    }
    setLoading(false);
  };

  const handleMarkPlaced = async (group: AgentGroup) => {
    if (!user) return;

    const monthlyCount = await getMonthlyPlacementCount(user.id);
    if (!canAgentPlace(agentPlan, monthlyCount)) {
      showAlert({ title: 'Limit Reached', message: 'Monthly placement limit reached. Upgrade to place more groups.' });
      return;
    }

    const feeDisplay = `$${(planLimits.placementFeeCents / 100).toFixed(2)}`;

    const confirmed = await confirm({
      title: 'Confirm Placement',
      message: `A placement fee of ${feeDisplay} will be charged to your payment method on file.`,
    });
    if (confirmed) {
      const placement = await recordPlacement(
        user.id,
        group.id,
        group.targetListingId ?? '',
        planLimits.placementFeeCents
      );

      const chargeResult = await chargeAgentPlacementFee(
        user.id,
        placement.id,
        group.id,
        group.targetListingId ?? ''
      );

      if (chargeResult.success) {
        await updateAgentGroupStatus(group.id, 'placed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert({ title: 'Payment Issue', message: chargeResult.error ?? 'Placement fee could not be charged. Please check your payment method.' });
      }
      loadGroups();
    }
  };

  const handleDissolve = async (group: AgentGroup) => {
    const confirmed = await confirm({
      title: 'Dissolve Group',
      message: 'Are you sure? This will dissolve the group and cannot be undone.',
    });
    if (confirmed) {
      await updateAgentGroupStatus(group.id, 'dissolved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      loadGroups();
    }
  };

  const filteredGroups = statusFilter === 'all'
    ? groups
    : groups.filter(g => g.groupStatus === statusFilter);

  const renderGroupCard = ({ item }: { item: AgentGroup }) => {
    const config = STATUS_CONFIG[item.groupStatus] ?? STATUS_CONFIG.assembling;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
            <Feather name={config.icon as any} size={12} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          {item.avgCompatibility > 0 ? (
            <View style={styles.compatBadge}>
              <Text style={styles.compatText}>{item.avgCompatibility}%</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.groupName}>{item.name}</Text>

        {item.targetListing ? (
          <Text style={styles.listingInfo}>
            {item.targetListing.title} - ${item.targetListing.price.toLocaleString()}/mo
          </Text>
        ) : null}

        <View style={styles.membersRow}>
          {item.members.slice(0, 4).map((m, i) => (
            <View key={m.id} style={styles.memberChip}>
              {m.photos?.[0] ? (
                <Image source={{ uri: m.photos[0] }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={12} color="#666" />
                </View>
              )}
              <Text style={styles.memberName} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
            </View>
          ))}
        </View>

        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Budget:</Text>
          <Text style={styles.budgetValue}>
            ${item.combinedBudgetMin.toLocaleString()}-${item.combinedBudgetMax.toLocaleString()}/mo
          </Text>
          {item.targetListing ? (
            <Text style={[styles.coversRent, { color: item.coversRent ? GREEN : RED }]}>
              {item.coversRent ? 'Covers rent' : 'Short'}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          {item.groupStatus === 'assembling' ? (
            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('AgentGroupBuilder', {
              preselectedIds: item.memberIds,
              listingId: item.targetListingId,
            })}>
              <Feather name="send" size={14} color="#fff" />
              <Text style={styles.actionText}>Send Invites</Text>
            </Pressable>
          ) : null}

          {item.groupStatus === 'active' ? (
            <>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: GREEN }]}
                onPress={() => handleMarkPlaced(item)}
              >
                <Feather name="check" size={14} color="#fff" />
                <Text style={styles.actionText}>Mark as Placed</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: BLUE }]}
                onPress={() => navigation.navigate('Messages', { highlightGroupId: item.id })}
              >
                <Feather name="message-circle" size={14} color="#fff" />
                <Text style={styles.actionText}>Message</Text>
              </Pressable>
            </>
          ) : null}

          {item.groupStatus === 'placed' ? (
            <View style={styles.placedInfo}>
              <Feather name="award" size={16} color={ACCENT} />
              <Text style={styles.placedText}>
                Placement fee: ${(planLimits.placementFeeCents / 100).toFixed(2)}
              </Text>
            </View>
          ) : null}

          {item.groupStatus !== 'placed' && item.groupStatus !== 'dissolved' ? (
            <Pressable
              style={styles.dissolveBtn}
              onPress={() => handleDissolve(item)}
            >
              <Feather name="x" size={14} color="#888" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <Pressable
          style={styles.newGroupBtn}
          onPress={() => navigation.navigate('BrowseRenters')}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.newGroupText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'assembling', 'invited', 'active', 'placed', 'dissolved'] as StatusFilter[]).map(f => (
          <Pressable
            key={f}
            style={[styles.filterChip, statusFilter === f ? styles.filterChipActive : null]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterText, statusFilter === f ? styles.filterTextActive : null]}>
              {f === 'all' ? 'All' : (STATUS_CONFIG[f]?.label ?? f)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 40 }} />
      ) : filteredGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="users" size={48} color="#444" />
          <Text style={styles.emptyTitle}>No Groups Yet</Text>
          <Text style={styles.emptyDesc}>
            Browse renters, shortlist your top picks, and build your first group.
          </Text>
          <Pressable
            style={styles.startBtn}
            onPress={() => navigation.navigate('BrowseRenters')}
          >
            <Text style={styles.startBtnText}>Browse Renters</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={item => item.id}
          renderItem={renderGroupCard}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  newGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newGroupText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap', gap: 6 },
  filterChip: { backgroundColor: CARD_BG, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  filterChipActive: { backgroundColor: ACCENT },
  filterText: { color: '#888', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  compatBadge: { backgroundColor: 'rgba(46,204,113,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  compatText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  groupName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listingInfo: { color: '#888', fontSize: 13, marginTop: 4 },
  membersRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#222', borderRadius: 20, paddingRight: 10, paddingLeft: 2, paddingVertical: 2 },
  memberAvatar: { width: 28, height: 28, borderRadius: 14 },
  avatarPlaceholder: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  memberName: { color: '#ccc', fontSize: 12, maxWidth: 80 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  budgetLabel: { color: '#888', fontSize: 13 },
  budgetValue: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  coversRent: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flex: 1, justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dissolveBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  placedInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placedText: { color: '#aaa', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptyDesc: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40, lineHeight: 22 },
  startBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
