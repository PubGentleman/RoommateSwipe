import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '../../components/VectorIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { StorageService } from '../../utils/storage';
import { withTimeout } from '../../utils/asyncHelpers';

const BG = '#111';
const ACCENT = '#ff6b5b';

export function AIGroupInviteScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    loadGroupData();
  }, []);

  const loadGroupData = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('groups')
          .select(`*, group_members(user_id, users(id, full_name, avatar_url, profile:profiles(photos, cleanliness, sleep_schedule)))`)
          .eq('id', groupId)
          .single();

        setGroup(data);
        setMembers(data?.group_members ?? []);
      } else {
        const groups = await StorageService.getGroups();
        const grp = groups.find((g: any) => g.id === groupId);
        setGroup(grp);

        if (grp) {
          const profiles = await StorageService.getRoommateProfiles();
          const rawMembers = grp.members || [];
          const memberIds = rawMembers.map((m: any) =>
            typeof m === 'string' ? m : m.id || m.user_id
          ).filter(Boolean);

          const memberData = memberIds
            .map((id: string) => profiles.find((p: any) => p.id === id))
            .filter(Boolean)
            .map((p: any) => ({
              user_id: p.id,
              users: {
                id: p.id,
                full_name: p.name || 'Renter',
                avatar_url: p.photos?.[0] || '',
                profile: {
                  photos: p.photos || [],
                  cleanliness: p.lifestyle?.cleanliness,
                  sleep_schedule: p.lifestyle?.workSchedule,
                },
              },
            }));
          setMembers(memberData);
        }
      }
    } catch (err) {
      console.warn('[AIGroupInvite] Error loading:', err);
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isSupabaseConfigured) {
        const { data: inviteRow, error: inviteErr } = await supabase
          .from('group_invites')
          .update({ status: 'accepted' })
          .eq('group_id', groupId)
          .eq('invited_user_id', user.id)
          .eq('status', 'pending')
          .select()
          .single();

        if (inviteErr || !inviteRow) {
          console.warn('[AIGroupInvite] No pending invite found');
          setAccepting(false);
          return;
        }

        await supabase.from('group_members').upsert({
          group_id: groupId,
          user_id: user.id,
          role: 'member',
        }, { onConflict: 'group_id,user_id' });

        const { data: pendingInvites } = await supabase
          .from('group_invites')
          .select('id')
          .eq('group_id', groupId)
          .eq('status', 'pending');

        if (!pendingInvites || pendingInvites.length === 0) {
          withTimeout(
    supabase.functions.invoke('match-groups-to-listings', {
            body: { groupId },
          }),
    30000,
    'match-groups-to-listings'
  );

          const { data: allMembers } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);

          for (const member of (allMembers ?? [])) {
            await supabase.from('notifications').insert({
              user_id: member.user_id,
              type: 'group_complete',
              title: 'Your group is complete!',
              body: 'Everyone accepted. Check out the apartments AI found for your group.',
              data: JSON.stringify({ group_id: groupId }),
            });
          }
        }
      } else {
        const groups = await StorageService.getGroups();
        const grpIndex = groups.findIndex((g: any) => g.id === groupId);
        if (grpIndex >= 0) {
          const grp = groups[grpIndex];
          const memberIds = (grp.members || []).map((m: any) =>
            typeof m === 'string' ? m : m.id || m.user_id
          );
          if (!memberIds.includes(user.id)) {
            grp.members = [...memberIds, user.id];
            groups[grpIndex] = grp;
            await StorageService.saveGroups(groups);
          }
        }
      }

      setAccepting(false);
      navigation.replace('GroupInfo' as never, { groupId, groupName: group?.name } as never);
    } catch (e) {
      console.error('Failed to accept invite:', e);
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isSupabaseConfigured && user) {
      await supabase
        .from('group_invites')
        .update({ status: 'declined' })
        .eq('group_id', groupId)
        .eq('invited_user_id', user.id);
    }

    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.aiLabelRow}>
        <Feather name="zap" size={14} color={ACCENT} />
        <Text style={styles.aiLabel}>Pi matched you</Text>
      </View>
      <Text style={styles.title}>You've been invited to a group</Text>

      <View style={styles.membersSection}>
        {members.map((m: any) => (
          <View key={m.user_id} style={styles.memberRow}>
            {m.users?.profile?.photos?.[0] || m.users?.avatar_url ? (
              <Image
                source={{ uri: m.users?.profile?.photos?.[0] || m.users?.avatar_url }}
                style={styles.memberPhoto}
              />
            ) : (
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.memberPhoto}>
                <Text style={styles.memberInitial}>
                  {(m.users?.full_name || 'R').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.users?.full_name || 'Renter'}</Text>
              <Text style={styles.memberDetail}>
                {m.users?.profile?.sleep_schedule
                  ? m.users.profile.sleep_schedule.replace(/_/g, ' ')
                  : ''}
                {m.users?.profile?.cleanliness
                  ? ` · Cleanliness ${m.users.profile.cleanliness}/10`
                  : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.aiMessage}>
        AI matched you based on lifestyle compatibility.
        Once everyone accepts, we'll find apartments that work for your whole group.
      </Text>

      <Pressable style={styles.acceptBtn} onPress={handleAccept} disabled={accepting}>
        {accepting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.acceptBtnText}>Join Group</Text>
        )}
      </Pressable>

      <Pressable style={styles.declineBtn} onPress={handleDecline}>
        <Text style={styles.declineBtnText}>No thanks</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiLabel: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 28,
  },
  membersSection: {
    gap: 16,
    marginBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
  },
  memberPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberDetail: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  aiMessage: {
    color: '#888',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 28,
    textAlign: 'center',
  },
  acceptBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  declineBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#555',
    fontSize: 15,
  },
});
