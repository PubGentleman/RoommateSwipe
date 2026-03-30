import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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
} from '../../services/piAutoMatchService';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type RouteParams = {
  PiGroupInvite: {
    groupId?: string;
  };
};

interface MemberProfile {
  userId: string;
  name: string;
  age?: number;
  occupation?: string;
  photo?: string;
  compatibility?: number;
}

export const PiGroupInviteScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PiGroupInvite'>>();

  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [invite, setInvite] = useState<PiAutoGroupMember | null>(null);
  const [group, setGroup] = useState<PiAutoGroup | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [responded, setResponded] = useState(false);
  const [responseAction, setResponseAction] = useState<'accepted' | 'declined' | null>(null);

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
        setGroup(groupData as PiAutoGroup);
      }

      const allMembers = await getAutoGroupMembers(pendingInvite.group_id);
      const otherMembers = allMembers.filter(
        m => m.user_id !== user.id && (m.status === 'pending' || m.status === 'accepted')
      );

      const memberIds = otherMembers.map(m => m.user_id);
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, age, occupation, avatar_url')
          .in('user_id', memberIds);

        const memberProfiles: MemberProfile[] = (profiles ?? []).map((p: any) => ({
          userId: p.user_id,
          name: p.full_name ?? 'Roommate',
          age: p.age,
          occupation: p.occupation,
          photo: p.avatar_url,
        }));
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

  const handleAccept = async () => {
    if (!invite) return;
    setResponding(true);
    try {
      const success = await acceptGroupInvite(invite.group_id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResponded(true);
        setResponseAction('accepted');
      } else {
        Alert.alert('Error', 'Could not accept the invite. Please try again.');
      }
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
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setResponded(true);
        setResponseAction('declined');
      } else {
        Alert.alert('Error', 'Could not decline the invite. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setResponding(false);
    }
  };

  const renderMemberCard = (member: MemberProfile) => (
    <View key={member.userId} style={[styles.memberCard, { backgroundColor: theme.card }]}>
      <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '30' }]}>
        <Feather name="user" size={20} color={theme.primary} />
      </View>
      <View style={styles.memberInfo}>
        <ThemedText style={styles.memberName}>{member.name}</ThemedText>
        <ThemedText style={[styles.memberMeta, { color: theme.textSecondary }]}>
          {[member.age ? `${member.age}` : null, member.occupation].filter(Boolean).join(' · ') || 'Roommate'}
        </ThemedText>
      </View>
      <View style={[styles.statusDot, { backgroundColor: '#4ade80' }]} />
    </View>
  );

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
                  ? 'Pi will finish building your group. Check back in My Groups soon.'
                  : 'No worries — Pi will keep looking for better matches.'}
              </ThemedText>
              <Pressable
                style={[styles.doneButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.doneButtonText}>Done</Text>
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
          {group ? (
            <View style={styles.groupMeta}>
              <View style={styles.metaItem}>
                <Feather name="users" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.metaText}>
                  {group.max_members} {group.max_members === 1 ? 'person' : 'people'} group
                </Text>
              </View>
              {group.city ? (
                <View style={styles.metaItem}>
                  <Feather name="map-pin" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.metaText}>{group.city}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>

        {members.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="users" size={16} color={theme.primary} />
              <ThemedText style={styles.sectionTitle}>Your Potential Roommates</ThemedText>
            </View>
            {members.map(renderMemberCard)}
          </View>
        ) : null}

        {(group?.budget_min || group?.neighborhoods?.length || group?.move_in_window_start) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="sliders" size={16} color={theme.primary} />
              <ThemedText style={styles.sectionTitle}>Match Criteria</ThemedText>
            </View>
            <View style={[styles.criteriaCard, { backgroundColor: theme.card }]}>
              {group.budget_min ? (
                <View style={styles.criteriaRow}>
                  <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                  <ThemedText style={[styles.criteriaText, { color: theme.textSecondary }]}>
                    Budget: ${group.budget_min} - ${group.budget_max}
                  </ThemedText>
                </View>
              ) : null}
              {group.neighborhoods && group.neighborhoods.length > 0 ? (
                <View style={styles.criteriaRow}>
                  <Feather name="map-pin" size={14} color={theme.textSecondary} />
                  <ThemedText style={[styles.criteriaText, { color: theme.textSecondary }]}>
                    Areas: {group.neighborhoods.join(', ')}
                  </ThemedText>
                </View>
              ) : null}
              {group.move_in_window_start ? (
                <View style={styles.criteriaRow}>
                  <Feather name="calendar" size={14} color={theme.textSecondary} />
                  <ThemedText style={[styles.criteriaText, { color: theme.textSecondary }]}>
                    Move-in: {new Date(group.move_in_window_start).toLocaleDateString()}{group.move_in_window_end ? ` - ${new Date(group.move_in_window_end).toLocaleDateString()}` : ''}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.infoSection}>
          <Feather name="info" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            This invite expires in 48 hours. If all members accept, Pi will create your group automatically.
          </ThemedText>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.declineBtn, { borderColor: '#f87171' }]}
          onPress={handleDecline}
          disabled={responding}
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
          style={[styles.acceptBtn, { backgroundColor: '#4ade80' }]}
          onPress={handleAccept}
          disabled={responding}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: Spacing.md,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
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
  piIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ff6b5b',
  },
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
  groupMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  criteriaCard: {
    padding: 14,
    borderRadius: BorderRadius.md,
    gap: 10,
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  criteriaText: {
    fontSize: 14,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
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
  declineBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
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
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
