import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  AgentGroup,
  AgentRenter,
  getGroupInviteStatuses,
  analyzeGroupDynamics,
  calculatePairCompatibility,
  calculatePairMatrix,
  scoreGroupForListing,
  removeMemberFromGroup,
  recordPlacement,
  updateAgentGroupStatus,
  chargeAgentPlacementFee,
} from '../../services/agentMatchmakerService';
import { resolveEffectiveAgentPlan } from '../../utils/planResolver';
import { getAgentPlanLimits } from '../../constants/planLimits';
import { supabase } from '../../lib/supabase';
import { shouldLoadMockData } from '../../utils/dataUtils';

const ACCENT = '#E53935';
const GREEN = '#4CAF50';
const YELLOW = '#FFB300';
const RED = '#E53935';
const CARD_BG = '#1E1E1E';
const SURFACE = '#2A2A2A';

export const AgentGroupDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alert: showAlert, confirm } = useConfirm();

  const groupParam: AgentGroup = route.params?.group;
  const groupId: string = route.params?.groupId || groupParam?.id;

  const [group, setGroup] = useState<AgentGroup>(groupParam);
  const [inviteStatuses, setInviteStatuses] = useState<{
    renterId: string; renterName: string; avatarUrl?: string;
    status: 'pending' | 'accepted' | 'declined'; respondedAt: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamics, setDynamics] = useState<ReturnType<typeof analyzeGroupDynamics> | null>(null);
  const [listingScore, setListingScore] = useState<ReturnType<typeof scoreGroupForListing> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = await getGroupInviteStatuses(groupId);
      setInviteStatuses(statuses);

      if (group?.members?.length >= 2) {
        setDynamics(analyzeGroupDynamics(group.members));
        if (group.targetListing) {
          const matrix = calculatePairMatrix(group.members);
          setListingScore(scoreGroupForListing(group.members, group.targetListing as any, matrix));
        }
      }
    } catch (e) {
      console.warn('[GroupDetail] Load error:', e);
    }
    setLoading(false);
  }, [groupId, group?.members]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!groupId || shouldLoadMockData()) return;
    const channel = supabase
      .channel(`group-invites-${groupId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_group_invites',
        filter: `group_id=eq.${groupId}`,
      }, (payload: any) => {
        setInviteStatuses(prev =>
          prev.map(inv =>
            inv.renterId === payload.new.renter_id
              ? { ...inv, status: payload.new.status, respondedAt: payload.new.responded_at }
              : inv
          )
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'assembling': return YELLOW;
      case 'invited': return '#42A5F5';
      case 'active': return GREEN;
      case 'placed': return '#AB47BC';
      case 'dissolved': return '#757575';
      default: return '#757575';
    }
  };

  const inviteStatusColor = (s: string) => {
    switch (s) {
      case 'accepted': return GREEN;
      case 'declined': return RED;
      default: return YELLOW;
    }
  };

  const handleRemoveMember = async (renterId: string, name: string) => {
    const ok = await confirm({ title: 'Remove Member', message: `Remove ${name} from this group?` });
    if (!ok) return;
    const result = await removeMemberFromGroup(groupId, renterId);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGroup(prev => ({
        ...prev,
        members: prev.members.filter(m => m.id !== renterId),
        memberIds: prev.memberIds.filter(id => id !== renterId),
      }));
      setInviteStatuses(prev => prev.filter(inv => inv.renterId !== renterId));
    } else {
      showAlert({ title: 'Error', message: result.error || 'Could not remove member.' });
    }
  };

  const handleMarkPlaced = async () => {
    if (!user || !group) return;
    const plan = resolveEffectiveAgentPlan(user);
    const planLimits = getAgentPlanLimits(plan);
    const feeDisplay = `$${(planLimits.placementFeeCents / 100).toFixed(2)}`;
    const ok = await confirm({ title: 'Confirm Placement', message: `A placement fee of ${feeDisplay} will be charged.` });
    if (!ok) return;
    try {
      const placement = await recordPlacement(user.id, groupId, group.targetListingId ?? '', planLimits.placementFeeCents);
      const charge = await chargeAgentPlacementFee(user.id, placement.id, groupId, group.targetListingId ?? '');
      if (charge.success) {
        await updateAgentGroupStatus(groupId, 'placed');
        setGroup(prev => ({ ...prev, groupStatus: 'placed' }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showAlert({ title: 'Payment Issue', message: charge.error ?? 'Could not charge placement fee.' });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to record placement.' });
    }
  };

  const handleDissolve = async () => {
    const ok = await confirm({ title: 'Dissolve Group', message: 'This action cannot be undone. Continue?' });
    if (!ok) return;
    await updateAgentGroupStatus(groupId, 'dissolved');
    setGroup(prev => ({ ...prev, groupStatus: 'dissolved' }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleMessageAll = () => {
    navigation.navigate('Chat', { conversationId: `agent-group-${groupId}`, otherUser: { id: groupId, name: group.name } });
  };

  const canModify = group?.groupStatus === 'assembling' || group?.groupStatus === 'invited';

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Group not found</Text>
      </View>
    );
  }

  const acceptedCount = inviteStatuses.filter(i => i.status === 'accepted').length;
  const totalInvites = inviteStatuses.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Group Detail</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.groupName} numberOfLines={2}>{group.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(group.groupStatus) + '22', borderColor: statusColor(group.groupStatus) }]}>
              <Text style={[styles.statusText, { color: statusColor(group.groupStatus) }]}>
                {group.groupStatus.charAt(0).toUpperCase() + group.groupStatus.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.subText}>Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'N/A'}</Text>

          {group.targetListing ? (
            <Pressable style={styles.listingCard} onPress={() => navigation.navigate('HostListingDetail', { listingId: group.targetListingId })}>
              <Feather name="home" size={16} color={ACCENT} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.listingTitle} numberOfLines={1}>{(group.targetListing as any).title}</Text>
                <Text style={styles.listingPrice}>${(group.targetListing as any).price?.toLocaleString()}/mo</Text>
              </View>
              <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Members ({group.members.length})</Text>
        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginVertical: 20 }} />
        ) : (
          group.members.map((member, idx) => {
            const invite = inviteStatuses.find(i => i.renterId === member.id);
            return (
              <View key={member.id} style={styles.memberRow}>
                <Image source={{ uri: member.photos?.[0] || 'https://via.placeholder.com/40' }} style={styles.avatar} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.age ? <Text style={styles.memberAge}>, {member.age}</Text> : null}
                  </View>
                  <Text style={styles.memberDetail}>
                    {member.budgetMin || member.budgetMax ? `$${member.budgetMin ?? '?'}-$${member.budgetMax ?? '?'}/mo` : 'Budget N/A'}
                    {member.moveInDate ? ` · ${new Date(member.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </Text>
                  {group.members.length > 1 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                      {group.members.filter(m => m.id !== member.id).map(other => {
                        const pairScore = calculatePairCompatibility(member, other);
                        const color = pairScore >= 70 ? GREEN : pairScore >= 50 ? YELLOW : RED;
                        return (
                          <View key={other.id} style={[styles.pairBadge, { borderColor: color }]}>
                            <Text style={[styles.pairText, { color }]}>{other.name.split(' ')[0]}: {pairScore}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {invite ? (
                    <View style={[styles.inviteBadge, { backgroundColor: inviteStatusColor(invite.status) + '22' }]}>
                      <Text style={[styles.inviteBadgeText, { color: inviteStatusColor(invite.status) }]}>
                        {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <Pressable onPress={() => navigation.navigate('Chat', { conversationId: `agent-renter-${member.id}`, otherUser: { id: member.id, name: member.name } })} hitSlop={8}>
                      <Feather name="message-circle" size={18} color="rgba(255,255,255,0.5)" />
                    </Pressable>
                    {canModify ? (
                      <Pressable onPress={() => handleRemoveMember(member.id, member.name)} hitSlop={8} style={{ marginLeft: 16 }}>
                        <Feather name="x" size={18} color={RED} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}

        {totalInvites > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Invite Responses</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${totalInvites > 0 ? (acceptedCount / totalInvites) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.subText}>{acceptedCount}/{totalInvites} accepted</Text>
          </View>
        ) : null}

        {dynamics ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Group Dynamics</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.metricValue, { color: dynamics.avgScore >= 70 ? GREEN : dynamics.avgScore >= 50 ? YELLOW : RED }]}>
                  {dynamics.avgScore}%
                </Text>
                <Text style={styles.metricLabel}>Avg Score</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.metricValue, { color: dynamics.minPairScore >= 60 ? GREEN : dynamics.minPairScore >= 40 ? YELLOW : RED }]}>
                  {dynamics.minPairScore}%
                </Text>
                <Text style={styles.metricLabel}>Min Pair</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.metricValue, { color: group.coversRent ? GREEN : RED }]}>
                  {group.coversRent ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.metricLabel}>Covers Rent</Text>
              </View>
            </View>
            <Text style={styles.subText}>
              Budget: ${group.combinedBudgetMin?.toLocaleString() ?? 0} - ${group.combinedBudgetMax?.toLocaleString() ?? 0}/mo
            </Text>
            {dynamics.conflicts.map((c, i) => (
              <View key={i} style={styles.conflictRow}>
                <Feather name="alert-triangle" size={14} color={YELLOW} />
                <Text style={styles.conflictText}>{c}</Text>
              </View>
            ))}
            {dynamics.strengths.map((s, i) => (
              <View key={i} style={styles.strengthRow}>
                <Feather name="check-circle" size={14} color={GREEN} />
                <Text style={styles.strengthText}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {listingScore ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Listing Fit: {listingScore.total}/100</Text>
            {[
              { label: 'Compatibility', value: listingScore.compatibility },
              { label: 'Budget Fit', value: listingScore.budgetFit },
              { label: 'Location Fit', value: listingScore.locationFit },
              { label: 'Timeline Fit', value: listingScore.timelineFit },
            ].map(item => (
              <View key={item.label} style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{item.label}</Text>
                <View style={styles.scoreBg}>
                  <View style={[styles.scoreFill, { width: `${item.value}%`, backgroundColor: item.value >= 70 ? GREEN : item.value >= 50 ? YELLOW : RED }]} />
                </View>
                <Text style={styles.scoreValue}>{item.value}%</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Timeline</Text>
          <View style={styles.timelineItem}>
            <Feather name="plus-circle" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.timelineText}>Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'N/A'}</Text>
          </View>
          {totalInvites > 0 ? (
            <View style={styles.timelineItem}>
              <Feather name="send" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.timelineText}>Invites sent to {totalInvites} renters</Text>
            </View>
          ) : null}
          {acceptedCount > 0 ? (
            <View style={styles.timelineItem}>
              <Feather name="check" size={14} color={GREEN} />
              <Text style={styles.timelineText}>{acceptedCount}/{totalInvites} accepted</Text>
            </View>
          ) : null}
          {group.groupStatus === 'placed' ? (
            <View style={styles.timelineItem}>
              <Feather name="award" size={14} color="#AB47BC" />
              <Text style={styles.timelineText}>Placed successfully</Text>
            </View>
          ) : null}
          {group.groupStatus === 'dissolved' ? (
            <View style={styles.timelineItem}>
              <Feather name="x-circle" size={14} color="#757575" />
              <Text style={styles.timelineText}>Dissolved</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {group.groupStatus === 'assembling' ? (
          <>
            <Pressable style={[styles.actionBtn, { backgroundColor: ACCENT }]}
              onPress={() => navigation.navigate('AgentGroupBuilder', { preselectedIds: group.memberIds, listingId: group.targetListingId })}>
              <Text style={styles.actionBtnText}>Edit Group</Text>
            </Pressable>
          </>
        ) : group.groupStatus === 'invited' ? (
          <>
            <Pressable style={[styles.actionBtn, { backgroundColor: SURFACE }]} onPress={handleDissolve}>
              <Text style={[styles.actionBtnText, { color: RED }]}>Dissolve</Text>
            </Pressable>
          </>
        ) : group.groupStatus === 'active' ? (
          <>
            <Pressable style={[styles.actionBtn, { backgroundColor: GREEN }]} onPress={handleMarkPlaced}>
              <Feather name="check" size={16} color="#FFF" />
              <Text style={styles.actionBtnText}>Mark Placed</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#42A5F5', marginLeft: 10 }]} onPress={handleMessageAll}>
              <Feather name="message-circle" size={16} color="#FFF" />
              <Text style={styles.actionBtnText}>Message All</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: SURFACE, marginLeft: 10 }]} onPress={handleDissolve}>
              <Feather name="x" size={16} color={RED} />
            </Pressable>
          </>
        ) : group.groupStatus === 'placed' ? (
          <View style={[styles.actionBtn, { backgroundColor: '#AB47BC22' }]}>
            <Feather name="award" size={16} color="#AB47BC" />
            <Text style={[styles.actionBtnText, { color: '#AB47BC' }]}>Placed</Text>
          </View>
        ) : (
          <View style={[styles.actionBtn, { backgroundColor: '#75757522' }]}>
            <Text style={[styles.actionBtnText, { color: '#757575' }]}>Dissolved</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center' },
  card: { backgroundColor: CARD_BG, borderRadius: 14, padding: 16, marginTop: 12 },
  groupName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1, marginRight: 10 },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  subText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 },
  listingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 10, padding: 12, marginTop: 12 },
  listingTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  listingPrice: { color: ACCENT, fontSize: 13, fontWeight: '600', marginTop: 2 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginTop: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  memberName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  memberAge: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  memberDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  pairBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6, marginTop: 2 },
  pairText: { fontSize: 10, fontWeight: '600' },
  inviteBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  inviteBadgeText: { fontSize: 11, fontWeight: '600' },
  cardLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: GREEN, borderRadius: 3 },
  metricValue: { fontSize: 22, fontWeight: '700' },
  metricLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  conflictRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  conflictText: { color: YELLOW, fontSize: 12, marginLeft: 8, flex: 1 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  strengthText: { color: GREEN, fontSize: 12, marginLeft: 8, flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  scoreLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, width: 90 },
  scoreBg: { flex: 1, height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 },
  scoreFill: { height: 6, borderRadius: 3 },
  scoreValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', width: 35, textAlign: 'right' },
  timelineItem: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  timelineText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginLeft: 10 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 14, borderRadius: 12, gap: 6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 60, fontSize: 16 },
});
