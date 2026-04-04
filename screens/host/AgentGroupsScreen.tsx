import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, ScrollView, Switch,
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
  sendAgentInvites,
  createAgentGroup,
  type AgentGroupsResult,
} from '../../services/agentMatchmakerService';
import { getAgentPlanLimits, canAgentPlace, type AgentPlan } from '../../constants/planLimits';
import { resolveEffectiveAgentPlan } from '../../utils/planResolver';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { shouldLoadMockData } from '../../utils/dataUtils';
import { InvitePreviewSheet } from '../../components/InvitePreviewSheet';
import { AgentRenter } from '../../services/agentMatchmakerService';
import {
  getAgentGroupJoinRequests,
  approveAgentGroupRequest,
  declineAgentGroupRequest,
} from '../../services/groupJoinService';
import { GroupJoinRequest } from '../../types/models';

const BG = '#0d0d0d';
const CARD_BG = '#151515';
const SURFACE = '#1a1a1a';
const ACCENT = '#f59e0b';
const GREEN = '#22c55e';
const BLUE = '#3b82f6';
const RED = '#ef4444';
const PURPLE = '#a855f7';

type StatusFilter = 'all' | 'assembling' | 'invited' | 'active' | 'placed' | 'dissolved';

const STATUS_PIPELINE: { key: StatusFilter; label: string; color: string; icon: string; description: string }[] = [
  { key: 'all', label: 'All', color: ACCENT, icon: '', description: '' },
  { key: 'assembling', label: 'Assembling', color: ACCENT, icon: 'tool', description: 'Building the group \u2014 add more renters' },
  { key: 'invited', label: 'Invited', color: BLUE, icon: 'send', description: 'Invites sent \u2014 waiting for responses' },
  { key: 'active', label: 'Active', color: GREEN, icon: 'check-circle', description: 'All accepted \u2014 ready to match with listing' },
  { key: 'placed', label: 'Placed', color: PURPLE, icon: 'award', description: 'Matched with apartment \u2014 placement fee earned' },
  { key: 'dissolved', label: 'Dissolved', color: '#666', icon: 'x-circle', description: 'Group disbanded' },
];

function statusColor(status: string): string {
  return STATUS_PIPELINE.find(s => s.key === status)?.color ?? '#666';
}

function statusIcon(status: string): string {
  return STATUS_PIPELINE.find(s => s.key === status)?.icon ?? 'help-circle';
}

function scoreColor(s: number): string {
  if (s >= 80) return GREEN;
  if (s >= 65) return ACCENT;
  if (s >= 50) return '#f97316';
  return RED;
}

