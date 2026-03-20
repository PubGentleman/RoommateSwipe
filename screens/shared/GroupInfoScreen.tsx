import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, Pressable, Switch,
  Alert, ActivityIndicator, StyleSheet, Platform,
  Share, Linking,
} from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import { Feather } from '../../components/VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { Image } from 'expo-image';
import {
  getGroupDetails,
  removeMember,
  promoteMember,
  leaveGroup,
  setGroupDiscoverable,
  linkListingToGroup,
} from '../../services/groupService';
import { GroupPropertySearchModal } from '../../components/GroupPropertySearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';

interface Props {
  route: { params: { groupId: string; groupName?: string } };
  navigation: any;
}

export function GroupInfoScreen({ route, navigation }: Props) {
  const { groupId, groupName: routeGroupName } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showPropertySearch, setShowPropertySearch] = useState(false);

  const isAdmin = group?.adminId === user?.id;
  const memberCount = group?.members?.length || 0;
  const memberLimit = group?.memberLimit ?? 4;

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  async function loadGroup() {
    setLoading(true);
    try {
      const data = await getGroupDetails(groupId);
      setGroup(data);
    } catch (err: any) {
      console.warn('[GroupInfoScreen] Supabase failed, using local fallback:', err.message);
      try {
        const groups = await StorageService.getGroups();
        const localGroup = groups.find((g: any) => g.id === groupId);
        if (localGroup) {
          setGroup({
            id: localGroup.id,
            name: localGroup.name || routeGroupName || 'Group',
            description: localGroup.description || '',
            type: localGroup.type || 'roommate',
            adminId: user?.id,
            members: [{
              id: user?.id || 'demo-user',
              name: user?.name || 'You',
              photo: user?.photos?.[0] || null,
              role: user?.role || 'renter',
              isAdmin: true,
              isHost: false,
            }],
            memberCount: localGroup.memberCount || 1,
            memberLimit: localGroup.maxMembers || 4,
            linkedListing: localGroup.linkedListing || null,
            discoverable: localGroup.discoverable !== false,
            minBudget: localGroup.budgetMin || null,
            targetNeighborhood: localGroup.city || null,
          });
        } else {
          setGroup({
            id: groupId,
            name: routeGroupName || 'Group',
            description: '',
            type: 'roommate',
            adminId: user?.id,
            members: [{
              id: user?.id || 'demo-user',
              name: user?.name || 'You',
              photo: user?.photos?.[0] || null,
              role: user?.role || 'renter',
              isAdmin: true,
              isHost: false,
            }],
            memberCount: 1,
            memberLimit: 4,
            linkedListing: null,
            discoverable: true,
            minBudget: null,
            targetNeighborhood: null,
          });
        }
      } catch {
        setGroup({
          id: groupId,
          name: routeGroupName || 'Group',
          description: '',
          type: 'roommate',
          adminId: user?.id,
          members: [{
            id: user?.id || 'demo-user',
            name: user?.name || 'You',
            photo: null,
            role: 'renter',
            isAdmin: true,
            isHost: false,
          }],
          memberCount: 1,
          memberLimit: 4,
          linkedListing: null,
          discoverable: true,
          minBudget: null,
          targetNeighborhood: null,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveMember(memberId: string, memberName: string) {
    Alert.alert(
      `Remove ${memberName}?`,
      `${memberName} will be removed from the group.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(memberId);
            try {
              await removeMember(groupId, memberId);
              setGroup((prev: any) => ({
                ...prev,
                members: prev.members.filter((m: any) => m.id !== memberId),
              }));
            } catch {
              Alert.alert('Error', 'Could not remove member.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  }

  function handlePromoteMember(memberId: string, memberName: string) {
    Alert.alert(
      `Promote ${memberName}?`,
      `${memberName} will become the new admin. You will become a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await promoteMember(groupId, memberId);
              setGroup((prev: any) => ({ ...prev, adminId: memberId }));
            } catch {
              Alert.alert('Error', 'Could not promote member.');
            }
          },
        },
      ]
    );
  }

  async function handleLeaveGroup() {
    if (isAdmin && memberCount > 1) {
      Alert.alert(
        'Promote Someone First',
        'You are the admin. Promote another member before leaving.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Promote',
            onPress: () => navigation.navigate('PromoteAdmin', {
              groupId,
              groupName: group?.name || routeGroupName || 'Group',
            }),
          },
        ]
      );
      return;
    }

    const isLastMember = memberCount <= 1;
    Alert.alert(
      isLastMember ? 'Delete Group?' : 'Leave Group?',
      isLastMember
        ? 'You are the last member. Leaving will permanently delete this group.'
        : 'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isLastMember ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(groupId);
              navigation.popToTop();
            } catch (err: any) {
              if (err.message === 'PROMOTE_REQUIRED') {
                navigation.navigate('PromoteAdmin', {
                  groupId,
                  groupName: group?.name || routeGroupName || 'Group',
                });
              } else {
                Alert.alert('Error', err.message || 'Could not leave group.');
              }
            }
          },
        },
      ]
    );
  }

  function handleDiscoverableToggle(value: boolean) {
    if (!value) {
      const doTurnOff = () => {
        setGroup((p: any) => ({ ...p, discoverable: false }));
        applyDiscoverable(false);
      };
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          'Turning off discoverable means other users won\'t be able to find or request to join your group. Are you sure?'
        );
        if (confirmed) doTurnOff();
      } else {
        Alert.alert(
          'Turn Off Discoverable?',
          'Other users won\'t be able to find or request to join your group. Are you sure?',
          [
            { text: 'Keep On', style: 'cancel' },
            { text: 'Turn Off', style: 'destructive', onPress: doTurnOff },
          ]
        );
      }
    } else {
      setGroup((p: any) => ({ ...p, discoverable: true }));
      applyDiscoverable(true);
    }
  }

  async function applyDiscoverable(value: boolean) {
    try {
      await setGroupDiscoverable(groupId, value);
    } catch {
      try {
        const groups = await StorageService.getGroups();
        const idx = groups.findIndex((g: any) => g.id === groupId);
        if (idx >= 0) {
          (groups[idx] as any).discoverable = value;
          await StorageService.setGroups(groups);
        }
      } catch {}
    }
  }

  async function handleRemoveProperty() {
    Alert.alert(
      'Remove Property?',
      'The group will no longer be linked to this listing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await linkListingToGroup(groupId, null);
              setGroup((p: any) => ({ ...p, linkedListing: null }));
            } catch {
              Alert.alert('Error', 'Could not remove property.');
            }
          },
        },
      ]
    );
  }

  async function handleInviteViaText() {
    const name = group?.name || routeGroupName || 'my group';
    const inviteMsg = `Join my group "${name}" on Roomdr!\n\nDownload the app at roomdr.com`;
    if (Platform.OS === 'web') {
      try { await Share.share({ message: inviteMsg }); } catch {}
    } else {
      const smsUrl = Platform.OS === 'ios'
        ? `sms:&body=${encodeURIComponent(inviteMsg)}`
        : `sms:?body=${encodeURIComponent(inviteMsg)}`;
      try { await Linking.openURL(smsUrl); } catch {
        try { await Share.share({ message: inviteMsg }); } catch {}
      }
    }
  }

  if (loading || !group) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={[styles.backBtn, { backgroundColor: theme.card || theme.backgroundDefault, borderWidth: 1, borderColor: theme.border, borderRadius: 20 }]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>Group Info</ThemedText>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.headerBar, { borderBottomColor: theme.border, paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={[styles.backBtn, { backgroundColor: theme.card || theme.backgroundDefault, borderWidth: 1, borderColor: theme.border, borderRadius: 20 }]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h3, { flex: 1, textAlign: 'center' }]}>Group Info</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.identityCard, { backgroundColor: theme.card }]}>
          <View style={[styles.bigAvatar, { backgroundColor: theme.primary }]}>
            <Feather name="users" size={32} color="#fff" />
          </View>
          <ThemedText style={[Typography.h2, { textAlign: 'center', marginTop: Spacing.sm }]}>
            {group.name}
          </ThemedText>
          {group.description ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              {group.description}
            </ThemedText>
          ) : null}
          <View style={styles.metaRow}>
            {group.minBudget ? (
              <View style={styles.metaChip}>
                <Feather name="dollar-sign" size={12} color={theme.textSecondary} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 4 }]}>
                  Min ${group.minBudget.toLocaleString()}/mo
                </ThemedText>
              </View>
            ) : null}
            {group.targetNeighborhood ? (
              <View style={styles.metaChip}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 4 }]}>
                  {group.targetNeighborhood}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.small, styles.sectionLabel, { color: theme.textSecondary }]}>
            LINKED PROPERTY
          </ThemedText>
          {group.linkedListing ? (
            <View style={[styles.propertyRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                  {group.linkedListing.title}
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  {group.linkedListing.bedrooms}BR · {group.linkedListing.city} · ${group.linkedListing.rent?.toLocaleString()}/mo
                </ThemedText>
                {group.linkedListing.status === 'rented' ? (
                  <View style={styles.rentedBadge}>
                    <ThemedText style={[Typography.small, { color: '#EF4444', fontWeight: '700', fontSize: 10 }]}>
                      RENTED
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {isAdmin ? (
                <Pressable onPress={handleRemoveProperty} hitSlop={8}>
                  <ThemedText style={[Typography.small, { color: '#EF4444' }]}>Remove</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : isAdmin ? (
            <Pressable
              style={[styles.addPropertyBtn, { borderColor: theme.primary }]}
              onPress={() => setShowPropertySearch(true)}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: 8 }]}>
                Link a Property
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              No property linked yet.
            </ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={[Typography.small, styles.sectionLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
              MEMBERS ({memberCount}/{memberLimit})
            </ThemedText>
            {isAdmin && memberCount < memberLimit ? (
              <Pressable
                style={[styles.addMembersBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('GroupInvite', {
                  groupId,
                  groupName: group.name,
                  listingId: group.linkedListing?.id || null,
                })}
              >
                <Feather name="user-plus" size={14} color="#fff" />
                <ThemedText style={[Typography.small, { color: '#fff', fontWeight: '700', marginLeft: 6 }]}>
                  Add
                </ThemedText>
              </Pressable>
            ) : isAdmin ? (
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>Group full</ThemedText>
            ) : null}
          </View>

          {(group.members || []).map((member: any) => {
            const isCurrentUser = member.id === user?.id;
            const isMemberAdmin = member.id === group.adminId;
            const isRemoving = removingId === member.id;

            return (
              <View
                key={member.id}
                style={[styles.memberRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                {member.photo ? (
                  <Image source={{ uri: member.photo }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '30', alignItems: 'center', justifyContent: 'center' }]}>
                    <ThemedText style={[Typography.body, { fontWeight: '700', color: theme.primary }]}>
                      {(member.name || '?').charAt(0)}
                    </ThemedText>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                      {member.name}{isCurrentUser ? ' (you)' : ''}
                    </ThemedText>
                    {isMemberAdmin ? (
                      <View style={[styles.adminBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Feather name="award" size={10} color={theme.primary} />
                        <ThemedText style={[Typography.small, { color: theme.primary, marginLeft: 3, fontSize: 10 }]}>
                          Admin
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {member.role ? (
                    <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                      {member.role === 'host' ? 'Host' : 'Renter'}
                    </ThemedText>
                  ) : null}
                </View>

                {isAdmin && !isCurrentUser && !isMemberAdmin ? (
                  <View style={styles.adminActions}>
                    <Pressable
                      style={[styles.actionBtn, { borderColor: theme.primary }]}
                      onPress={() => handlePromoteMember(member.id, member.name)}
                    >
                      <Feather name="arrow-up" size={13} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { borderColor: '#EF4444', marginLeft: 6 }]}
                      onPress={() => handleRemoveMember(member.id, member.name)}
                      disabled={isRemoving}
                    >
                      {isRemoving ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Feather name="x" size={13} color="#EF4444" />
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Pressable
            style={[styles.textInviteBtn, { borderColor: theme.border }]}
            onPress={handleInviteViaText}
          >
            <Feather name="message-circle" size={16} color="#10B981" />
            <ThemedText style={[Typography.body, { color: theme.text, marginLeft: 8, flex: 1 }]}>
              Invite via Text Message
            </ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.small, styles.sectionLabel, { color: theme.textSecondary }]}>
              SETTINGS
            </ThemedText>
            <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.body, { fontWeight: '600' }]}>
                  Discoverable
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                  Allow others to find and request to join
                </ThemedText>
              </View>
              <Switch
                value={group.discoverable ?? false}
                onValueChange={handleDiscoverableToggle}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        ) : null}

        <View style={[styles.section, { marginTop: Spacing.lg }]}>
          <Pressable
            style={[styles.leaveBtn, { borderColor: '#EF4444' }]}
            onPress={handleLeaveGroup}
          >
            <Feather name="log-out" size={16} color="#EF4444" />
            <ThemedText style={[Typography.body, { color: '#EF4444', fontWeight: '600', marginLeft: 8 }]}>
              Leave Group
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <GroupPropertySearchModal
        visible={showPropertySearch}
        memberCount={memberCount}
        onClose={() => setShowPropertySearch(false)}
        onSelect={async (listing: any) => {
          setShowPropertySearch(false);
          try {
            await linkListingToGroup(groupId, listing.id);
            setGroup((p: any) => ({ ...p, linkedListing: listing }));
          } catch {
            Alert.alert('Error', 'Could not link property.');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  bigAvatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginTop: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center',
  },
  metaChip: { flexDirection: 'row', alignItems: 'center' },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  sectionLabel: { fontWeight: '700', letterSpacing: 0.5, marginBottom: Spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  addMembersBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  propertyRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1,
  },
  rentedBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginTop: 4, backgroundColor: '#FEE2E2',
  },
  addPropertyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1,
    marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  memberAvatar: {
    width: 42, height: 42, borderRadius: 21,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  adminActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  textInviteBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1,
    marginTop: Spacing.xs,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: 12, borderWidth: 1,
  },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5,
  },
});
