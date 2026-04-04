import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, TextInput,
  ActivityIndicator,
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
import { AppHeader, HeaderActionButton } from '../../components/AppHeader';

type InviteRole = 'admin' | 'member' | 'agent';

export function TeamManagementScreen() {
  const { theme } = useTheme();
  const { user, getTeamMembers, inviteTeamMember, resendTeamInvite, removeTeamMember, updateTeamMemberRole, getTeamSeatLimit } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('member');
  const [agentLicense, setAgentLicense] = useState('');
  const [sending, setSending] = useState(false);
  const [menuMemberId, setMenuMemberId] = useState<string | null>(null);

  const seatLimit = getTeamSeatLimit();
  const activeCount = members.length + 1;
  const atSeatLimit = activeCount >= seatLimit;
  const seatLimitDisplay = seatLimit === Infinity ? 'Unlimited' : String(seatLimit);

  const agents = members.filter(m => m.role === 'agent');
  const staff = members.filter(m => m.role !== 'agent');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeamMembers();
      setMembers(data);
    } catch (e) {
      console.warn('Failed to load team members:', e);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [getTeamMembers]);

  useEffect(() => { loadMembers(); }, []);

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setSending(true);
    try {
      await inviteTeamMember(inviteEmail.trim(), inviteName.trim(), inviteRole, inviteRole === 'agent' ? agentLicense : undefined);
      await showAlert({ title: 'Invite Sent', message: `${inviteName.trim()} has been invited to join your team.` });
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('member');
      setAgentLicense('');
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

  const handleRoleChange = async (member: TeamMember, newRole: InviteRole) => {
    await updateTeamMemberRole(member.id, newRole);
    loadMembers();
  };

  const handleResend = async (member: TeamMember) => {
    try {
      await resendTeamInvite(member);
      await showAlert({ title: 'Invite Resent', message: `A new invite email has been sent to ${member.email}.` });
    } catch (e: any) {
      await showAlert({ title: 'Error', message: e?.message || 'Failed to resend invite.', variant: 'warning' });
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ');
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    }
    return (email?.[0] ?? '?').toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return '#F59E0B';
      case 'admin': return '#3B82F6';
      case 'agent': return '#34C759';
      default: return '#6B7280';
    }
  };

  const renderMember = ({ item }: { item: TeamMember }) => {
    const isAgent = item.role === 'agent';
    const isPending = item.status === 'pending';
    const roleColor = getRoleBadgeColor(item.role);
    const joinedDate = item.joinedAt
      ? new Date(item.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;

    return (
      <View
        style={[
          styles.memberRow,
          { backgroundColor: theme.card, borderColor: theme.border },
          menuMemberId === item.id ? { zIndex: 100 } : null,
        ]}
      >
        <View style={{ position: 'relative' }}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '20', borderWidth: 2, borderColor: roleColor + '40' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {getInitials(item.fullName, item.email)}
            </Text>
          </View>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: isPending ? '#F59E0B' : '#22C55E', borderColor: theme.card },
            ]}
          />
        </View>

        <View style={styles.memberInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
              {item.fullName || item.email}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={[styles.memberEmail, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.email}
          </Text>

          {isAgent && item.agentLicenseNumber ? (
            <Text style={[styles.memberMeta, { color: theme.textSecondary }]}>
              License: {item.agentLicenseNumber}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {isPending ? (
              <View style={[styles.statusBadge, { backgroundColor: '#F59E0B20' }]}>
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.statusText, { color: '#F59E0B' }]}>Pending Invite</Text>
              </View>
            ) : (
              <Text style={[styles.memberMeta, { color: theme.textSecondary }]}>
                {joinedDate ? `Joined ${joinedDate}` : 'Active'}
              </Text>
            )}
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
            {item.status === 'active' && item.memberUserId ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuMemberId(null);
                  navigation.navigate('HostPublicProfile', { hostId: item.memberUserId });
                }}
              >
                <Feather name="user" size={14} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>View Profile</Text>
              </Pressable>
            ) : null}

            {isAgent && item.status === 'active' && item.memberUserId ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuMemberId(null);
                  navigation.navigate('AssignListings', {
                    agentId: item.memberUserId,
                    agentName: item.fullName || item.email,
                  });
                }}
              >
                <Feather name="home" size={14} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Assign Listings</Text>
              </Pressable>
            ) : null}

            {isPending ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => { setMenuMemberId(null); handleResend(item); }}
              >
                <Feather name="mail" size={14} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Resend Invite</Text>
              </Pressable>
            ) : null}

            <View style={[styles.menuSeparator, { backgroundColor: theme.border }]} />

            {item.role !== 'admin' ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => { setMenuMemberId(null); handleRoleChange(item, 'admin'); }}
              >
                <Feather name="shield" size={14} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Change to Admin</Text>
              </Pressable>
            ) : null}
            {item.role !== 'member' ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => { setMenuMemberId(null); handleRoleChange(item, 'member'); }}
              >
                <Feather name="users" size={14} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Change to Member</Text>
              </Pressable>
            ) : null}
            {item.role !== 'agent' ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => { setMenuMemberId(null); handleRoleChange(item, 'agent'); }}
              >
                <Feather name="briefcase" size={14} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Change to Agent</Text>
              </Pressable>
            ) : null}

            <View style={[styles.menuSeparator, { backgroundColor: theme.border }]} />

            <Pressable
              style={styles.menuItem}
              onPress={() => { setMenuMemberId(null); handleRemove(item); }}
            >
              <Feather name="user-minus" size={14} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Remove from Team</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const ownerRow = (
    <View style={[styles.memberRow, styles.ownerRow, { backgroundColor: theme.card, borderColor: '#F59E0B30' }]}>
      <View style={{ position: 'relative' }}>
        <View style={[styles.avatar, { backgroundColor: '#F59E0B20', borderWidth: 2, borderColor: '#F59E0B40' }]}>
          <Text style={[styles.avatarText, { color: '#F59E0B' }]}>
            {getInitials(user?.name)}
          </Text>
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: '#22C55E', borderColor: theme.card }]} />
      </View>
      <View style={styles.memberInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
            {user?.name}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: '#F59E0B20' }]}>
            <Text style={[styles.roleBadgeText, { color: '#F59E0B' }]}>Owner</Text>
          </View>
        </View>
        <Text style={[styles.memberEmail, { color: theme.textSecondary }]} numberOfLines={1}>
          {user?.email}
        </Text>
        <Text style={[styles.memberMeta, { color: theme.textSecondary, marginTop: 4 }]}>
          Account holder
        </Text>
      </View>
      <Feather name="award" size={16} color="#F59E0B" style={{ opacity: 0.6 }} />
    </View>
  );

  const seatFillPercent = Math.min(100, (activeCount / (seatLimit === Infinity ? activeCount + 5 : seatLimit)) * 100);
  const seatBarColor = atSeatLimit ? '#EF4444' : (activeCount / seatLimit > 0.75 ? '#F59E0B' : '#22C55E');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Your Team"
        subtitle={`${activeCount} of ${seatLimitDisplay} seats used · ${members.filter(m => m.role === 'agent').length} agents`}
        hideSeparator
        rightActions={
          <HeaderActionButton
            label="Invite"
            icon="user-plus"
            onPress={() => setShowInvite(true)}
            disabled={atSeatLimit}
          />
        }
      />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#3B82F620' }]}>
            <Feather name="users" size={16} color="#3B82F6" />
          </View>
          <Text style={[styles.statNumber, { color: theme.text }]}>{activeCount}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#34C75920' }]}>
            <Feather name="briefcase" size={16} color="#34C759" />
          </View>
          <Text style={[styles.statNumber, { color: theme.text }]}>{agents.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Agents</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
            <Feather name="clock" size={16} color="#F59E0B" />
          </View>
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {members.filter(m => m.status === 'pending').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
        </View>
      </View>

      <View style={[styles.seatSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.seatHeader}>
          <Text style={[styles.seatTitle, { color: theme.text }]}>Team Seats</Text>
          <Text style={[styles.seatCount, { color: theme.textSecondary }]}>
            {activeCount} / {seatLimitDisplay}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${seatFillPercent}%`, backgroundColor: seatBarColor },
            ]}
          />
        </View>
        {atSeatLimit ? (
          <Pressable onPress={() => navigation.navigate('HostSubscription')}>
            <Text style={styles.upgradeText}>
              Seat limit reached —{' '}
              <Text style={{ fontWeight: '700', color: '#ff6b5b' }}>Upgrade Plan</Text>
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <Pressable onPress={() => setMenuMemberId(null)} style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            {ownerRow}

            {staff.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Feather name="shield" size={14} color={theme.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                    Staff ({staff.length})
                  </Text>
                </View>
                {staff.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderMember({ item })}
                  </React.Fragment>
                ))}
              </>
            ) : null}

            {agents.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Feather name="briefcase" size={14} color="#34C759" />
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                    Agents ({agents.length})
                  </Text>
                </View>
                {agents.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderMember({ item })}
                  </React.Fragment>
                ))}
              </>
            ) : null}

            {members.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.card }]}>
                  <Feather name="user-plus" size={32} color={theme.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  Build your team
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Invite agents and staff to manage listings together.
                </Text>
                <Pressable
                  style={styles.emptyInviteBtn}
                  onPress={() => { if (!atSeatLimit) setShowInvite(true); }}
                >
                  <LinearGradient
                    colors={['#ff6b5b', '#e83a2a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyInviteBtnGrad}
                  >
                    <Feather name="user-plus" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                      Invite Your First Member
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
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
                <Pressable
                  style={[styles.roleCard, { backgroundColor: theme.background, borderColor: inviteRole === 'admin' ? theme.primary : theme.border }]}
                  onPress={() => setInviteRole('admin')}
                >
                  <Text style={[styles.roleCardTitle, { color: inviteRole === 'admin' ? theme.primary : theme.text }]}>Admin</Text>
                  <Text style={[styles.roleCardDesc, { color: theme.textSecondary }]}>Manage listings, inquiries, and invite members</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleCard, { backgroundColor: theme.background, borderColor: inviteRole === 'member' ? theme.primary : theme.border }]}
                  onPress={() => setInviteRole('member')}
                >
                  <Text style={[styles.roleCardTitle, { color: inviteRole === 'member' ? theme.primary : theme.text }]}>Member</Text>
                  <Text style={[styles.roleCardDesc, { color: theme.textSecondary }]}>Manage listings and respond to inquiries</Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.roleCard, { backgroundColor: theme.background, borderColor: inviteRole === 'agent' ? '#34C759' : theme.border, marginTop: 10 }]}
                onPress={() => setInviteRole('agent')}
              >
                <Text style={[styles.roleCardTitle, { color: inviteRole === 'agent' ? '#34C759' : theme.text }]}>Agent</Text>
                <Text style={[styles.roleCardDesc, { color: theme.textSecondary }]}>Licensed agent — gets their own profile, can be assigned to listings</Text>
              </Pressable>
            </View>

            {inviteRole === 'agent' ? (
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Agent License Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  value={agentLicense}
                  onChangeText={setAgentLicense}
                  placeholder="Enter agent's license number (optional)"
                  placeholderTextColor={theme.textSecondary + '60'}
                />
              </View>
            ) : null}

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
  subtitle: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  inviteBtn: {},
  inviteBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 10,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500' },

  seatSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  seatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  seatTitle: { fontSize: 13, fontWeight: '600' },
  seatCount: { fontSize: 13, fontWeight: '600' },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%' as any,
    borderRadius: 3,
  },
  upgradeText: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  list: {
    paddingHorizontal: Spacing.lg,
    gap: 10,
    paddingTop: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    position: 'relative',
  },
  ownerRow: {
    borderWidth: 1.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberEmail: { fontSize: 12 },
  memberMeta: { fontSize: 11 },
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

  menuBtn: { padding: 6 },
  menuDropdown: {
    position: 'absolute',
    right: 14,
    top: 56,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 100,
    minWidth: 180,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: { fontSize: 13, fontWeight: '500' },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },

  emptyWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 240, lineHeight: 21 },
  emptyInviteBtn: { marginTop: 8 },
  emptyInviteBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
