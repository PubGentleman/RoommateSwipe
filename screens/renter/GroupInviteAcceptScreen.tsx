import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  getGroupByInviteCode,
  getGroupMembers,
  joinGroupByCode,
} from '../../services/preformedGroupService';
import { acceptGroupInvite, declineGroupInvite } from '../../services/groupService';
import { supabase } from '../../lib/supabase';
import { PreformedGroup, PreformedGroupMember } from '../../types/models';
import { RhomeLogo } from '../../components/RhomeLogo';

type RouteParams = {
  GroupInviteAccept: { inviteCode: string };
};

export default function GroupInviteAcceptScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'GroupInviteAccept'>>();
  const { user, updateUser } = useAuth();
  const inviteCode = route.params?.inviteCode || '';

  const [group, setGroup] = useState<PreformedGroup | null>(null);
  const [members, setMembers] = useState<PreformedGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [emailInvite, setEmailInvite] = useState<any>(null);

  useEffect(() => {
    loadGroup();
  }, [inviteCode]);

  const loadGroup = async () => {
    if (!inviteCode) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }
    const g = await getGroupByInviteCode(inviteCode);
    if (g) {
      const m = await getGroupMembers(g.id);
      setGroup(g);
      setMembers(m);
      setLoading(false);
      return;
    }

    try {
      const { data: inv } = await supabase
        .from('group_invites')
        .select('*, preformed_groups(id, name, group_size, status, invite_code, group_lead_id, city)')
        .eq('invite_code', inviteCode)
        .eq('status', 'pending')
        .single();

      if (inv?.preformed_groups) {
        setEmailInvite(inv);
        const pg = inv.preformed_groups as any;
        setGroup(pg);
        const m = await getGroupMembers(pg.id);
        setMembers(m);
        setLoading(false);
        return;
      }
    } catch {}

    setError('Group not found or invite has expired');
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!user || !group) return;
    setJoining(true);

    try {
      if (emailInvite) {
        await acceptGroupInvite(emailInvite.invite_code, user.id);
      } else {
        const result = await joinGroupByCode(inviteCode, user.name || 'Member');
        if (!result.success) {
          setError('Failed to join group');
          setJoining(false);
          return;
        }
      }
      await updateUser({
        profileData: {
          ...user.profileData,
          listing_type_preference: 'any' as const,
          apartment_search_type: 'have_group' as const,
        },
      });
      navigation.navigate('GroupsList' as never);
    } catch {
      setError('Failed to join group');
    }
    setJoining(false);
  };

  const handleDecline = async () => {
    if (emailInvite?.invite_code) {
      try {
        await declineGroupInvite(emailInvite.invite_code);
      } catch {}
    }
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.loadingText}>Loading invite...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!group) return null;

  const leadMember = members.find(m => m.user_id === group.group_lead_id);
  const joinedCount = members.filter(m => m.status === 'joined').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.logoWrap}>
        <RhomeLogo size="small" />
      </View>

      <View style={styles.inviteCard}>
        <View style={styles.iconCircle}>
          <Feather name="users" size={28} color="#22C55E" />
        </View>

        <Text style={styles.headline}>You've been invited!</Text>
        <Text style={styles.groupName}>{group.name || 'A roommate group'}</Text>

        {leadMember ? (
          <Text style={styles.leadText}>
            Created by {leadMember.name.replace(' (Group Lead)', '')}
          </Text>
        ) : null}

        <View style={styles.detailRow}>
          <Feather name="users" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.detailText}>
            {joinedCount}/{group.group_size} members joined
          </Text>
        </View>

        {group.city ? (
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.detailText}>{group.city}</Text>
          </View>
        ) : null}

        {emailInvite?.is_couple ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(236,72,153,0.1)', borderRadius: 8 }}>
            <Feather name="heart" size={12} color="#EC4899" />
            <Text style={{ fontSize: 12, color: '#EC4899', fontWeight: '500' }}>Joining as a couple (sharing 1 bedroom)</Text>
          </View>
        ) : null}

        <View style={styles.membersList}>
          {members.map(m => (
            <View key={m.id} style={styles.memberRow}>
              <View style={[
                styles.memberDot,
                { backgroundColor: m.status === 'joined' ? '#22C55E' : '#666' },
              ]} />
              <Text style={styles.memberName}>{m.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.acceptBtn, joining && styles.btnDisabled]}
        onPress={handleAccept}
        disabled={joining}
      >
        {joining ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.acceptBtnText}>Join Group</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.declineBtn} onPress={handleDecline}>
        <Text style={styles.declineBtnText}>Decline</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoWrap: {
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  inviteCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 28,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
    marginBottom: 8,
  },
  leadText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  membersList: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberName: {
    fontSize: 14,
    color: '#fff',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  declineBtn: {
    paddingVertical: 12,
  },
  declineBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
});
