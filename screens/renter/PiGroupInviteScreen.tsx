import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { PiAutoGroup, PiAutoGroupMember } from '../../types/models';
import {
  getPendingGroupInvite,
  acceptGroupInvite,
  declineGroupInvite,
  getAutoGroupMembers,
  convertToRealGroup,
} from '../../services/piAutoMatchService';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GroupsStackParamList } from '../../navigation/GroupsStackNavigator';

type ScreenNavProp = NativeStackNavigationProp<GroupsStackParamList, 'PiGroupInvite'>;

interface MemberProfile {
  userId: string;
  name: string;
  age?: number;
  occupation?: string;
  photo?: string;
  compatibilityScore?: number;
  piReason?: string;
  neighborhoods?: string[];
}

function getTimeRemaining(expiresAt?: string): { hours: number; minutes: number; isUrgent: boolean; expired: boolean } {
  if (!expiresAt) return { hours: 48, minutes: 0, isUrgent: false, expired: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, isUrgent: true, expired: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes, isUrgent: hours < 12, expired: false };
}

function getCompatibilityColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#fbbf24';
  return '#f87171';
}

export const PiGroupInviteScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ScreenNavProp>();
  const route = useRoute<RouteProp<GroupsStackParamList, 'PiGroupInvite'>>();

  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [invite, setInvite] = useState<PiAutoGroupMember | null>(null);
  const [group, setGroup] = useState<PiAutoGroup | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [allMembers, setAllMembers] = useState<PiAutoGroupMember[]>([]);
  const [responded, setResponded] = useState(false);
  const [responseAction, setResponseAction] = useState<'accepted' | 'declined' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState({ hours: 48, minutes: 0, isUrgent: false, expired: false });
  const [extendedTime, setExtendedTime] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInvite = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const groupId = route.params?.groupId;

      let pendingInvite: PiAutoGroupMember | null = null;
      if (groupId) {
        const { data } = await supabase
          .from('pi_auto_group_members')
          .select('*')
          .eq('user_id', user.id)
          .eq('group_id', groupId)
          .eq('status', 'pending')
          .limit(1)
          .single();
        pendingInvite = (data as PiAutoGroupMember) ?? null;
      }

      if (!pendingInvite) {
        pendingInvite = await getPendingGroupInvite(user.id);
      }

      if (!pendingInvite) {
        setInvite(null);
        setLoading(false);
        return;
      }

      setInvite(pendingInvite);

      const { data: groupData } = await supabase
        .from('pi_auto_groups')
        .select('*')
        .eq('id', pendingInvite.group_id)
        .single();

      if (groupData) {
        const groupRecord = groupData as PiAutoGroup;
        setGroup(groupRecord);
        const deadline = groupRecord.acceptance_deadline ?? groupRecord.expires_at;
        setTimeRemaining(getTimeRemaining(deadline));
        if (groupRecord.deadline_extended) {
          setExtendedTime(true);
        }
      }

      const memberList = await getAutoGroupMembers(pendingInvite.group_id);
      setAllMembers(memberList);
      const otherMembers = memberList.filter(
        m => m.user_id !== user.id && (m.status === 'pending' || m.status === 'accepted')
      );

      const memberIds = otherMembers.map(m => m.user_id);
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, age, occupation, avatar_url, preferred_neighborhoods')
          .in('user_id', memberIds);

        const memberProfiles: MemberProfile[] = (profiles ?? []).map((p: Record<string, unknown>) => {
          const memberRow = otherMembers.find(m => m.user_id === p.user_id);
          return {
            userId: p.user_id as string,
            name: (p.full_name as string) ?? 'Roommate',
            age: p.age as number | undefined,
            occupation: p.occupation as string | undefined,
            photo: p.avatar_url as string | undefined,
            compatibilityScore: memberRow?.compatibility_score,
            piReason: memberRow?.pi_reason ?? undefined,
            neighborhoods: (p.preferred_neighborhoods as string[]) ?? [],
          };
        });
        setMembers(memberProfiles);
      }
    } catch {
      setInvite(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, route.params?.groupId]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  const activeDeadline = group?.acceptance_deadline ?? group?.expires_at;

  useEffect(() => {
    if (activeDeadline) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(getTimeRemaining(activeDeadline));
      }, 60000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeDeadline]);

  const handleAccept = async () => {
    if (!invite) return;
    setResponding(true);
    try {
      const success = await acceptGroupInvite(invite.group_id);
      if (!success) {
        Alert.alert('Error', 'Could not accept the invite. Please try again.');
        setResponding(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const updatedMembers = await getAutoGroupMembers(invite.group_id);
      const allAccepted = updatedMembers.every(m => m.status === 'accepted');

      if (allAccepted) {
        const realGroupId = await convertToRealGroup(invite.group_id);
        if (realGroupId) {
          setResponded(true);
          setResponseAction('accepted');
          setTimeout(() => {
            navigation.replace('Chat', { conversationId: `group-${realGroupId}` });
          }, 1500);
          return;
        }
      }

      setResponded(true);
      setResponseAction('accepted');
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    setResponding(true);
    try {
      const success = await declineGroupInvite(invite.group_id);
      if (!success) {
        Alert.alert('Error', 'Could not decline the invite. Please try again.');
        setResponding(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setResponded(true);
      setResponseAction('declined');
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setResponding(false);
    }
  };

  const handleExtendTime = async () => {
    if (!invite || extendedTime) return;
    const currentDeadline = group?.acceptance_deadline ?? group?.expires_at;
    if (!currentDeadline) return;
    try {
      const currentTime = new Date(currentDeadline).getTime();
      const newDeadline = new Date(currentTime + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('pi_auto_groups')
        .update({ acceptance_deadline: newDeadline, deadline_extended: true })
        .eq('id', invite.group_id)
        .not('deadline_extended', 'eq', true);

      if (error) {
        const { data: check } = await supabase
          .from('pi_auto_groups')
          .select('deadline_extended')
          .eq('id', invite.group_id)
          .single();
        if (check?.deadline_extended) {
          Alert.alert('Already Extended', 'The deadline has already been extended for this group.');
          setExtendedTime(true);
        } else {
          Alert.alert('Error', 'Could not extend time. Please try again.');
        }
        return;
      }

      const { data: updated } = await supabase
        .from('pi_auto_groups')
        .select('deadline_extended, acceptance_deadline')
        .eq('id', invite.group_id)
        .single();

      if (!updated?.deadline_extended) {
        Alert.alert('Error', 'Extension did not apply. Please try again.');
        return;
      }

      setExtendedTime(true);
      const confirmedDeadline = updated.acceptance_deadline ?? newDeadline;
      setGroup(prev => prev ? { ...prev, acceptance_deadline: confirmedDeadline, deadline_extended: true } : prev);
      setTimeRemaining(getTimeRemaining(confirmedDeadline));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Error', 'Could not extend time.');
    }
  };

  const locationOverlap = (() => {
    if (members.length === 0 || !group?.neighborhoods) return [];
    const groupNeighborhoods = group.neighborhoods;
    return groupNeighborhoods;
  })();

  const combinedBudget = group ? { min: group.budget_min, max: group.budget_max } : null;

  const hasRisks = (() => {
    if (!group) return false;
    const pendingCount = allMembers.filter(m => m.status === 'pending').length;
    return pendingCount > 1 || timeRemaining.isUrgent;
  })();

  const riskMessages: string[] = [];
  if (allMembers.filter(m => m.status === 'pending').length > 1) {
    riskMessages.push('Some members have not responded yet');
  }
  if (timeRemaining.isUrgent && !timeRemaining.expired) {
    riskMessages.push('This invite expires soon');
  }
  if (timeRemaining.expired) {
    riskMessages.push('This invite has expired');
  }

  const groupMatchScore = group?.match_score ?? 0;

  const renderMemberCard = (member: MemberProfile) => {
    const score = member.compatibilityScore ?? 0;
    return (
      <View key={member.userId} style={[styles.memberCard, { backgroundColor: theme.card }]}>
        <View style={styles.memberTop}>
          {member.photo ? (
            <Image source={{ uri: member.photo }} style={styles.memberPhoto} />
          ) : (
            <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '30' }]}>
              <Feather name="user" size={20} color={theme.primary} />
            </View>
          )}
          <View style={styles.memberInfo}>
            <ThemedText style={styles.memberName}>{member.name}</ThemedText>
            <ThemedText style={[styles.memberMeta, { color: theme.textSecondary }]}>
              {[member.age ? `${member.age}` : null, member.occupation].filter(Boolean).join(' · ') || 'Roommate'}
            </ThemedText>
          </View>
          {score > 0 ? (
            <View style={styles.scoreGauge}>
              <View style={[styles.scoreCircle, { borderColor: getCompatibilityColor(score) }]}>
                <Text style={[styles.scoreText, { color: getCompatibilityColor(score) }]}>{score}</Text>
              </View>
              <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>match</Text>
            </View>
          ) : null}
        </View>
        {member.piReason ? (
          <View style={[styles.piInsight, { backgroundColor: theme.primary + '10' }]}>
            <Text style={styles.piInsightIcon}>π</Text>
            <ThemedText style={[styles.piInsightText, { color: theme.textSecondary }]}>
              {member.piReason}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={28} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Pi Group Invite</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!invite || responded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={28} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Pi Group Invite</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.centered}>
          {responded ? (
            <>
              <View style={[styles.responseIcon, { backgroundColor: responseAction === 'accepted' ? '#4ade80' + '20' : '#f87171' + '20' }]}>
                <Feather
                  name={responseAction === 'accepted' ? 'check-circle' : 'x-circle'}
                  size={48}
                  color={responseAction === 'accepted' ? '#4ade80' : '#f87171'}
                />
              </View>
              <ThemedText style={styles.responseTitle}>
                {responseAction === 'accepted' ? 'You joined the group!' : 'Invite declined'}
              </ThemedText>
              <ThemedText style={[styles.responseSubtitle, { color: theme.textSecondary }]}>
                {responseAction === 'accepted'
                  ? 'Pi will finish building your group. You\'ll be taken to the group chat once everyone accepts.'
                  : 'Pi is still looking for better matches for you. Check back later!'}
              </ThemedText>
              <Pressable
                style={[styles.doneButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.doneButtonText}>
                  {responseAction === 'declined' ? 'Back to Groups' : 'Done'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.responseIcon, { backgroundColor: theme.card }]}>
                <Feather name="inbox" size={48} color={theme.textSecondary} />
              </View>
              <ThemedText style={[styles.responseTitle, { color: theme.textSecondary }]}>
                No pending invites
              </ThemedText>
              <ThemedText style={[styles.responseSubtitle, { color: theme.textSecondary }]}>
                Pi is still searching for your ideal roommate group. Check back later!
              </ThemedText>
              <Pressable
                style={[styles.doneButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.doneButtonText}>Go Back</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Pi Group Invite</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.heroCard}
        >
          <View style={styles.piIconWrapper}>
            <Text style={styles.piIcon}>π</Text>
          </View>
          <ThemedText style={styles.heroTitle}>Pi found you a group!</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Based on your preferences and lifestyle, Pi thinks these roommates could be a great fit.
          </ThemedText>
          {groupMatchScore > 0 ? (
            <View style={styles.groupScoreGauge}>
              <View style={[styles.groupScoreCircle, { borderColor: getCompatibilityColor(groupMatchScore) }]}>
                <Text style={[styles.groupScoreNumber, { color: getCompatibilityColor(groupMatchScore) }]}>
                  {groupMatchScore}
                </Text>
              </View>
              <Text style={styles.groupScoreLabel}>Group Compatibility</Text>
            </View>
          ) : null}
          {group ? (
            <View style={styles.groupMeta}>
              <View style={styles.metaItem}>
                <Feather name="users" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.metaText}>
                  {group.max_members} {group.max_members === 1 ? 'person' : 'people'}
                </Text>
              </View>
              {group.desired_bedrooms > 0 ? (
                <View style={styles.metaItem}>
                  <Feather name="home" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.metaText}>{group.desired_bedrooms}BR target</Text>
                </View>
              ) : null}
              {group.city ? (
                <View style={styles.metaItem}>
                  <Feather name="map-pin" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.metaText}>{group.city}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>

        <View style={[styles.countdownBar, {
          backgroundColor: timeRemaining.isUrgent ? '#f8717120' : '#fbbf2420',
          borderColor: timeRemaining.isUrgent ? '#f8717140' : '#fbbf2440',
        }]}>
          <Feather name="clock" size={14} color={timeRemaining.isUrgent ? '#f87171' : '#fbbf24'} />
          <Text style={[styles.countdownText, { color: timeRemaining.isUrgent ? '#f87171' : '#fbbf24' }]}>
            {timeRemaining.expired
              ? 'Invite expired'
              : `${timeRemaining.hours}h ${timeRemaining.minutes}m remaining`}
          </Text>
          {!timeRemaining.expired && !extendedTime ? (
            <Pressable style={styles.extendBtn} onPress={handleExtendTime}>
              <Text style={styles.extendBtnText}>I need more time</Text>
            </Pressable>
          ) : null}
          {extendedTime ? (
            <Text style={[styles.extendedLabel, { color: '#4ade80' }]}>+24h added</Text>
          ) : null}
        </View>

        {hasRisks ? (
          <View style={[styles.riskBanner, { backgroundColor: '#fbbf2415', borderColor: '#fbbf2430' }]}>
            <Feather name="alert-triangle" size={16} color="#fbbf24" />
            <View style={styles.riskContent}>
              {riskMessages.map((msg, i) => (
                <Text key={i} style={styles.riskText}>{msg}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {members.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="users" size={16} color={theme.primary} />
              <ThemedText style={styles.sectionTitle}>Your Potential Roommates</ThemedText>
            </View>
            {members.map(renderMemberCard)}
          </View>
        ) : null}

        {combinedBudget ? (
          <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Feather name="dollar-sign" size={14} color={theme.primary} />
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Budget Range</ThemedText>
                <ThemedText style={styles.summaryValue}>
                  ${combinedBudget.min.toLocaleString()} - ${combinedBudget.max.toLocaleString()}
                </ThemedText>
              </View>
              {group?.desired_bedrooms ? (
                <View style={styles.summaryItem}>
                  <Feather name="home" size={14} color={theme.primary} />
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Apartment Size</ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    {group.desired_bedrooms} {group.desired_bedrooms === 1 ? 'bedroom' : 'bedrooms'}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {locationOverlap.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={16} color={theme.primary} />
              <ThemedText style={styles.sectionTitle}>Shared Areas</ThemedText>
            </View>
            <View style={styles.tagContainer}>
              {locationOverlap.map((area, idx) => (
                <View key={idx} style={[styles.locationTag, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.locationTagText, { color: theme.primary }]}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {(group?.move_in_window_start || group?.gender_composition) ? (
          <View style={[styles.detailsCard, { backgroundColor: theme.card }]}>
            {group.move_in_window_start ? (
              <View style={styles.detailRow}>
                <Feather name="calendar" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  Move-in: {new Date(group.move_in_window_start).toLocaleDateString()}
                  {group.move_in_window_end ? ` - ${new Date(group.move_in_window_end).toLocaleDateString()}` : ''}
                </ThemedText>
              </View>
            ) : null}
            {group.gender_composition ? (
              <View style={styles.detailRow}>
                <Feather name="users" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  Household: {group.gender_composition}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {group?.pi_rationale ? (
          <View style={[styles.piRationaleCard, { backgroundColor: theme.primary + '10' }]}>
            <Text style={styles.piRationaleIcon}>π</Text>
            <ThemedText style={[styles.piRationaleText, { color: theme.textSecondary }]}>
              {group.pi_rationale}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.declineBtn, { borderColor: '#f87171' }]}
          onPress={handleDecline}
          disabled={responding || timeRemaining.expired}
        >
          {responding ? (
            <ActivityIndicator size="small" color="#f87171" />
          ) : (
            <>
              <Feather name="x" size={20} color="#f87171" />
              <Text style={[styles.declineBtnText, { color: '#f87171' }]}>Decline</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={[styles.acceptBtn, { backgroundColor: timeRemaining.expired ? '#555' : '#4ade80' }]}
          onPress={handleAccept}
          disabled={responding || timeRemaining.expired}
        >
          {responding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={20} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  scrollContent: { flex: 1 },
  scrollInner: { paddingHorizontal: Spacing.md },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  piIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,107,91,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  piIcon: { fontSize: 28, fontWeight: '700', color: '#ff6b5b' },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  groupScoreGauge: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  groupScoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  groupScoreNumber: { fontSize: 22, fontWeight: '800' },
  groupScoreLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  groupMeta: { flexDirection: 'row', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  countdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  countdownText: { fontSize: 13, fontWeight: '600', flex: 1 },
  extendBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  extendBtnText: { fontSize: 12, fontWeight: '600', color: '#fbbf24' },
  extendedLabel: { fontSize: 12, fontWeight: '600' },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  riskContent: { flex: 1, gap: 4 },
  riskText: { fontSize: 13, color: '#fbbf24', lineHeight: 18 },
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  memberCard: {
    padding: 14,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
  },
  memberTop: { flexDirection: 'row', alignItems: 'center' },
  memberPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberMeta: { fontSize: 13, marginTop: 2 },
  scoreGauge: { alignItems: 'center' },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { fontSize: 14, fontWeight: '700' },
  scoreLabel: { fontSize: 10, marginTop: 2 },
  piInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  piInsightIcon: { fontSize: 14, fontWeight: '700', color: '#ff6b5b' },
  piInsightText: { fontSize: 13, lineHeight: 18, flex: 1 },
  summaryCard: {
    borderRadius: BorderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', gap: 16 },
  summaryItem: { flex: 1, gap: 4 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  locationTagText: { fontSize: 13, fontWeight: '500' },
  detailsCard: {
    borderRadius: BorderRadius.md,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14 },
  piRationaleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: BorderRadius.md,
    marginBottom: 16,
  },
  piRationaleIcon: { fontSize: 16, fontWeight: '700', color: '#ff6b5b' },
  piRationaleText: { fontSize: 13, lineHeight: 18, flex: 1 },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingTop: 16,
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  declineBtnText: { fontSize: 16, fontWeight: '600' },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  acceptBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  responseIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  responseTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  responseSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  doneButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
