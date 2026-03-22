import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, Pressable, Switch,
  Alert, ActivityIndicator, StyleSheet, Platform,
  Share, Dimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

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
  getInviteCode,
  regenerateInviteCode,
} from '../../services/groupService';
import * as Clipboard from 'expo-clipboard';
import { GroupPropertySearchModal } from '../../components/GroupPropertySearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  route: { params: { groupId: string; groupName?: string } };
  navigation: any;
}

function Section({ label, children, action, theme }: {
  label: string;
  children: React.ReactNode;
  action?: { label: string; icon?: string; onPress: () => void };
  theme: any;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
        {action ? (
          <Pressable
            style={[styles.sectionActionBtn, { backgroundColor: theme.primary }]}
            onPress={action.onPress}
          >
            <Feather name={(action.icon || 'user-plus') as any} size={13} color="#fff" />
            <ThemedText style={{ fontSize: 13, color: '#fff', fontWeight: '700', marginLeft: 5 }}>
              {action.label}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SettingRow({ icon, label, description, value, onChange, theme }: {
  icon: string; label: string; description: string;
  value: boolean; onChange: (v: boolean) => void; theme: any;
}) {
  return (
    <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.settingIcon, { backgroundColor: theme.primary + '20' }]}>
        <Feather name={icon as any} size={15} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[Typography.body, { fontWeight: '600' }]}>{label}</ThemedText>
        <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>{description}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#fff"
      />
    </View>
  );
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
  const [inviteCode, setInviteCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [muted, setMuted] = useState(false);

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
        const allProfiles = await StorageService.getRoommateProfiles();

        const buildMembers = (memberIds: string[]) => {
          return memberIds.map(mid => {
            const profile = allProfiles.find((p: any) => p.id === mid);
            if (profile) {
              return {
                id: mid,
                name: profile.name || 'Unknown',
                photo: profile.photos?.[0] || profile.profilePicture || null,
                role: profile.role || 'renter',
                isAdmin: mid === (localGroup?.createdBy || user?.id),
                isHost: profile.role === 'host',
              };
            }
            if (mid === user?.id) {
              return {
                id: mid,
                name: user?.name || 'You',
                photo: user?.photos?.[0] || null,
                role: user?.role || 'renter',
                isAdmin: true,
                isHost: false,
              };
            }
            return { id: mid, name: 'Member', photo: null, role: 'renter', isAdmin: false, isHost: false };
          });
        };

        if (localGroup) {
          const memberIds = localGroup.members?.length ? localGroup.members : [user?.id || 'demo-user'];
          const members = buildMembers(memberIds);
          setGroup({
            id: localGroup.id,
            name: localGroup.name || routeGroupName || 'Group',
            description: localGroup.description || '',
            type: localGroup.type || 'roommate',
            adminId: localGroup.createdBy || user?.id,
            members,
            memberCount: members.length,
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
            photo: user?.photos?.[0] || null,
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

  async function loadInviteCode() {
    try {
      const code = await getInviteCode(groupId);
      setInviteCode(code);
    } catch {
      const groups = await StorageService.getGroups();
      const g = groups.find((gr: any) => gr.id === groupId);
      if (g && (g as any).inviteCode) {
        setInviteCode((g as any).inviteCode);
      } else {
        const fallback = Math.random().toString(36).substring(2, 8).toUpperCase();
        setInviteCode(fallback);
        if (g) {
          (g as any).inviteCode = fallback;
          await StorageService.setGroups(groups);
        }
      }
    }
  }

  useEffect(() => {
    loadInviteCode();
  }, [groupId]);

  async function handleCopyCode() {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(inviteCode);
      } else {
        await Clipboard.setStringAsync(inviteCode);
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  }

  async function handleShareCode() {
    const deepLink = Linking.createURL('join-group', { queryParams: { code: inviteCode, group: group?.name || '' } });
    try {
      await Share.share({
        message: `Join my group "${group?.name}" on Roomdr!\n\nTap to join: ${deepLink}\n\nOr enter code: ${inviteCode}`,
      });
    } catch {}
  }

  async function handleRegenerateCode() {
    const doRegen = async () => {
      try {
        const newCode = await regenerateInviteCode(groupId);
        setInviteCode(newCode);
      } catch {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        setInviteCode(newCode);
        try {
          const groups = await StorageService.getGroups();
          const g = groups.find((gr: any) => gr.id === groupId);
          if (g) {
            (g as any).inviteCode = newCode;
            await StorageService.setGroups(groups);
          }
        } catch {}
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Generate a new invite code? The old code will stop working.')) {
        doRegen();
      }
    } else {
      Alert.alert('Regenerate Code?', 'The old code will stop working.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: doRegen },
      ]);
    }
  }

  function filterMemberFromStorage(members: any[], targetId: string): any[] {
    return (members || []).filter((m: any) => {
      const mid = typeof m === 'string' ? m : (m.id || m.user_id);
      return mid !== targetId;
    });
  }

  function handleRemoveMember(memberId: string, memberName: string) {
    const doRemove = async () => {
      setRemovingId(memberId);
      let success = false;
      try {
        await removeMember(groupId, memberId);
        success = true;
      } catch {
        try {
          const groups = await StorageService.getGroups();
          const idx = groups.findIndex((g: any) => g.id === groupId);
          if (idx >= 0) {
            const g = groups[idx] as any;
            g.members = filterMemberFromStorage(g.members, memberId);
            await StorageService.setGroups(groups);
            success = true;
          }
        } catch {}
      }
      if (success) {
        setGroup((prev: any) => ({
          ...prev,
          members: prev.members.filter((m: any) => m.id !== memberId),
        }));
      } else {
        const msg = 'Could not remove member.';
        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
      }
      setRemovingId(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${memberName} from the group?`)) {
        doRemove();
      }
    } else {
      Alert.alert(
        `Remove ${memberName}?`,
        `${memberName} will be removed from the group.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ]
      );
    }
  }

  function handlePromoteMember(memberId: string, memberName: string) {
    const doPromote = async () => {
      let success = false;
      try {
        await promoteMember(groupId, memberId);
        success = true;
      } catch {
        try {
          const groups = await StorageService.getGroups();
          const idx = groups.findIndex((g: any) => g.id === groupId);
          if (idx >= 0) {
            (groups[idx] as any).createdBy = memberId;
            await StorageService.setGroups(groups);
            success = true;
          }
        } catch {}
      }
      if (success) {
        setGroup((prev: any) => ({ ...prev, adminId: memberId }));
      } else {
        const msg = 'Could not promote member.';
        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Promote ${memberName} to admin? You will become a regular member.`)) {
        doPromote();
      }
    } else {
      Alert.alert(
        `Promote ${memberName}?`,
        `${memberName} will become the new admin. You will become a regular member.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Promote', onPress: doPromote },
        ]
      );
    }
  }

  async function handleLeaveGroup() {
    if (isAdmin && memberCount > 1) {
      if (Platform.OS === 'web') {
        if (window.confirm('You are the admin. Promote another member before leaving. Go to promote screen?')) {
          navigation.navigate('PromoteAdmin', {
            groupId,
            groupName: group?.name || routeGroupName || 'Group',
          });
        }
      } else {
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
      }
      return;
    }

    const isLastMember = memberCount <= 1;
    const doLeave = async () => {
      let success = false;
      try {
        await leaveGroup(groupId);
        success = true;
      } catch (err: any) {
        if (err.message === 'PROMOTE_REQUIRED') {
          navigation.navigate('PromoteAdmin', {
            groupId,
            groupName: group?.name || routeGroupName || 'Group',
          });
          return;
        }
        try {
          const groups = await StorageService.getGroups();
          if (isLastMember) {
            await StorageService.setGroups(groups.filter((g: any) => g.id !== groupId));
          } else {
            const idx = groups.findIndex((g: any) => g.id === groupId);
            if (idx >= 0) {
              const g = groups[idx] as any;
              g.members = filterMemberFromStorage(g.members, user?.id || '');
              await StorageService.setGroups(groups);
            }
          }
          success = true;
        } catch {}
      }
      if (success) {
        navigation.popToTop();
      } else {
        const msg = 'Could not leave group.';
        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
      }
    };

    const title = isLastMember ? 'Delete Group?' : 'Leave Group?';
    const msg = isLastMember
      ? 'You are the last member. Leaving will permanently delete this group.'
      : 'Are you sure you want to leave this group?';

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${msg}`)) {
        doLeave();
      }
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: isLastMember ? 'Delete' : 'Leave', style: 'destructive', onPress: doLeave },
      ]);
    }
  }

  async function handleDeleteGroup() {
    const doDelete = async () => {
      let success = false;
      try {
        await leaveGroup(groupId);
        success = true;
      } catch {
        try {
          const groups = await StorageService.getGroups();
          await StorageService.setGroups(groups.filter((g: any) => g.id !== groupId));
          success = true;
        } catch {}
      }
      if (success) {
        navigation.popToTop();
      } else {
        const msg = 'Could not delete group.';
        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete Group?\nThis will permanently delete the group and all its messages. This cannot be undone.')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Group?',
        'This will permanently delete the group and all its messages. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Group', style: 'destructive', onPress: doDelete },
        ]
      );
    }
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
    const doRemove = async () => {
      let success = false;
      try {
        await linkListingToGroup(groupId, null);
        success = true;
      } catch {
        try {
          const groups = await StorageService.getGroups();
          const idx = groups.findIndex((g: any) => g.id === groupId);
          if (idx >= 0) {
            (groups[idx] as any).linkedListing = null;
            (groups[idx] as any).listing_id = null;
            await StorageService.setGroups(groups);
            success = true;
          }
        } catch {}
      }
      if (success) {
        setGroup((p: any) => ({ ...p, linkedListing: null }));
      } else {
        const msg = 'Could not remove property.';
        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Remove Property?\nThe group will no longer be linked to this listing.')) {
        doRemove();
      }
    } else {
      Alert.alert(
        'Remove Property?',
        'The group will no longer be linked to this listing.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ]
      );
    }
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
            style={[styles.backBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 20 }]}
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

  const inviteCodeChars = (inviteCode || 'XXXXXX').split('');

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[theme.primary + '40', theme.primary + '08', theme.background]}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={[styles.heroBackBtn, { backgroundColor: theme.card, borderColor: theme.border, top: insets.top + 16 }]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>

          {(() => {
            const memberPhotos = (group.members || [])
              .map((m: any) => ({ uri: m.photo, initial: (m.name || '?').charAt(0).toUpperCase() }))
              .slice(0, 4);
            if (memberPhotos.length === 0 || memberPhotos.every((p: any) => !p.uri)) {
              return (
                <View style={[styles.heroAvatar, { backgroundColor: theme.primary }]}>
                  <Feather name="users" size={36} color="#fff" />
                </View>
              );
            }
            if (memberPhotos.length === 1) {
              const p = memberPhotos[0];
              return p.uri ? (
                <Image source={{ uri: p.uri }} style={[styles.heroAvatar, { borderWidth: 3, borderColor: '#fff' }]} />
              ) : (
                <View style={[styles.heroAvatar, { backgroundColor: theme.primary }]}>
                  <ThemedText style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{p.initial}</ThemedText>
                </View>
              );
            }
            const sz = memberPhotos.length <= 2 ? 52 : 44;
            const overlap = 14;
            const totalW = sz + (memberPhotos.length - 1) * (sz - overlap);
            return (
              <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: totalW, height: sz, flexDirection: 'row' }}>
                  {memberPhotos.map((p: any, i: number) =>
                    p.uri ? (
                      <Image
                        key={i}
                        source={{ uri: p.uri }}
                        style={{
                          width: sz, height: sz, borderRadius: sz / 2,
                          borderWidth: 2, borderColor: '#fff',
                          position: 'absolute', left: i * (sz - overlap), zIndex: memberPhotos.length - i,
                        }}
                      />
                    ) : (
                      <View
                        key={i}
                        style={{
                          width: sz, height: sz, borderRadius: sz / 2,
                          backgroundColor: theme.primary, borderWidth: 2, borderColor: '#fff',
                          alignItems: 'center', justifyContent: 'center',
                          position: 'absolute', left: i * (sz - overlap), zIndex: memberPhotos.length - i,
                        }}
                      >
                        <ThemedText style={{ fontSize: sz * 0.36, fontWeight: '800', color: '#fff' }}>{p.initial}</ThemedText>
                      </View>
                    )
                  )}
                </View>
              </View>
            );
          })()}

          <ThemedText style={[Typography.h2, styles.heroName]}>
            {group.name}
          </ThemedText>

          {group.description ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: Spacing.xl }]}>
              {group.description}
            </ThemedText>
          ) : null}

          <View style={styles.chipRow}>
            {group.minBudget ? (
              <View style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="dollar-sign" size={12} color={theme.primary} />
                <ThemedText style={[Typography.small, { color: theme.text, marginLeft: 4 }]}>
                  Min ${group.minBudget.toLocaleString()}/mo
                </ThemedText>
              </View>
            ) : null}
            {group.targetNeighborhood ? (
              <View style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="map-pin" size={12} color={theme.primary} />
                <ThemedText style={[Typography.small, { color: theme.text, marginLeft: 4 }]}>
                  {group.targetNeighborhood}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <Section label="LINKED PROPERTY" theme={theme}>
          {group.linkedListing ? (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.body, { fontWeight: '700' }]} numberOfLines={1}>
                  {group.linkedListing.title}
                </ThemedText>
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                  {group.linkedListing.bedrooms}BR · {group.linkedListing.city} · ${group.linkedListing.rent?.toLocaleString() || group.linkedListing.price?.toLocaleString()}/mo
                </ThemedText>
                {group.linkedListing.status === 'rented' ? (
                  <View style={styles.rentedBadge}>
                    <ThemedText style={[Typography.small, { color: '#FF6B6B', fontWeight: '700', fontSize: 10 }]}>
                      RENTED
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {isAdmin ? (
                <Pressable onPress={handleRemoveProperty} hitSlop={8}>
                  <ThemedText style={[Typography.small, { color: '#FF6B6B' }]}>Remove</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : isAdmin ? (
            <Pressable
              style={[styles.dashedCard, { borderColor: theme.primary }]}
              onPress={() => setShowPropertySearch(true)}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: 8, fontWeight: '600' }]}>
                Link a Property
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              No property linked yet.
            </ThemedText>
          )}
        </Section>

        <Section
          label={`MEMBERS (${memberCount}/${memberLimit})`}
          action={
            isAdmin && memberCount < memberLimit
              ? {
                  label: 'Add',
                  icon: 'user-plus',
                  onPress: () => navigation.navigate('GroupInvite', {
                    groupId,
                    groupName: group.name,
                    listingId: group.linkedListing?.id || null,
                  }),
                }
              : undefined
          }
          theme={theme}
        >
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
                  <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '25', alignItems: 'center', justifyContent: 'center' }]}>
                    <ThemedText style={[Typography.body, { fontWeight: '800', color: theme.primary }]}>
                      {(member.name || '?').charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <ThemedText style={[Typography.body, { fontWeight: '700' }]}>
                      {member.name}{isCurrentUser ? ' (you)' : ''}
                    </ThemedText>
                    {isMemberAdmin ? (
                      <View style={[styles.adminBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Feather name="award" size={9} color={theme.primary} />
                        <ThemedText style={{ fontSize: 10, color: theme.primary, marginLeft: 3, fontWeight: '700' }}>
                          Admin
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                    {member.role === 'host' ? 'Host' : 'Renter'}
                    {member.verified ? ' · Verified' : ''}
                  </ThemedText>
                </View>

                {isAdmin && !isCurrentUser && !isMemberAdmin ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: theme.primary }]}
                      onPress={() => handlePromoteMember(member.id, member.name)}
                    >
                      <Feather name="arrow-up" size={13} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: '#FF6B6B' }]}
                      onPress={() => handleRemoveMember(member.id, member.name)}
                      disabled={isRemoving}
                    >
                      {isRemoving ? (
                        <ActivityIndicator size="small" color="#FF6B6B" />
                      ) : (
                        <Feather name="x" size={13} color="#FF6B6B" />
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={[styles.inviteCodeCard, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
            <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.sm }]}>
              INVITE CODE
            </ThemedText>

            <Pressable onPress={handleCopyCode}>
              <View style={styles.codeBoxRow}>
                {inviteCodeChars.map((char: string, i: number) => (
                  <View
                    key={i}
                    style={[styles.codeCharBox, { backgroundColor: theme.card, borderColor: theme.border }]}
                  >
                    <ThemedText style={[styles.codeChar, { color: theme.primary }]}>
                      {char}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Pressable>

            <View style={styles.codeActions}>
              <Pressable
                style={[styles.codeActionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={handleCopyCode}
              >
                <Feather
                  name={codeCopied ? 'check' : 'copy'}
                  size={14}
                  color={codeCopied ? '#22C55E' : theme.text}
                />
                <ThemedText style={[Typography.small, { marginLeft: 6, color: codeCopied ? '#22C55E' : theme.text, fontWeight: '600' }]}>
                  {codeCopied ? 'Copied!' : 'Copy'}
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.codeActionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={handleShareCode}
              >
                <Feather name="share-2" size={14} color="#fff" />
                <ThemedText style={[Typography.small, { marginLeft: 6, color: '#fff', fontWeight: '700' }]}>
                  Share Invite
                </ThemedText>
              </Pressable>
            </View>

            {isAdmin ? (
              <Pressable onPress={handleRegenerateCode} style={{ alignItems: 'center', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="refresh-cw" size={12} color={theme.textSecondary} />
                  <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 4 }]}>
                    Regenerate code
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
          </View>

          {isAdmin ? (
            <Pressable
              style={[styles.inviteRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate('GroupInvite', {
                groupId,
                groupName: group.name,
                listingId: group.linkedListing?.id || null,
                defaultTab: 'matches',
              })}
            >
              <View style={[styles.inviteIcon, { backgroundColor: theme.primary + '20' }]}>
                <Feather name="heart" size={15} color={theme.primary} />
              </View>
              <ThemedText style={[Typography.body, { flex: 1, fontWeight: '500' }]}>
                Invite from Matches
              </ThemedText>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.inviteRow, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleInviteViaText}
          >
            <View style={[styles.inviteIcon, { backgroundColor: '#10B98120' }]}>
              <Feather name="message-circle" size={15} color="#10B981" />
            </View>
            <ThemedText style={[Typography.body, { flex: 1, fontWeight: '500' }]}>
              Invite via Text Message
            </ThemedText>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        </Section>

        <Section label="SETTINGS" theme={theme}>
          {isAdmin ? (
            <SettingRow
              icon="compass"
              label="Discoverable"
              description="Let others find and request to join"
              value={group.discoverable ?? false}
              onChange={handleDiscoverableToggle}
              theme={theme}
            />
          ) : null}
          <SettingRow
            icon="bell-off"
            label="Mute Notifications"
            description="Silence messages from this group"
            value={muted}
            onChange={setMuted}
            theme={theme}
          />
        </Section>

        <View style={[styles.section, { marginTop: Spacing.sm }]}>
          {isAdmin ? (
            <Pressable
              style={[styles.dangerBtn, { borderColor: '#FF6B6B', marginBottom: 10 }]}
              onPress={handleDeleteGroup}
            >
              <Feather name="trash-2" size={16} color="#FF6B6B" />
              <ThemedText style={[Typography.body, { color: '#FF6B6B', fontWeight: '600', marginLeft: 8 }]}>
                Delete Group
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.dangerBtn, { borderColor: '#FF6B6B' }]}
            onPress={handleLeaveGroup}
          >
            <Feather name="log-out" size={16} color="#FF6B6B" />
            <ThemedText style={[Typography.body, { color: '#FF6B6B', fontWeight: '600', marginLeft: 8 }]}>
              Leave Group
            </ThemedText>
          </Pressable>

          {!isAdmin ? (
            <Pressable style={styles.reportBtn} onPress={() => {
              if (Platform.OS === 'web') {
                window.alert('This group has been reported.');
              } else {
                Alert.alert('Report', 'This group has been reported.');
              }
            }}>
              <Feather name="flag" size={13} color={theme.textSecondary} />
              <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: 6 }]}>
                Report this group
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <GroupPropertySearchModal
        visible={showPropertySearch}
        memberCount={memberCount}
        onClose={() => setShowPropertySearch(false)}
        onSelect={async (listing: any) => {
          setShowPropertySearch(false);
          let success = false;
          try {
            await linkListingToGroup(groupId, listing.id);
            success = true;
          } catch {
            try {
              const groups = await StorageService.getGroups();
              const idx = groups.findIndex((g: any) => g.id === groupId);
              if (idx >= 0) {
                (groups[idx] as any).linkedListing = listing;
                (groups[idx] as any).listing_id = listing.id;
                await StorageService.setGroups(groups);
                success = true;
              }
            } catch {}
          }
          if (success) {
            setGroup((p: any) => ({ ...p, linkedListing: listing }));
          } else {
            const msg = 'Could not link property.';
            if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
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
  hero: {
    alignItems: 'center',
    paddingBottom: Spacing.xl,
    position: 'relative',
  },
  heroBackBtn: {
    position: 'absolute',
    top: 0,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 10,
  },
  heroAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroName: { textAlign: 'center', marginTop: 4 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  dashedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rentedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF6B6B20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCodeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  codeBoxRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  codeCharBox: {
    width: 42,
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  codeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  inviteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
});
