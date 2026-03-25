import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Modal, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '../../components/VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Typography, Spacing } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { TeamMember } from '../../types/models';
import { LinearGradient } from 'expo-linear-gradient';

type InviteRole = 'admin' | 'member';

export function TeamManagementScreen() {
  const { theme } = useTheme();
  const { user, getTeamMembers, inviteTeamMember, removeTeamMember, updateTeamMemberRole, getTeamSeatLimit } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('member');
  const [sending, setSending] = useState(false);
  const [menuMemberId, setMenuMemberId] = useState<string | null>(null);

  const seatLimit = getTeamSeatLimit();
  const activeCount = members.length + 1;
  const atSeatLimit = activeCount >= seatLimit;
  const seatLimitDisplay = seatLimit === Infinity ? 'Unlimited' : String(seatLimit);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const data = await getTeamMembers();
    setMembers(data);
    setLoading(false);
  }, [getTeamMembers]);

  useEffect(() => { loadMembers(); }, []);

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setSending(true);
    try {
      await inviteTeamMember(inviteEmail.trim(), inviteName.trim(), inviteRole);
      await showAlert({ title: 'Invite Sent', message: `${inviteName.trim()} has been invited to join your team.` });
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('member');
      loadMembers();
    } catch (e: any) {
      await showAlert({ title: 'Error', message: e?.message || 'Failed to send invite.', variant: 'warning' });
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    const confirmed = await confirm({
      title: 'Remove Team Member',
      message: `Remove ${member.fullName || member.email} from your team?`,
    });
    if (!confirmed) return;
    await removeTeamMember(member.id);
    loadMembers();
  };

  const handleRoleChange = async (member: TeamMember) => {
    const newRole: InviteRole = member.role === 'admin' ? 'member' : 'admin';
    await updateTeamMemberRole(member.id, newRole);
    loadMembers();
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ');
      return (parts[0]?.[0] ?? '' + (parts[1]?.[0] ?? '')).toUpperCase();
    }
    return (email?.[0] ?? '?').toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return '#F59E0B';
      case 'admin': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#22C55E' : '#F59E0B';
  };

  const renderMember = ({ item }: { item: TeamMember }) => (
    <View style={[styles.memberRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: getRoleBadgeColor(item.role) + '25' }]}>
        <Text style={[styles.avatarText, { color: getRoleBadgeColor(item.role) }]}>
          {getInitials(item.fullName, item.email)}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
          {item.fullName || item.email}
        </Text>
        <Text style={[styles.memberEmail, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.email}
        </Text>
      </View>
      <View style={styles.memberBadges}>
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) + '20' }]}>
          <Text style={[styles.roleBadgeText, { color: getRoleBadgeColor(item.role) }]}>
            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      {item.role !== 'owner' ? (
        <Pressable
          style={styles.menuBtn}
          onPress={() => setMenuMemberId(menuMemberId === item.id ? null : item.id)}
          hitSlop={8}
        >
          <Feather name="more-vertical" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
      {menuMemberId === item.id && item.role !== 'owner' ? (
        <View style={[styles.menuDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            style={styles.menuItem}
            onPress={() => { setMenuMemberId(null); handleRoleChange(item); }}
          >
            <Feather name="shield" size={14} color={theme.text} />
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              {item.role === 'admin' ? 'Change to Member' : 'Change to Admin'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => { setMenuMemberId(null); handleRemove(item); }}
          >
            <Feather name="user-minus" size={14} color="#EF4444" />
            <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const ownerRow = (
    <View style={[styles.memberRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: '#F59E0B25' }]}>
        <Text style={[styles.avatarText, { color: '#F59E0B' }]}>
          {getInitials(user?.name)}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
          {user?.name} (You)
        </Text>
        <Text style={[styles.memberEmail, { color: theme.textSecondary }]} numberOfLines={1}>
          {user?.email}
        </Text>
      </View>
      <View style={styles.memberBadges}>
        <View style={[styles.roleBadge, { backgroundColor: '#F59E0B20' }]}>
          <Text style={[styles.roleBadgeText, { color: '#F59E0B' }]}>Owner</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#22C55E20' }]}>
          <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
          <Text style={[styles.statusText, { color: '#22C55E' }]}>Active</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={[Typography.h2, { color: theme.text }]}>Your Team</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {activeCount} of {seatLimitDisplay} seats used
          </Text>
        </View>
        <Pressable
          style={[styles.inviteBtn, atSeatLimit ? { opacity: 0.4 } : null]}
          onPress={() => { if (!atSeatLimit) setShowInvite(true); }}
          disabled={atSeatLimit}
        >
          <Feather name="user-plus" size={16} color="#FFFFFF" />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </Pressable>
      </View>

      {atSeatLimit ? (
        <View style={[styles.limitBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}>
          <Feather name="users" size={15} color="#F59E0B" />
          <Text style={[styles.limitText, { color: theme.textSecondary }]}>
            You've reached your {seatLimitDisplay}-seat limit.{' '}
            <Text style={styles.upgradeLink} onPress={() => navigation.navigate('HostSubscription')}>
              Upgrade to add more
            </Text>
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          ListHeaderComponent={ownerRow}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="users" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No team members yet. Invite your first colleague.
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowInvite(false)}>
          <Pressable style={[styles.inviteSheet, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={[Typography.h3, { color: theme.text, marginBottom: Spacing.md }]}>Invite Team Member</Text>

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Team member's name"
                placeholderTextColor={theme.textSecondary + '60'}
                value={inviteName}
                onChangeText={setInviteName}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="email@company.com"
                placeholderTextColor={theme.textSecondary + '60'}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Role</Text>
              <View style={styles.roleRow}>
                {(['admin', 'member'] as InviteRole[]).map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.roleCard,
                      { backgroundColor: theme.background, borderColor: inviteRole === r ? theme.primary : theme.border },
                    ]}
                    onPress={() => setInviteRole(r)}
                  >
                    <Text style={[styles.roleCardTitle, { color: inviteRole === r ? theme.primary : theme.text }]}>
                      {r === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                    <Text style={[styles.roleCardDesc, { color: theme.textSecondary }]}>
                      {r === 'admin'
                        ? 'Manage listings, inquiries, and invite members'
                        : 'Manage listings and respond to inquiries'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.sendBtn, (!inviteName.trim() || !inviteEmail.trim()) ? { opacity: 0.4 } : null]}
              onPress={handleInvite}
              disabled={!inviteName.trim() || !inviteEmail.trim() || sending}
            >
              <LinearGradient
                colors={['#ff6b5b', '#e83a2a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnGrad}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.sendBtnText}>Send Invite</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  subtitle: { fontSize: 13, marginTop: 2 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  limitText: { fontSize: 12, flex: 1, lineHeight: 17 },
  upgradeLink: { color: '#F59E0B', fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: Spacing.lg, gap: 10, paddingTop: Spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    position: 'relative',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberEmail: { fontSize: 12 },
  memberBadges: { gap: 4, alignItems: 'flex-end' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  menuBtn: { padding: 4 },
  menuDropdown: {
    position: 'absolute',
    right: 14,
    top: 52,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
    minWidth: 160,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemText: { fontSize: 13, fontWeight: '500' },
  emptyWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 220, lineHeight: 21 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  inviteSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  roleCardTitle: { fontSize: 14, fontWeight: '700' },
  roleCardDesc: { fontSize: 11, lineHeight: 16 },
  sendBtn: { marginTop: Spacing.md },
  sendBtnGrad: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
