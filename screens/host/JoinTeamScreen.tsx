import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Feather } from '../../components/VectorIcons';
import { Typography, Spacing } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

type RouteParams = {
  JoinTeam: { inviteId: string };
};

export function JoinTeamScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const inviteId = route.params?.inviteId;

  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'success' | 'error'>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadInvite();
  }, [inviteId]);

  const loadInvite = async () => {
    if (!inviteId || !isSupabaseConfigured) {
      setErrorMsg('Invalid invite link.');
      setStatus('error');
      return;
    }

    const { data: member, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (error || !member) {
      setErrorMsg('This invite was not found or has expired.');
      setStatus('error');
      return;
    }

    if (member.status !== 'pending') {
      setErrorMsg('This invite has already been used.');
      setStatus('error');
      return;
    }

    const { data: company } = await supabase
      .from('users')
      .select('full_name, company_name')
      .eq('id', member.company_user_id)
      .single();

    setCompanyName(company?.company_name || company?.full_name || 'Company');
    setInvite(member);
    setStatus('ready');
  };

  const handleJoin = async () => {
    if (!user || !invite) return;
    setStatus('joining');

    try {
      if (user.email?.toLowerCase() !== invite.email?.toLowerCase()) {
        throw new Error('This invite was sent to a different email address. Please sign in with the invited email.');
      }

      const { data: updated, error: tmError } = await supabase
        .from('team_members')
        .update({
          member_user_id: user.id,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .eq('id', invite.id)
        .eq('email', user.email!.toLowerCase())
        .eq('status', 'pending')
        .select('id')
        .single();

      if (tmError || !updated) throw new Error('Unable to accept invite. It may have already been used.');

      const userUpdate: any = {
        parent_company_id: invite.company_user_id,
      };
      if (invite.role === 'agent') {
        userUpdate.host_type = 'agent';
        userUpdate.role = 'host';
      }

      await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', user.id);

      setStatus('success');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to join team.');
      setStatus('error');
    }
  };

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>Loading invite...</Text>
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={styles.centered}>
          <View style={[styles.iconCircle, { backgroundColor: '#EF444420' }]}>
            <Feather name="alert-circle" size={32} color="#EF4444" />
          </View>
          <Text style={[Typography.h3, { color: theme.text, textAlign: 'center', marginTop: 16 }]}>
            Unable to Join
          </Text>
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>{errorMsg}</Text>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={[styles.backBtnText, { color: theme.primary }]}>Go Back</Text>
          </Pressable>
        </View>
      );
    }

    if (status === 'success') {
      return (
        <View style={styles.centered}>
          <View style={[styles.iconCircle, { backgroundColor: '#22C55E20' }]}>
            <Feather name="check-circle" size={32} color="#22C55E" />
          </View>
          <Text style={[Typography.h3, { color: theme.text, textAlign: 'center', marginTop: 16 }]}>
            Welcome to {companyName}!
          </Text>
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            You've successfully joined the team{invite?.role === 'agent' ? ' as an agent' : ''}.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={[styles.backBtnText, { color: theme.primary }]}>Continue</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <View style={[styles.iconCircle, { backgroundColor: '#3B82F620' }]}>
          <Feather name="users" size={32} color="#3B82F6" />
        </View>
        <Text style={[Typography.h3, { color: theme.text, textAlign: 'center', marginTop: 16 }]}>
          Join {companyName}
        </Text>
        <Text style={[styles.statusText, { color: theme.textSecondary }]}>
          You've been invited to join as {invite?.role === 'agent' ? 'an Agent' : invite?.role === 'admin' ? 'an Admin' : 'a Member'}.
        </Text>
        {invite?.role === 'agent' ? (
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            As an agent, you'll get your own profile under {companyName} and can be assigned to listings.
          </Text>
        ) : null}

        <Pressable
          style={styles.joinBtn}
          onPress={handleJoin}
          disabled={status === 'joining'}
        >
          <LinearGradient
            colors={['#ff6b5b', '#e83a2a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.joinBtnGrad}
          >
            {status === 'joining' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.joinBtnText}>Join Team</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  centered: { alignItems: 'center', gap: 8 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  statusText: { fontSize: 14, textAlign: 'center', marginTop: 4, maxWidth: 280, lineHeight: 20 },
  detailText: { fontSize: 13, textAlign: 'center', maxWidth: 300, lineHeight: 19 },
  backBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { fontSize: 15, fontWeight: '600' },
  joinBtn: { marginTop: 24, width: '100%', maxWidth: 280 },
  joinBtnGrad: {
    height: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