export const AgentGroupsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();

  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, string>>({});
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [inviteSheetGroup, setInviteSheetGroup] = useState<AgentGroup | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Record<string, GroupJoinRequest[]>>({});

  const agentPlan = resolveEffectiveAgentPlan(user) as AgentPlan;
  const planLimits = getAgentPlanLimits(agentPlan);

  useFocusEffect(
    useCallback(() => {
      if (user) loadGroups();
    }, [user])
  );

  useEffect(() => {
    if (!user || !isSupabaseConfigured || shouldLoadMockData()) return;
    const channel = supabase
      .channel('agent-group-invites')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_group_invites',
      }, () => { loadGroups(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_join_requests',
      }, () => { fetchPendingRequests(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchPendingRequests = useCallback(async () => {
    if (!user || groups.length === 0) return;
    const discoverableIds = groups
      .filter(g => g.isDiscoverable && (g.groupStatus === 'assembling' || g.groupStatus === 'active'))
      .map(g => g.id);
    if (discoverableIds.length === 0) { setPendingRequests({}); return; }
    try {
      const result = await getAgentGroupJoinRequests(user.id, discoverableIds);
      setPendingRequests(result);
    } catch (e) {
      console.warn('[AgentGroups] Failed to fetch join requests:', e);
    }
  }, [user?.id, groups]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const result = await getAgentGroups(user.id);
      setGroups(result.groups);
      setIsStale(result.isStale);
    } catch (e) {
      console.warn('[AgentGroups] Load error:', e);
      setLoadError(true);
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
      try {
        const placement = await recordPlacement(user.id, group.id, group.targetListingId ?? '', planLimits.placementFeeCents);
        const chargeResult = await chargeAgentPlacementFee(user.id, placement.id, group.id, group.targetListingId ?? '');
        if (chargeResult.success) {
          await updateAgentGroupStatus(group.id, 'placed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setActionStates(prev => ({ ...prev, [group.id]: 'placed' }));
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showAlert({ title: 'Payment Issue', message: chargeResult.error ?? 'Placement fee could not be charged.' });
        }
      } catch (e: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert({ title: 'Error', message: e?.message || 'Failed to record placement.' });
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

  const handleSendInvites = (group: AgentGroup) => {
    if (!user) return;
    const eligible = group.members.filter(m => (m as any).acceptAgentOffers !== false);
    if (eligible.length < 2) {
      showAlert({ title: 'Not Enough', message: 'Not enough eligible renters.' });
      return;
    }
    setInviteSheetGroup(group);
    setInviteSheetVisible(true);
  };

  const handleInviteSheetSend = async (messages: Record<string, string>) => {
    if (!user || !inviteSheetGroup) return;
    const group = inviteSheetGroup;
    const eligible = group.members.filter(m => (m as any).acceptAgentOffers !== false);
    try {
      await updateAgentGroupStatus(group.id, 'invited');
      const firstMsg = Object.values(messages)[0] || '';
      await sendAgentInvites(
        user.id, user.name ?? '', group.id,
        eligible.map(r => r.id), group.targetListing || null, firstMsg,
        eligible.map(r => ({ id: r.id, name: r.name, photo: r.photos?.[0] }))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActionStates(prev => ({ ...prev, [group.id]: 'invited' }));
      setInviteSheetVisible(false);
      setInviteSheetGroup(null);
      showAlert({ title: 'Invites Sent', message: `Invites sent to ${eligible.length} renters.` });
      loadGroups();
    } catch (e) {
      showAlert({ title: 'Error', message: 'Failed to send invites.' });
    }
  };

  const handleRecreateGroup = async (group: AgentGroup) => {
    if (!user) return;
    try {
      const newGroup: AgentGroup = {
        id: `ag_${Date.now()}`,
        name: `${group.name} (v2)`,
        agentId: user.id,
        targetListingId: group.targetListingId,
        targetListing: group.targetListing,
        members: group.members,
        memberIds: group.memberIds,
        groupStatus: 'assembling',
        avgCompatibility: group.avgCompatibility,
        combinedBudgetMin: group.combinedBudgetMin,
        combinedBudgetMax: group.combinedBudgetMax,
        coversRent: group.coversRent,
        invites: [],
        createdAt: new Date().toISOString(),
      };
      await createAgentGroup(newGroup);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ title: 'Group Recreated', message: `"${newGroup.name}" saved to Assembling.` });
      loadGroups();
    } catch (e) {
      showAlert({ title: 'Error', message: 'Failed to recreate group.' });
    }
  };

  const handleToggleDiscoverable = async (groupId: string, discoverable: boolean) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ is_discoverable: discoverable })
        .eq('id', groupId)
        .eq('created_by_agent', user?.id);
      if (error) throw error;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      loadGroups();
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to update group visibility. Please try again.' });
    }
  };

  const handleApproveRequest = async (requestId: string, groupId: string, userId: string) => {
    if (!user) return;
    try {
      await approveAgentGroupRequest(user.id, requestId, groupId, userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadGroups();
      fetchPendingRequests();
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to approve request.' });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!user) return;
    try {
      await declineAgentGroupRequest(user.id, requestId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      fetchPendingRequests();
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to decline request.' });
    }
  };

  const filteredGroups = useMemo(() => {
    if (statusFilter === 'all') return groups;
    return groups.filter(g => g.groupStatus === statusFilter);
  }, [groups, statusFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: groups.length };
    for (const s of STATUS_PIPELINE) {
      if (s.key !== 'all') counts[s.key] = groups.filter(g => g.groupStatus === s.key).length;
    }
    return counts;
  }, [groups]);

  const getInviteStats = (group: AgentGroup) => {
    const invites = group.invites || [];
    const accepted = invites.filter(i => i.status === 'accepted').length;
    const declined = invites.filter(i => i.status === 'declined').length;
    const pending = invites.filter(i => i.status === 'pending').length;
    const total = group.members?.length || invites.length;
    return { accepted, declined, pending, total };
  };

  const renderPipelineBar = () => {
    const activeStatuses = STATUS_PIPELINE.filter(s => s.key !== 'all' && s.key !== 'dissolved');
    const activeCounts = activeStatuses.map(s => tabCounts[s.key] || 0);
    const totalActive = activeCounts.reduce((a, b) => a + b, 0);
    if (totalActive === 0) return null;

    return (
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', gap: 4, height: 4, borderRadius: 2, overflow: 'hidden' }}>
          {activeStatuses.map((s, i) => {
            if (activeCounts[i] === 0) return null;
            return <View key={s.key} style={{ flex: activeCounts[i], backgroundColor: s.color, borderRadius: 2 }} />;
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 6 }}>
          {activeStatuses.map(s => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              <Text style={{ fontSize: 10, color: '#888' }}>{tabCounts[s.key] || 0} {s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderGroupCard = ({ item }: { item: AgentGroup }) => {
    const color = statusColor(item.groupStatus);
    const icon = statusIcon(item.groupStatus);
    const isExpanded = expandedGroup === item.id;
    const actionState = actionStates[item.id];
    const inviteStats = getInviteStats(item);

    return (
      <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: color }]}>
        <Pressable
          onPress={() => setExpandedGroup(isExpanded ? null : item.id)}
          style={{ padding: 16, paddingBottom: 0 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name={icon as any} size={13} color={color} />
              <Text style={{ fontSize: 12, fontWeight: '700', color, textTransform: 'capitalize' }}>{item.groupStatus}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.avgCompatibility > 0 ? (
                <Text style={{ fontSize: 13, fontWeight: '700', color: scoreColor(item.avgCompatibility) }}>{item.avgCompatibility}%</Text>
              ) : null}
              <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
            </View>
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 10 }}>{item.name}</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {item.members.slice(0, 5).map(m => {
              const invite = item.invites?.find(inv => inv.renterId === m.id);
              const accepted = invite?.status === 'accepted';
              const declined = invite?.status === 'declined';
              return (
                <View key={m.id} style={st.memberPill}>
                  <View style={{ position: 'relative' }}>
                    {m.photos?.[0] ? (
                      <Image source={{ uri: m.photos[0] }} style={st.memberAvatar} />
                    ) : (
                      <View style={[st.memberAvatar, { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="user" size={11} color="#666" />
                      </View>
                    )}
                    {item.groupStatus === 'invited' && invite ? (
                      <View style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather
                          name={accepted ? 'check-circle' : declined ? 'x-circle' : 'clock'}
                          size={9}
                          color={accepted ? GREEN : declined ? RED : ACCENT}
                        />
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: '#ccc' }}>{m.name.split(' ')[0]}</Text>
                </View>
              );
            })}
            {item.groupStatus === 'assembling' ? (
              <Pressable
                style={st.addMemberBtn}
                onPress={() => {
                  const parent = navigation.getParent();
                  if (parent) parent.navigate('BrowseRenters', { addToGroupId: item.id });
                  else navigation.navigate('BrowseRenters' as never, { addToGroupId: item.id });
                }}
              >
                <Feather name="user-plus" size={12} color="#888" />
                <Text style={{ fontSize: 12, color: '#888' }}>Add</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, color: '#888' }}>Budget:</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: GREEN }}>
              ${item.combinedBudgetMin.toLocaleString()}-${item.combinedBudgetMax.toLocaleString()}/mo
            </Text>
          </View>

          {item.targetListing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, marginTop: -6 }}>
              <Feather name="home" size={13} color="#888" />
              <Text style={{ fontSize: 12, color: '#aaa' }}>{item.targetListing.title}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>${item.targetListing.price?.toLocaleString()}/mo</Text>
            </View>
          ) : null}
        </Pressable>

        {item.groupStatus === 'placed' && planLimits.placementFeeCents > 0 ? (
          <View style={st.placementBanner}>
            <Feather name="award" size={14} color={PURPLE} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: PURPLE }}>
              Placement fee: ${(planLimits.placementFeeCents / 100).toFixed(2)}
            </Text>
          </View>
        ) : null}

        {item.groupStatus === 'dissolved' && (item as any).dissolvedReason ? (
          <View style={st.dissolvedBanner}>
            <Feather name="x-circle" size={14} color={RED} />
            <Text style={{ fontSize: 12, color: RED }}>{(item as any).dissolvedReason}</Text>
          </View>
        ) : null}

        {item.groupStatus === 'invited' ? (
          <View style={st.inviteStatusBanner}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={{ fontSize: 12, color: BLUE }}>{inviteStats.accepted}/{inviteStats.total} accepted</Text>
              {inviteStats.pending > 0 ? <Text style={{ fontSize: 12, color: ACCENT }}>{inviteStats.pending} pending</Text> : null}
              {inviteStats.declined > 0 ? <Text style={{ fontSize: 12, color: RED }}>{inviteStats.declined} declined</Text> : null}
            </View>
          </View>
        ) : null}

        {(item.groupStatus === 'assembling' || item.groupStatus === 'active') ? (
          <View style={st.discoverableRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Open to Renters</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Show in renter group browser</Text>
            </View>
            <Switch
              value={item.isDiscoverable ?? false}
              onValueChange={(value) => handleToggleDiscoverable(item.id, value)}
              trackColor={{ false: '#333', true: '#7B5EA7' }}
              thumbColor={item.isDiscoverable ? '#fff' : '#666'}
            />
          </View>
        ) : null}

        {item.isDiscoverable && pendingRequests[item.id]?.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              Join Requests ({pendingRequests[item.id].length})
            </Text>
            {pendingRequests[item.id].map((request: GroupJoinRequest) => (
              <View key={request.id} style={st.joinRequestCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {(request.requester as any)?.avatar_url ? (
                    <Image
                      source={{ uri: (request.requester as any).avatar_url }}
                      style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
                    />
                  ) : (
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Feather name="user" size={14} color="#666" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                      {(request.requester as any)?.full_name || 'Renter'}
                    </Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>
                      {(request.requester as any)?.age ? `${(request.requester as any).age}` : ''}
                      {(request.requester as any)?.gender ? ` · ${(request.requester as any).gender}` : ''}
                    </Text>
                  </View>
                </View>
                {request.requester_message ? (
                  <Text style={{ color: '#aaa', fontSize: 12, marginTop: 6, fontStyle: 'italic' }} numberOfLines={2}>
                    "{request.requester_message}"
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => handleApproveRequest(request.id, request.agent_group_id!, request.requester_id)}
                    style={{ backgroundColor: '#7B5EA7', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, flex: 1, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeclineRequest(request.id)}
                    style={{ backgroundColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, flex: 1, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={st.actionRow}>
          {item.groupStatus === 'assembling' ? (
            <>
              <Pressable
                style={[st.primaryBtn, actionState === 'invited' ? { backgroundColor: '#1a3a1a' } : { backgroundColor: ACCENT }]}
                onPress={() => handleSendInvites(item)}
                disabled={actionState === 'invited' || actionState === 'sending'}
              >
                {actionState === 'sending' ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Feather name={actionState === 'invited' ? 'check-circle' : 'send'} size={15} color={actionState === 'invited' ? GREEN : '#000'} />
                    <Text style={[st.primaryBtnText, actionState === 'invited' ? { color: GREEN } : { color: '#000' }]}>
                      {actionState === 'invited' ? 'Invites Sent' : 'Send Invites'}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={st.secondaryBtn}
                onPress={() => navigation.navigate('RenterCompatibility', {
                  renters: item.members,
                  listingId: item.targetListingId,
                  listing: item.targetListing,
                })}
              >
                <Feather name="grid" size={14} color="#aaa" />
                <Text style={st.secondaryBtnText}>Matrix</Text>
              </Pressable>
              <Pressable style={st.iconBtn} onPress={() => navigation.navigate('AgentGroupDetail', { groupId: item.id, group: item })}>
                <Feather name="more-horizontal" size={16} color="#666" />
              </Pressable>
            </>
          ) : null}

          {item.groupStatus === 'invited' ? (
            <>
              <Pressable
                style={[st.primaryBtn, { backgroundColor: BLUE }]}
                onPress={() => navigation.navigate('Messages', { highlightGroupId: item.id })}
              >
                <Feather name="message-circle" size={15} color="#fff" />
                <Text style={[st.primaryBtnText, { color: '#fff' }]}>Message All</Text>
              </Pressable>
              <Pressable style={st.secondaryBtn} onPress={() => handleSendInvites(item)}>
                <Feather name="send" size={14} color="#aaa" />
                <Text style={st.secondaryBtnText}>Resend</Text>
              </Pressable>
              <Pressable style={st.iconBtn} onPress={() => navigation.navigate('AgentGroupDetail', { groupId: item.id, group: item })}>
                <Feather name="more-horizontal" size={16} color="#666" />
              </Pressable>
            </>
          ) : null}

          {item.groupStatus === 'active' ? (
            <>
              <Pressable
                style={[st.primaryBtn, actionState === 'placed' ? { backgroundColor: 'rgba(168,85,247,0.15)' } : { backgroundColor: GREEN }]}
                onPress={() => handleMarkPlaced(item)}
                disabled={actionState === 'placed'}
              >
                <Feather name={actionState === 'placed' ? 'award' : 'check-circle'} size={15} color={actionState === 'placed' ? PURPLE : '#000'} />
                <Text style={[st.primaryBtnText, actionState === 'placed' ? { color: PURPLE } : { color: '#000' }]}>
                  {actionState === 'placed' ? 'Placed!' : 'Mark as Placed'}
                </Text>
              </Pressable>
              <Pressable
                style={st.secondaryBtn}
                onPress={() => navigation.navigate('Messages', { highlightGroupId: item.id })}
              >
                <Feather name="message-circle" size={14} color="#aaa" />
                <Text style={st.secondaryBtnText}>Message</Text>
              </Pressable>
              <Pressable style={st.iconBtn} onPress={() => navigation.navigate('AgentGroupDetail', { groupId: item.id, group: item })}>
                <Feather name="more-horizontal" size={16} color="#666" />
              </Pressable>
            </>
          ) : null}

          {item.groupStatus === 'placed' ? (
            <>
              <Pressable
                style={[st.secondaryBtn, { flex: 1 }]}
                onPress={() => navigation.navigate('Messages', { highlightGroupId: item.id })}
              >
                <Feather name="message-circle" size={15} color="#ccc" />
                <Text style={[st.secondaryBtnText, { color: '#ccc', fontWeight: '600' }]}>Message Group</Text>
              </Pressable>
              <Pressable style={st.secondaryBtn} onPress={() => navigation.navigate('AgentGroupDetail', { groupId: item.id, group: item })}>
                <Feather name="copy" size={14} color="#aaa" />
                <Text style={st.secondaryBtnText}>Duplicate</Text>
              </Pressable>
            </>
          ) : null}

          {item.groupStatus === 'dissolved' ? (
            <>
              <Pressable
                style={[st.primaryBtn, { flex: 1, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: ACCENT + '40' }]}
                onPress={() => handleRecreateGroup(item)}
              >
                <Feather name="copy" size={15} color={ACCENT} />
                <Text style={[st.primaryBtnText, { color: ACCENT }]}>Recreate Group</Text>
              </Pressable>
              <Pressable
                style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => showAlert({ title: 'Deleted', message: 'Group record removed.' })}
              >
                <Feather name="trash-2" size={14} color={RED} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: RED }}>Delete</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {isExpanded ? (
          <View style={st.expandedPanel}>
            <Text style={st.sectionLabel}>MEMBERS</Text>
            {item.members.map(m => {
              const invite = item.invites?.find(inv => inv.renterId === m.id);
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {m.photos?.[0] ? (
                    <Image source={{ uri: m.photos[0] }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="user" size={14} color="#666" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{m.name}</Text>
                    <Text style={{ fontSize: 11, color: GREEN }}>
                      ${(m.budgetMin ?? 0).toLocaleString()} - ${(m.budgetMax ?? 0).toLocaleString()}/mo
                    </Text>
                  </View>
                  {item.groupStatus === 'invited' && invite ? (
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                      backgroundColor: invite.status === 'accepted' ? 'rgba(34,197,94,0.1)' : invite.status === 'declined' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    }}>
                      <Text style={{
                        fontSize: 10, fontWeight: '600',
                        color: invite.status === 'accepted' ? GREEN : invite.status === 'declined' ? RED : ACCENT,
                      }}>
                        {invite.status === 'accepted' ? 'Accepted' : invite.status === 'declined' ? 'Declined' : 'Pending'}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={{ padding: 4 }}
                    onPress={() => navigation.navigate('Chat', {
                      conversationId: `agent-${user?.id}-${m.id}`,
                      otherUser: { id: m.id, name: m.name, photos: m.photos },
                    })}
                  >
                    <Feather name="message-circle" size={14} color="#666" />
                  </Pressable>
                </View>
              );
            })}

            <Text style={[st.sectionLabel, { marginTop: 14 }]}>TIMELINE</Text>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT }} />
                <Text style={{ fontSize: 12, color: '#aaa' }}>Created {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'recently'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                <Text style={{ fontSize: 12, color: '#aaa' }}>Status: {item.groupStatus}</Text>
              </View>
            </View>

            <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={st.expandedAction}
                onPress={() => navigation.navigate('AgentGroupDetail', { groupId: item.id, group: item })}
              >
                <Feather name="edit-3" size={13} color="#aaa" />
                <Text style={st.expandedActionText}>Edit Name</Text>
              </Pressable>
              <Pressable
                style={st.expandedAction}
                onPress={() => navigation.navigate('RenterCompatibility', {
                  renters: item.members,
                  listingId: item.targetListingId,
                  listing: item.targetListing,
                })}
              >
                <Feather name="grid" size={13} color="#aaa" />
                <Text style={st.expandedActionText}>View Matrix</Text>
              </Pressable>
              {item.groupStatus !== 'placed' && item.groupStatus !== 'dissolved' ? (
                <Pressable
                  style={[st.expandedAction, { backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }]}
                  onPress={() => handleDissolve(item)}
                >
                  <Feather name="x-circle" size={13} color={RED} />
                  <Text style={[st.expandedActionText, { color: RED }]}>Dissolve</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderEmptyForStatus = () => {
    const messages: Record<string, string> = {
      assembling: "Start building a group from the Renters tab \u2014 tap 'Add to Group' on renter cards.",
      invited: 'Send invites to an assembling group to move them here.',
      active: 'Groups move here when all invited renters accept.',
      placed: 'Mark an active group as placed once they\'ve signed a lease.',
      dissolved: 'Dissolved groups appear here for your records.',
    };
    return (
      <View style={st.emptyState}>
        <Feather name="users" size={48} color="#333" />
        <Text style={st.emptyTitle}>No {statusFilter} groups</Text>
        <Text style={st.emptyDesc}>{messages[statusFilter] || 'No groups match this filter.'}</Text>
      </View>
    );
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Text style={st.title}>My Groups</Text>
        <Pressable
          style={st.newGroupBtn}
          onPress={() => {
            const parent = navigation.getParent();
            if (parent) parent.navigate('BrowseRenters');
            else navigation.navigate('BrowseRenters' as never);
          }}
        >
          <Feather name="plus" size={16} color="#000" />
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>New</Text>
        </Pressable>
      </View>

      {renderPipelineBar()}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, paddingLeft: 20 }} contentContainerStyle={{ paddingRight: 20, gap: 6 }}>
        {STATUS_PIPELINE.map(s => {
          const isActive = statusFilter === s.key;
          const count = tabCounts[s.key] || 0;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStatusFilter(s.key)}
              style={[
                st.filterChip,
                isActive ? { backgroundColor: s.color + '20', borderColor: s.color + '40' } : null,
              ]}
            >
              <Text style={[st.filterText, isActive ? { color: s.color } : null]}>{s.label}</Text>
              {count > 0 ? (
                <View style={[st.filterBadge, isActive ? { backgroundColor: s.color + '30' } : null]}>
                  <Text style={[st.filterBadgeText, isActive ? { color: s.color } : null]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {statusFilter !== 'all' ? (
        <View style={st.statusHint}>
          <Feather name={statusIcon(statusFilter) as any} size={14} color={statusColor(statusFilter)} />
          <Text style={{ fontSize: 12, color: '#888' }}>
            {STATUS_PIPELINE.find(s => s.key === statusFilter)?.description}
          </Text>
        </View>
      ) : null}

      {isStale ? (
        <View style={{ backgroundColor: '#2a2200', padding: 8, marginHorizontal: 20, borderRadius: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="clock" size={14} color={ACCENT} />
          <Text style={{ color: ACCENT, fontSize: 12 }}>Using cached data</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 40 }} />
      ) : loadError && groups.length === 0 ? (
        <View style={st.emptyState}>
          <Feather name="alert-circle" size={48} color="#999" />
          <Text style={st.emptyTitle}>Failed to load groups</Text>
          <Pressable onPress={() => loadGroups()}>
            <Text style={{ color: ACCENT, marginTop: 12, fontWeight: '600' }}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : filteredGroups.length === 0 ? (
        statusFilter !== 'all' ? renderEmptyForStatus() : (
          <View style={st.emptyState}>
            <Feather name="users" size={48} color="#444" />
            <Text style={st.emptyTitle}>No Groups Yet</Text>
            <Text style={st.emptyDesc}>Browse renters, shortlist your top picks, and build your first group.</Text>
            <Pressable
              style={st.startBtn}
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) parent.navigate('BrowseRenters');
                else navigation.navigate('BrowseRenters' as never);
              }}
            >
              <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>Browse Renters</Text>
            </Pressable>
          </View>
        )
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={item => item.id}
          renderItem={renderGroupCard}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <InvitePreviewSheet
        visible={inviteSheetVisible}
        onClose={() => { setInviteSheetVisible(false); setInviteSheetGroup(null); }}
        onSend={handleInviteSheetSend}
        members={(inviteSheetGroup?.members || []) as AgentRenter[]}
        groupName={inviteSheetGroup?.name || ''}
        listing={inviteSheetGroup?.targetListing ? { id: inviteSheetGroup.targetListing.id, title: inviteSheetGroup.targetListing.title, price: inviteSheetGroup.targetListing.price, bedrooms: inviteSheetGroup.targetListing.bedrooms, neighborhood: inviteSheetGroup.targetListing.neighborhood } : null}
        agentName={user?.name || 'Your Agent'}
      />
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  newGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },

  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#2a2a2a' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#888' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: '#2a2a2a' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#666' },

  statusHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 10, padding: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: CARD_BG, borderWidth: 1, borderColor: '#222' },

  card: { backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: '#222', marginBottom: 14, overflow: 'hidden' },

  memberPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  memberAvatar: { width: 26, height: 26, borderRadius: 13 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#444', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },

  placementBanner: { marginHorizontal: 16, marginBottom: 14, padding: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(168,85,247,0.1)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dissolvedBanner: { marginHorizontal: 16, marginBottom: 14, padding: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteStatusBanner: { marginHorizontal: 16, marginBottom: 14, padding: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' },

  discoverableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 14, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#1E1E1E', borderRadius: 12 },
  joinRequestCard: { backgroundColor: '#1E1E1E', borderRadius: 10, padding: 12, marginBottom: 6 },

  actionRow: { paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  primaryBtnText: { fontSize: 13, fontWeight: '700' },
  secondaryBtn: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: '#aaa' },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#333' },

  expandedPanel: { borderTopWidth: 1, borderTopColor: '#222', padding: 14, paddingHorizontal: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  expandedAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, backgroundColor: SURFACE, borderWidth: 1, borderColor: '#333' },
  expandedActionText: { fontSize: 12, fontWeight: '600', color: '#aaa' },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyDesc: { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  startBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 },
});
