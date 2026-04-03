import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Pressable, FlatList, ActivityIndicator,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Typography, Spacing } from '../../constants/theme';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { promoteMember, leaveGroup } from '../../services/groupService';

export function PromoteAdminScreen({ navigation, route }: any) {
  const { groupId, groupName } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const { alert } = useConfirm();
  const [members, setMembers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    supabase
      .from('group_members')
      .select('user_id, role, users ( id, name, photos )')
      .eq('group_id', groupId)
      .neq('user_id', user?.id || '')
      .then(({ data }) => {
        setMembers(data || []);
        setLoadingMembers(false);
      });
  }, []);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await promoteMember(user!.id, groupId, selected);
      await leaveGroup(user!.id, groupId);
      await alert({ title: 'Done', message: 'You have left the group.', variant: 'success' });
      navigation.popToTop();
    } catch (err: any) {
      await alert({ title: 'Error', message: err.message, variant: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>
          Choose a New Admin
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
        <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
          Select someone to take over "{groupName}" before you leave.
        </ThemedText>
      </View>

      {loadingMembers ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : members.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="users" size={36} color={theme.textSecondary} />
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
            No other members to promote.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={item => item.user_id}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item.user_id)}
              style={[styles.memberRow, {
                borderColor: selected === item.user_id ? theme.primary : theme.border,
                backgroundColor: selected === item.user_id ? theme.primary + '15' : theme.card,
              }]}
            >
              {item.users?.photos?.[0] ? (
                <Image source={{ uri: item.users.photos[0] }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '30' }]}>
                  <Feather name="user" size={20} color={theme.primary} />
                </View>
              )}
              <ThemedText style={[Typography.body, { flex: 1, marginLeft: Spacing.sm, fontWeight: '600' }]}>
                {item.users?.name || 'Member'}
              </ThemedText>
              {selected === item.user_id ? (
                <Feather name="check-circle" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          )}
        />
      )}

      <View style={{ padding: Spacing.lg }}>
        <Pressable
          style={[styles.confirmBtn, {
            backgroundColor: theme.primary,
            opacity: !selected || loading ? 0.5 : 1,
          }]}
          onPress={handleConfirm}
          disabled={!selected || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '700' }]}>Promote & Leave</ThemedText>
          }
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderRadius: 14, borderWidth: 1.5, marginBottom: Spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
});
