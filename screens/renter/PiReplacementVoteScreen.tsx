import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '../../components/VectorIcons';
import { useAuth } from '../../contexts/AuthContext';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { PiAutoGroupMember } from '../../types/models';
import {
  voteOnReplacement,
  requestGroupDissolve,
} from '../../services/piAutoMatchService';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';
import { GroupsStackParamList } from '../../navigation/GroupsStackNavigator';

type ScreenNavProp = NativeStackNavigationProp<GroupsStackParamList, 'PiReplacementVote'>;

const BG = '#111';
const CARD_BG = '#1a1a1a';
const PURPLE = '#a855f7';
const GREEN = '#4ade80';
const RED = '#f87171';
const BORDER = '#2a2a2a';

interface CandidateProfile {
  memberId: string;
  userId: string;
  name: string;
  age?: number;
  occupation?: string;
  photo?: string;
  compatibilityScore: number;
  insight?: string;
  neighborhoods?: string[];
  budget?: number;
  approvalCount: number;
  passCount: number;
  hasVoted: boolean;
  myVote?: 'approve' | 'pass';
}

function getCompatibilityColor(score: number): string {
  if (score >= 80) return GREEN;
  if (score >= 60) return '#fbbf24';
  return RED;
}

export function PiReplacementVoteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ScreenNavProp>();
  const route = useRoute<RouteProp<GroupsStackParamList, 'PiReplacementVote'>>();
  const { user } = useAuth();
  const groupId = route.params?.groupId;

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [declinerName, setDeclinerName] = useState<string>('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [dissolving, setDissolving] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!groupId || !user?.id) return;
    setLoading(true);

    try {
      const { data: group } = await supabase
        .from('pi_auto_groups')
        .select('*, pi_auto_group_members(*)')
        .eq('id', groupId)
        .single();

      if (!group) {
        setLoading(false);
        return;
      }

      setDeadline(group.acceptance_deadline);

      const members: PiAutoGroupMember[] = group.pi_auto_group_members || [];

      const decliner = members.find(m => m.status === 'declined');
      if (decliner) {
        const { data: declinerProfile } = await supabase
          .from('profiles')
          .select('first_name, full_name')
          .eq('user_id', decliner.user_id)
          .single();
        setDeclinerName(declinerProfile?.first_name || declinerProfile?.full_name || 'A member');
      }

      const replacements = members.filter(m => m.is_replacement && m.status === 'pending');
      if (replacements.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      const replacementUserIds = replacements.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, full_name, age, occupation, avatar_url, preferred_neighborhoods, max_budget')
        .in('user_id', replacementUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const mapped: CandidateProfile[] = replacements.map(rep => {
        const profile = profileMap.get(rep.user_id);
        const approvedBy = rep.replacement_approved_by || [];
        const passedBy = rep.replacement_passed_by || [];

        return {
          memberId: rep.id,
          userId: rep.user_id,
          name: profile?.first_name || profile?.full_name || 'Unknown',
          age: profile?.age,
          occupation: profile?.occupation,
          photo: profile?.avatar_url,
          compatibilityScore: rep.compatibility_with_group || rep.compatibility_score || 0,
          insight: rep.pi_member_insight || rep.pi_reason,
          neighborhoods: profile?.preferred_neighborhoods,
          budget: profile?.max_budget,
          approvalCount: approvedBy.length,
          passCount: passedBy.length,
          hasVoted: approvedBy.includes(user.id) || passedBy.includes(user.id),
          myVote: approvedBy.includes(user.id) ? 'approve' : passedBy.includes(user.id) ? 'pass' : undefined,
        };
      });

      setCandidates(mapped);
    } catch (err) {
      console.error('Error loading replacement data:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVote = async (memberId: string, vote: 'approve' | 'pass') => {
    if (!groupId) return;
    setVotingId(memberId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await voteOnReplacement(groupId, memberId, vote);

      if (result.result === 'approved') {
        Alert.alert(
          'Replacement Approved',
          'The replacement has been invited to join your group. They have 72 hours to accept.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (result.result === 'rejected') {
        Alert.alert(
          'Candidate Rejected',
          'The group has passed on this candidate.',
          [{ text: 'OK', onPress: () => loadData() }]
        );
      } else if (result.result === 'dissolved') {
        Alert.alert(
          'Group Dissolved',
          "All members passed on all candidates. Pi will keep looking for new groups for you.",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (result.result === 'voted') {
        await loadData();
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to submit your vote.');
    } finally {
      setVotingId(null);
    }
  };

  const handleDissolve = () => {
    Alert.alert(
      'Dissolve Group?',
      "Are you sure you want to start fresh? Pi will dissolve this group and keep looking for new matches for everyone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dissolve',
          style: 'destructive',
          onPress: async () => {
            if (!groupId) return;
            setDissolving(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const success = await requestGroupDissolve(groupId);
            setDissolving(false);
            if (success) {
              navigation.goBack();
            } else {
              Alert.alert('Error', 'Could not dissolve the group.');
            }
          },
        },
      ]
    );
  };

  const getTimeRemaining = () => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0 };
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    };
  };

  const timeLeft = getTimeRemaining();

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{'\u03C0'} Pi found a replacement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <Text style={styles.subheader}>
          {declinerName} passed -- here's who Pi thinks would be a great fit
        </Text>

        {timeLeft ? (
          <View style={styles.deadlineBanner}>
            <Feather name="clock" size={14} color={timeLeft.hours < 12 ? RED : PURPLE} />
            <Text style={[styles.deadlineText, timeLeft.hours < 12 ? { color: RED } : null]}>
              {timeLeft.hours}h {timeLeft.minutes}m left to vote
            </Text>
          </View>
        ) : null}

        {candidates.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={40} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>
              Pi is still looking for replacement candidates. Check back soon.
            </Text>
          </View>
        ) : null}

        {candidates.map((candidate) => (
          <View key={candidate.memberId} style={styles.card}>
            <View style={styles.cardTop}>
              {candidate.photo ? (
                <Image source={{ uri: candidate.photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={28} color="rgba(255,255,255,0.4)" />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.candidateName}>{candidate.name}</Text>
                <Text style={styles.candidateSub}>
                  {[candidate.age ? `${candidate.age}` : null, candidate.occupation]
                    .filter(Boolean)
                    .join(' - ')}
                </Text>
              </View>
              <View style={[styles.scoreCircle, { borderColor: getCompatibilityColor(candidate.compatibilityScore) }]}>
                <Text style={[styles.scoreText, { color: getCompatibilityColor(candidate.compatibilityScore) }]}>
                  {Math.round(candidate.compatibilityScore)}%
                </Text>
              </View>
            </View>

            {candidate.insight ? (
              <View style={styles.insightBox}>
                <Text style={styles.insightLabel}>{'\u03C0'} What they bring to the group</Text>
                <Text style={styles.insightText}>{candidate.insight}</Text>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              {candidate.neighborhoods && candidate.neighborhoods.length > 0 ? (
                <View style={styles.statChip}>
                  <Feather name="map-pin" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.statText}>{candidate.neighborhoods.slice(0, 2).join(', ')}</Text>
                </View>
              ) : null}
              {candidate.budget ? (
                <View style={styles.statChip}>
                  <Feather name="dollar-sign" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.statText}>${candidate.budget}/mo</Text>
                </View>
              ) : null}
            </View>

            {candidate.hasVoted ? (
              <View style={[
                styles.votedBanner,
                { backgroundColor: candidate.myVote === 'approve' ? GREEN + '20' : '#666' + '20' }
              ]}>
                <Feather
                  name={candidate.myVote === 'approve' ? 'check-circle' : 'x-circle'}
                  size={16}
                  color={candidate.myVote === 'approve' ? GREEN : '#999'}
                />
                <Text style={[styles.votedText, { color: candidate.myVote === 'approve' ? GREEN : '#999' }]}>
                  You {candidate.myVote === 'approve' ? 'approved' : 'passed'}
                </Text>
              </View>
            ) : (
              <View style={styles.voteRow}>
                <Pressable
                  style={[styles.approveBtn, votingId === candidate.memberId ? { opacity: 0.5 } : null]}
                  onPress={() => handleVote(candidate.memberId, 'approve')}
                  disabled={votingId !== null}
                >
                  {votingId === candidate.memberId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.passBtn, votingId === candidate.memberId ? { opacity: 0.5 } : null]}
                  onPress={() => handleVote(candidate.memberId, 'pass')}
                  disabled={votingId !== null}
                >
                  <Text style={styles.passBtnText}>Pass</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.voteCountText}>
              {candidate.approvalCount} approval{candidate.approvalCount !== 1 ? 's' : ''} so far
            </Text>
          </View>
        ))}

        <Pressable
          style={styles.dissolveLink}
          onPress={handleDissolve}
          disabled={dissolving}
        >
          {dissolving ? (
            <ActivityIndicator size="small" color={RED} />
          ) : (
            <Text style={styles.dissolveLinkText}>
              Dissolve group -- I'd rather start fresh
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
    color: '#fff',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  subheader: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  deadlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  deadlineText: {
    ...Typography.caption,
    color: PURPLE,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  candidateName: {
    ...Typography.h4,
    color: '#fff',
  },
  candidateSub: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 14,
  },
  insightBox: {
    backgroundColor: PURPLE + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightLabel: {
    ...Typography.caption,
    color: PURPLE,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightText: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#222',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statText: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GREEN,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
  },
  approveBtnText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  passBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
  },
  passBtnText: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  votedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    marginTop: 4,
  },
  votedText: {
    ...Typography.body,
    fontWeight: '600',
  },
  voteCountText: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
    textAlign: 'center',
  },
  dissolveLink: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  dissolveLinkText: {
    ...Typography.body,
    color: RED,
    fontWeight: '500',
  },
});

export default PiReplacementVoteScreen;
