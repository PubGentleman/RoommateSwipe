import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, Pressable, Switch,
  ActivityIndicator, StyleSheet, Platform,
  Share, Dimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '../../components/ThemedText';
import { Feather } from '../../components/VectorIcons';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing } from '../../constants/theme';
import { BETA_MODE } from '../../constants/betaConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Image } from 'expo-image';
import { getSuggestedGroupMembers } from '../../utils/groupSuggestions';
import { getGroupHealth, GroupHealthResult } from '../../utils/groupHealthScore';
import { normalizeRenterPlan, getRenterPlanLimits } from '../../constants/renterPlanLimits';
import { getCachedOrGenerateInsight } from '../../services/piMatchingService';
import { PlanBadgeInline } from '../../components/LockedFeatureOverlay';
import {
  getGroupDetails,
  removeMember,
  promoteMember,
  leaveGroup,
  setGroupDiscoverable,
  linkListingToGroup,
  getInviteCode,
  regenerateInviteCode,
  getGroupLikers,
  adminLikeBack,
  dismissGroupLiker,
} from '../../services/groupService';
import * as Clipboard from 'expo-clipboard';
import { GroupPropertySearchModal } from '../../components/GroupPropertySearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useConfirm } from '../../contexts/ConfirmContext';
import { StorageService } from '../../utils/storage';
import { ReportBlockModal } from '../../components/ReportBlockModal';
import { reportGroup, reportUser, blockUser as blockUserRemote } from '../../services/moderationService';
import { EventCard } from '../../components/EventCard';
import { getGroupEvents, type RhomeEvent } from '../../services/eventService';
import { createErrorHandler } from '../../utils/errorLogger';

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
            accessibilityLabel={action.label}
            accessibilityRole="button"
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
        accessibilityLabel={`${label}${value ? ', enabled' : ', disabled'}`}
        accessibilityRole="switch"
      />
    </View>
  );
}

export function GroupInfoScreen({ route, navigation }: Props) {
  const { groupId, groupName: routeGroupName } = route.params;
  const { theme } = useTheme();
  const { user, blockUser: blockUserLocal } = useAuth();
  const insets = useSafeAreaInsets();
  const { confirm, alert } = useConfirm();
  const renterPlan = normalizeRenterPlan(user?.subscription?.plan);
  const renterLimits = getRenterPlanLimits(renterPlan);

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showPropertySearch, setShowPropertySearch] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ profile: any; groupScore: number; reason: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [health, setHealth] = useState<GroupHealthResult | null>(null);
  const [groupLikers, setGroupLikers] = useState<any[]>([]);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [memberPiSummaries, setMemberPiSummaries] = useState<Record<string, string>>({});
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [showMemberReport, setShowMemberReport] = useState(false);
  const [reportMemberTarget, setReportMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [groupChatSettings, setGroupChatSettings] = useState<Record<string, any>>({});
  const [groupEvents, setGroupEvents] = useState<RhomeEvent[]>([]);

  const isAdmin = group?.adminId === user?.id;
  const memberCount = group?.members?.length || 0;
  const memberLimit = group?.memberLimit ?? 4;
  const isRenter = user?.role === 'renter';
  const canSeeAI = BETA_MODE || user?.plan === 'plus' || user?.plan === 'elite';
  const desiredBedrooms = group?.desiredBedrooms ?? group?.memberLimit ?? 4;
  const spotsNeeded = Math.max(0, desiredBedrooms - memberCount);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => {
    if (!group || !user || !isRenter) return;
    if (canSeeAI && spotsNeeded > 0) {
      setLoadingSuggestions(true);
      getSuggestedGroupMembers(groupId, user.id)
        .then(results => {
          setSuggestions(results);
          if (results.length > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        })
        .catch(createErrorHandler('GroupInfoScreen', 'getSuggestedGroupMembers'))
        .finally(() => setLoadingSuggestions(false));
    }
  }, [group?.id, user?.id, canSeeAI, spotsNeeded, isRenter]);

  useEffect(() => {
    if (groupId && user) {
      getGroupHealth(groupId, user.id).then(setHealth).catch(createErrorHandler('GroupInfoScreen', 'getGroupHealth'));
    }
  }, [groupId, group?.id]);

  useEffect(() => {
    if (groupId && user?.id) {
      import('../../services/groupService').then(({ getGroupSettings, getGroupMemberMuteStatus }) => {
        getGroupSettings(groupId).then(setGroupChatSettings).catch(createErrorHandler('GroupInfoScreen', 'getGroupSettings'));
        getGroupMemberMuteStatus(groupId, user.id).then(setMuted).catch(createErrorHandler('GroupInfoScreen', 'getGroupMemberMuteStatus'));
      });
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    if (group && isAdmin) {
      setLoadingLikers(true);
      getGroupLikers(groupId)
        .then(setGroupLikers)
        .catch(() => {
          StorageService.getGroupLikersForGroup(groupId).then(setGroupLikers).catch(createErrorHandler('GroupInfoScreen', 'getGroupLikersForGroup'));
        })
        .finally(() => setLoadingLikers(false));
    }
  }, [group?.id, isAdmin]);

  useFocusEffect(
    React.useCallback(() => {
      if (group?.id && user?.id) {
        getGroupEvents(groupId, user.id)
          .then(setGroupEvents)
          .catch(createErrorHandler('GroupInfoScreen', 'getGroupEvents'));
      }
    }, [group?.id, user?.id])
  );

  useEffect(() => {
    if (!group?.members || !user) return;
    const otherMembers = group.members.filter((m: any) => m.id !== user.id);
    if (otherMembers.length === 0) return;
    const fetchSummaries = async () => {
      const summaries: Record<string, string> = {};
      await Promise.all(
        otherMembers.map(async (m: any) => {
          try {
            const insight = await getCachedOrGenerateInsight(m.id);
            if (insight?.summary) summaries[m.id] = insight.summary;
          } catch {}
        })
      );
      if (Object.keys(summaries).length > 0) setMemberPiSummaries(summaries);
    };
    fetchSummaries();
  }, [group?.id, user?.id]);

  async function loadGroup() {
    setLoading(true);
    try {
      const data = await getGroupDetails(user!.id, groupId);
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
        message: `Join my group "${group?.name}" on Rhome!\n\nTap to join: ${deepLink}\n\nOr enter code: ${inviteCode}`,
      });
    } catch {}
  }

  async function handleRegenerateCode() {
    const confirmed = await confirm({
      title: 'Regenerate Code?',
      message: 'Generate a new invite code? The old code will stop working.',
      confirmText: 'Regenerate',
      variant: 'warning',
    });
    if (confirmed) {
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
    }
  }

  function filterMemberFromStorage(members: any[], targetId: string): any[] {
    return (members || []).filter((m: any) => {
      const mid = typeof m === 'string' ? m : (m.id || m.user_id);
      return mid !== targetId;
    });
  }

  async function handleInviteLiker(userId: string) {
    try {
      const { addMemberToGroup } = await import('../../services/groupService');
      await addMemberToGroup(groupId, userId);
      setGroupLikers(prev => prev.filter(l => l.userId !== userId));
      loadGroup();
    } catch {
      await alert({ title: 'Error', message: 'Could not invite this user.', variant: 'warning' });
    }
  }

  async function handleDismissLiker(userId: string) {
    try {
      await dismissGroupLiker(groupId, userId);
    } catch {
      await StorageService.dismissGroupLikerLocal(groupId, userId);
    }
    setGroupLikers(prev => prev.filter(l => l.userId !== userId));
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    const confirmed = await confirm({
      title: `Remove ${memberName}?`,
      message: `${memberName} will be removed from the group.`,
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;

    setRemovingId(memberId);
    let success = false;
    try {
      await removeMember(user!.id, groupId, memberId);
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
      await alert({ title: 'Error', message: 'Could not remove member.', variant: 'warning' });
    }
    setRemovingId(null);
  }

  async function handlePromoteMember(memberId: string, memberName: string) {
    const confirmed = await confirm({
      title: `Promote ${memberName}?`,
      message: `${memberName} will become the new admin. You will become a regular member.`,
      confirmText: 'Promote',
      variant: 'warning',
    });
    if (!confirmed) return;

    let success = false;
    try {
      await promoteMember(user!.id, groupId, memberId);
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
      await alert({ title: 'Error', message: 'Could not promote member.', variant: 'warning' });
    }
  }

  async function handleLeaveGroup() {
    if (isAdmin && memberCount > 1) {
      const confirmed = await confirm({
        title: 'Promote Someone First',
        message: 'You are the admin. Promote another member before leaving.',
        confirmText: 'Go to Promote',
        variant: 'warning',
      });
      if (confirmed) {
        navigation.navigate('PromoteAdmin', {
          groupId,
          groupName: group?.name || routeGroupName || 'Group',
        });
      }
      return;
    }

    const isLastMember = memberCount <= 1;
    const title = isLastMember ? 'Delete Group?' : 'Leave Group?';
    const msg = isLastMember
      ? 'You are the last member. Leaving will permanently delete this group.'
      : 'Are you sure you want to leave this group?';

    const confirmed = await confirm({
      title,
      message: msg,
      confirmText: isLastMember ? 'Delete' : 'Leave',
      variant: 'danger',
    });
    if (!confirmed) return;

    let success = false;
    try {
      await leaveGroup(user!.id, groupId);
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
      await alert({ title: 'Error', message: 'Could not leave group.', variant: 'warning' });
    }
  }

  async function handleDeleteGroup() {
    const confirmed = await confirm({
      title: 'Delete Group?',
      message: 'This will permanently delete the group and all its messages. This cannot be undone.',
      confirmText: 'Delete Group',
      variant: 'danger',
    });
    if (!confirmed) return;

    let success = false;
    try {
      await leaveGroup(user!.id, groupId);
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
      await alert({ title: 'Error', message: 'Could not delete group.', variant: 'warning' });
    }
  }

  async function handleDiscoverableToggle(value: boolean) {
    if (!value) {
      const confirmed = await confirm({
        title: 'Turn Off Discoverable?',
        message: 'Other users won\'t be able to find or request to join your group. Are you sure?',
        confirmText: 'Turn Off',
        cancelText: 'Keep On',
        variant: 'danger',
      });
      if (confirmed) {
        setGroup((p: any) => ({ ...p, discoverable: false }));
        applyDiscoverable(false);
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
    const confirmed = await confirm({
      title: 'Remove Property?',
      message: 'The group will no longer be linked to this listing.',
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;

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
      await alert({ title: 'Error', message: 'Could not remove property.', variant: 'warning' });
    }
  }

  async function handleInviteViaText() {
    const name = group?.name || routeGroupName || 'my group';
    const inviteMsg = `Join my group "${name}" on Rhome!\n\nDownload the app at rhome.com`;
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
            accessibilityLabel="Go back"
            accessibilityRole="button"
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
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={() => setShowGroupReport(true)}
            hitSlop={12}
            style={[styles.heroBackBtn, { backgroundColor: theme.card, borderColor: theme.border, top: insets.top + 16, left: undefined, right: 16, position: 'absolute' }]}
            accessibilityLabel="Group options"
            accessibilityRole="button"
          >
            <Feather name="more-vertical" size={18} color={theme.textSecondary} />
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
                <Image source={{ uri: p.uri }} style={[styles.heroAvatar, { borderWidth: 3, borderColor: '#fff' }]} accessibilityLabel="Group avatar" accessibilityRole="image" />
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
                        accessibilityLabel="Group member photo"
                        accessibilityRole="image"
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

          <View style={styles.quickActions}>
            <Pressable style={[styles.quickAction, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={handleShareCode} accessibilityLabel="Share group" accessibilityRole="button">
              <Feather name="share-2" size={18} color={theme.primary} />
              <ThemedText style={[Typography.small, { marginTop: 4 }]}>Share</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={async () => {
                try {
                  const { muteGroup: muteGrp, unmuteGroup: unmuteGrp, getGroupMemberMuteStatus: getMuteStatus } = await import('../../services/groupService');
                  if (muted) {
                    await unmuteGrp(groupId, user!.id);
                    setMuted(false);
                  } else {
                    await muteGrp(groupId, user!.id);
                    setMuted(true);
                  }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}
              }}
              accessibilityLabel={muted ? 'Unmute group' : 'Mute group'}
              accessibilityRole="button"
            >
              <Feather name={muted ? 'bell-off' : 'bell'} size={18} color={muted ? '#ef4444' : theme.primary} />
              <ThemedText style={[Typography.small, { marginTop: 4 }]}>{muted ? 'Unmute' : 'Mute'}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                navigation.goBack();
              }}
              accessibilityLabel="Open chat"
              accessibilityRole="button"
            >
              <Feather name="message-circle" size={18} color={theme.primary} />
              <ThemedText style={[Typography.small, { marginTop: 4 }]}>Chat</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowPropertySearch(true)}
              accessibilityLabel="Search properties"
              accessibilityRole="button"
            >
              <Feather name="search" size={18} color={theme.primary} />
              <ThemedText style={[Typography.small, { marginTop: 4 }]}>Search</ThemedText>
            </Pressable>
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
                <Pressable onPress={handleRemoveProperty} hitSlop={8} accessibilityLabel="Remove linked property" accessibilityRole="button">
                  <ThemedText style={[Typography.small, { color: '#FF6B6B' }]}>Remove</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : isAdmin ? (
            <Pressable
              style={[styles.dashedCard, { borderColor: theme.primary }]}
              onPress={() => setShowPropertySearch(true)}
              accessibilityLabel="Link a property"
              accessibilityRole="button"
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

        {health && isRenter ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.healthSection}>
            {renterLimits.hasCompatibilityBreakdown ? (
              <View style={styles.healthSummary}>
                <View style={styles.healthScoreBlock}>
                  <ThemedText style={[styles.healthBigScore, { color: health.statusColor }]}>
                    {health.score}%
                  </ThemedText>
                  <ThemedText style={[styles.healthStatusLabel, { color: health.statusColor }]}>
                    {health.statusLabel}
                  </ThemedText>
                </View>
                <View style={styles.healthSummaryRight}>
                  <ThemedText style={styles.healthTitle}>Group Compatibility</ThemedText>
                  {health.readyToSearch ? (
                    <ThemedText style={styles.readyText}>Ready to apartment search</ThemedText>
                  ) : (
                    <ThemedText style={styles.notReadyText}>Complete preferences to search</ThemedText>
                  )}
                  {health.sharedNeighborhoods.length > 0 ? (
                    <ThemedText style={styles.neighborhoodsText}>
                      Works in: {health.sharedNeighborhoods.slice(0, 3).join(', ')}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : (
              <Pressable onPress={() => navigation.navigate('Plans' as never)} style={[styles.healthSummary, { opacity: 0.5 }]} accessibilityLabel="Upgrade to see compatibility scores" accessibilityRole="button">
                <View style={styles.healthScoreBlock}>
                  <Feather name="lock" size={22} color="rgba(255,255,255,0.3)" />
                </View>
                <View style={styles.healthSummaryRight}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={styles.healthTitle}>Group Compatibility</ThemedText>
                    <PlanBadgeInline plan="Elite" locked />
                  </View>
                  <ThemedText style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                    Upgrade to see compatibility scores
                  </ThemedText>
                </View>
              </Pressable>
            )}

            {health.conflicts.length > 0 ? (
              renterLimits.hasConflictDetection ? (
                <View style={styles.conflictsBlock}>
                  <ThemedText style={styles.conflictsTitle}>Conflicts to resolve</ThemedText>
                  {health.conflicts.map((c, i) => (
                    <View key={i} style={styles.conflictRow}>
                      <Feather name="alert-circle" size={13} color="#e74c3c" />
                      <ThemedText style={styles.conflictText}>{c}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <Pressable onPress={() => navigation.navigate('Plans' as never)} style={[styles.conflictsBlock, { opacity: 0.5 }]} accessibilityLabel="Upgrade to see group conflicts" accessibilityRole="button">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={[styles.conflictsTitle, { color: 'rgba(255,255,255,0.4)' }]}>Conflicts to resolve</ThemedText>
                    <PlanBadgeInline plan="Elite" locked />
                  </View>
                  <ThemedText style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>
                    Upgrade to Elite to see group conflicts
                  </ThemedText>
                </Pressable>
              )
            ) : null}

            {health.suggestions.length > 0 ? (
              <View style={styles.suggestionsBlock}>
                <ThemedText style={styles.suggestionsTitle}>Suggestions</ThemedText>
                {health.suggestions.map((s, i) => (
                  <ThemedText key={i} style={styles.suggestionText}>· {s}</ThemedText>
                ))}
              </View>
            ) : null}

            {!health.readyToSearch ? (
              <Pressable
                style={styles.prefsCTA}
                onPress={() => navigation.navigate('ApartmentPreferences' as never)}
                accessibilityLabel="Set your apartment preferences"
                accessibilityRole="button"
              >
                <ThemedText style={styles.prefsCTAText}>
                  Set your apartment preferences
                </ThemedText>
              </Pressable>
            ) : null}

            {health.readyToSearch ? (
              renterLimits.hasAIApartmentSuggestions ? (
                <Pressable
                  style={styles.searchCTA}
                  onPress={() => navigation.navigate('GroupApartmentSuggestions' as never, { groupId } as never)}
                  accessibilityLabel="See AI apartment suggestions"
                  accessibilityRole="button"
                >
                  <Feather name="search" size={15} color="#fff" />
                  <ThemedText style={styles.searchCTAText}>See AI Apartment Suggestions</ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.searchCTA, { backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)' }]}
                  onPress={() => navigation.navigate('Plans' as never)}
                  accessibilityLabel="Upgrade for AI apartment suggestions"
                  accessibilityRole="button"
                >
                  <Feather name="lock" size={14} color="#a855f7" />
                  <ThemedText style={[styles.searchCTAText, { color: '#a855f7' }]}>AI Apartment Suggestions</ThemedText>
                  <PlanBadgeInline plan="Plus" locked />
                </Pressable>
              )
            ) : null}

            <ThemedText style={styles.aiFooter}>Powered by Pi</ThemedText>
          </Animated.View>
        ) : null}

        <Section
          label={`MEMBERS (${memberCount}/${memberLimit}) · ${memberCount} room${memberCount !== 1 ? 's' : ''} needed`}
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
          {!loading && group && (group.members || []).length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Feather name="users" size={40} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { marginTop: 12, fontWeight: '600' }]}>No members yet</ThemedText>
              <ThemedText style={[Typography.small, { marginTop: 8, color: theme.textSecondary, textAlign: 'center' }]}>
                Share your invite link to add roommates to this group.
              </ThemedText>
            </View>
          ) : null}
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
                  <Image source={{ uri: member.photo }} style={styles.memberAvatar} accessibilityLabel={`${member.name} photo`} accessibilityRole="image" />
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                      {member.role === 'host' ? 'Host' : 'Renter'}
                      {member.verified ? ' · Verified' : ''}
                    </ThemedText>
                    {member.isCouple ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(236,72,153,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                        <Feather name="heart" size={9} color="#ec4899" />
                        <ThemedText style={{ fontSize: 10, color: '#ec4899', fontWeight: '700' }}>Couple</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {!isCurrentUser && memberPiSummaries[member.id] ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 }}>
                      <Feather name="cpu" size={10} color="#a855f7" />
                      <ThemedText style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flex: 1, fontStyle: 'italic' }} numberOfLines={1}>
                        {memberPiSummaries[member.id]}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                {isAdmin && !isCurrentUser && !isMemberAdmin ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: member.isCouple ? '#ec4899' : theme.border }]}
                      onPress={async () => {
                        try {
                          const { updateMemberCouple } = await import('../../services/groupService');
                          await updateMemberCouple(groupId, member.id, !member.isCouple);
                          loadGroup();
                        } catch {
                          const members = [...(group?.members || [])];
                          const idx = members.findIndex((m: any) => m.id === member.id);
                          if (idx >= 0) {
                            members[idx] = { ...members[idx], isCouple: !member.isCouple };
                            setGroup((prev: any) => prev ? { ...prev, members } : prev);
                          }
                        }
                      }}
                      accessibilityLabel={`${member.isCouple ? 'Unmark' : 'Mark'} ${member.name} as couple`}
                      accessibilityRole="button"
                    >
                      <Feather name="heart" size={13} color={member.isCouple ? '#ec4899' : theme.textSecondary} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: theme.primary }]}
                      onPress={() => handlePromoteMember(member.id, member.name)}
                      accessibilityLabel={`Promote ${member.name} to admin`}
                      accessibilityRole="button"
                    >
                      <Feather name="arrow-up" size={13} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: '#FF6B6B' }]}
                      onPress={() => handleRemoveMember(member.id, member.name)}
                      disabled={isRemoving}
                      accessibilityLabel={`Remove ${member.name} from group`}
                      accessibilityRole="button"
                    >
                      {isRemoving ? (
                        <ActivityIndicator size="small" color="#FF6B6B" />
                      ) : (
                        <Feather name="x" size={13} color="#FF6B6B" />
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {!isCurrentUser && !isAdmin ? (
                  <Pressable
                    onPress={() => { setReportMemberTarget({ id: member.id, name: member.name }); setShowMemberReport(true); }}
                    hitSlop={8}
                    style={styles.iconBtn}
                    accessibilityLabel={`Options for ${member.name}`}
                    accessibilityRole="button"
                  >
                    <Feather name="more-vertical" size={14} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <View style={[styles.inviteCodeCard, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
            <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.sm }]}>
              INVITE CODE
            </ThemedText>

            <Pressable onPress={handleCopyCode} accessibilityLabel="Copy invite code" accessibilityRole="button">
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
                accessibilityLabel={codeCopied ? 'Code copied' : 'Copy invite code'}
                accessibilityRole="button"
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
                accessibilityLabel="Share invite link"
                accessibilityRole="button"
              >
                <Feather name="share-2" size={14} color="#fff" />
                <ThemedText style={[Typography.small, { marginLeft: 6, color: '#fff', fontWeight: '700' }]}>
                  Share Invite
                </ThemedText>
              </Pressable>
            </View>

            {isAdmin ? (
              <Pressable onPress={handleRegenerateCode} style={{ alignItems: 'center', marginTop: 10 }} accessibilityLabel="Regenerate invite code" accessibilityRole="button">
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
              accessibilityLabel="Invite from matches"
              accessibilityRole="button"
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
            accessibilityLabel="Invite via text message"
            accessibilityRole="button"
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

        {isAdmin ? (
          <Section label="LIKES" theme={theme}>
            {loadingLikers ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : groupLikers.length === 0 ? (
              <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', paddingVertical: 20 }]}>
                No one has liked your group yet
              </ThemedText>
            ) : (
              groupLikers.map((liker: any) => (
                <View
                  key={liker.userId}
                  style={[styles.memberRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  {liker.photo ? (
                    <Image source={{ uri: liker.photo }} style={styles.memberAvatar} accessibilityLabel={`${liker.name} photo`} accessibilityRole="image" />
                  ) : (
                    <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '25', alignItems: 'center', justifyContent: 'center' }]}>
                      <ThemedText style={[Typography.body, { fontWeight: '800', color: theme.primary }]}>
                        {(liker.name || '?').charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[Typography.body, { fontWeight: '700' }]}>{liker.name}</ThemedText>
                    {liker.age ? (
                      <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                        {liker.age} years old
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: theme.primary }]}
                      onPress={() => handleInviteLiker(liker.userId)}
                      accessibilityLabel={`Invite ${liker.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="user-plus" size={13} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconBtn, { borderColor: theme.textSecondary }]}
                      onPress={() => handleDismissLiker(liker.userId)}
                      accessibilityLabel={`Dismiss ${liker.name}`}
                      accessibilityRole="button"
                    >
                      <Feather name="x" size={13} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </Section>
        ) : null}

        <Section
          label="UPCOMING EVENTS"
          theme={theme}
          action={{ label: 'Add', icon: 'plus', onPress: () => navigation.navigate('CreateEvent', { groupId }) }}
        >
          {groupEvents.length > 0 ? (
            groupEvents.map((ev: RhomeEvent) => (
              <EventCard
                key={ev.id}
                event={ev}
                compact
                onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })}
              />
            ))
          ) : (
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', paddingVertical: 20 }]}>
              No upcoming events
            </ThemedText>
          )}
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
            onChange={async (val) => {
              setMuted(val);
              try {
                const { muteGroup: muteGrp, unmuteGroup: unmuteGrp } = await import('../../services/groupService');
                if (val) {
                  await muteGrp(groupId, user!.id);
                } else {
                  await unmuteGrp(groupId, user!.id);
                }
              } catch {}
            }}
            theme={theme}
          />
        </Section>

        {isAdmin ? (
          <Section label="CHAT SETTINGS" theme={theme}>
            <SettingRow
              icon="at-sign"
              label="Allow @everyone"
              description="Let members notify all group members"
              value={groupChatSettings.allowEveryoneMention !== false}
              onChange={async (val) => {
                const updated = { ...groupChatSettings, allowEveryoneMention: val };
                setGroupChatSettings(updated);
                try {
                  const { updateGroupSettings: updateSettings } = await import('../../services/groupService');
                  await updateSettings(groupId, updated);
                } catch {}
              }}
              theme={theme}
            />
            <SettingRow
              icon="bookmark"
              label="Allow Pinning"
              description="Let admins pin messages in the chat"
              value={groupChatSettings.allowPinning !== false}
              onChange={async (val) => {
                const updated = { ...groupChatSettings, allowPinning: val };
                setGroupChatSettings(updated);
                try {
                  const { updateGroupSettings: updateSettings } = await import('../../services/groupService');
                  await updateSettings(groupId, updated);
                } catch {}
              }}
              theme={theme}
            />
            <SettingRow
              icon="lock"
              label="Admin Only Messages"
              description="Only admins can send messages"
              value={groupChatSettings.adminOnlyMessages === true}
              onChange={async (val) => {
                const updated = { ...groupChatSettings, adminOnlyMessages: val };
                setGroupChatSettings(updated);
                try {
                  const { updateGroupSettings: updateSettings } = await import('../../services/groupService');
                  await updateSettings(groupId, updated);
                } catch {}
              }}
              theme={theme}
            />
          </Section>
        ) : null}

        {isRenter && spotsNeeded > 0 ? (
          canSeeAI ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.suggestionsSection}>
              <View style={styles.suggestionsSectionHeader}>
                <Feather name="cpu" size={16} color="#ff6b5b" />
                <ThemedText style={styles.suggestionsSectionTitle}>AI Suggestions</ThemedText>
              </View>
              <ThemedText style={styles.suggestionsSectionSub}>
                Your group needs {spotsNeeded} more {spotsNeeded === 1 ? 'person' : 'people'}
              </ThemedText>
              {loadingSuggestions ? (
                <ActivityIndicator color="#ff6b5b" style={{ marginVertical: 20 }} />
              ) : suggestions.length > 0 ? (
                <>
                  {suggestions.map(({ profile, groupScore, reason }) => {
                    const p = Array.isArray(profile.profile) ? profile.profile[0] : profile.profile;
                    const photo = p?.photos?.[0] || profile.avatar_url;
                    return (
                      <View key={profile.id} style={[styles.suggestionCard, { borderColor: theme.border }]}>
                        <Image source={{ uri: photo }} style={styles.suggestionAvatar} accessibilityLabel={`${profile.full_name} photo`} accessibilityRole="image" />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.suggestionName}>
                            {profile.full_name}{profile.age ? `, ${profile.age}` : ''}
                          </ThemedText>
                          <ThemedText style={styles.suggestionReason}>{reason}</ThemedText>
                          <ThemedText style={styles.suggestionScore}>{groupScore}% group match</ThemedText>
                        </View>
                        <Pressable
                          style={styles.suggestionInviteBtn}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('GroupInvite' as never, { groupId, suggestedUserId: profile.id } as never);
                          }}
                          accessibilityLabel={`Invite ${profile.full_name}`}
                          accessibilityRole="button"
                        >
                          <ThemedText style={styles.suggestionInviteBtnText}>Invite</ThemedText>
                        </Pressable>
                      </View>
                    );
                  })}
                  <ThemedText style={styles.aiFooter}>Powered by Pi</ThemedText>
                </>
              ) : (
                <ThemedText style={styles.noSuggestionsText}>
                  No strong matches found yet — check back later
                </ThemedText>
              )}
            </Animated.View>
          ) : (
            <View style={[styles.lockedSuggestions, { borderColor: theme.border }]}>
              <Feather name="lock" size={18} color="#ff6b5b" />
              <ThemedText style={styles.lockedText}>
                Upgrade to Plus to see AI member suggestions
              </ThemedText>
              <Pressable onPress={() => navigation.navigate('Plans' as never)} accessibilityLabel="Upgrade plan" accessibilityRole="button">
                <ThemedText style={styles.lockedUpgradeText}>Upgrade</ThemedText>
              </Pressable>
            </View>
          )
        ) : null}

        <View style={[styles.section, { marginTop: Spacing.sm }]}>
          {isAdmin ? (
            <Pressable
              style={[styles.dangerBtn, { borderColor: '#FF6B6B', marginBottom: 10 }]}
              onPress={handleDeleteGroup}
              accessibilityLabel="Delete group"
              accessibilityRole="button"
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
            accessibilityLabel="Leave group"
            accessibilityRole="button"
          >
            <Feather name="log-out" size={16} color="#FF6B6B" />
            <ThemedText style={[Typography.body, { color: '#FF6B6B', fontWeight: '600', marginLeft: 8 }]}>
              Leave Group
            </ThemedText>
          </Pressable>

          {!isAdmin ? (
            <Pressable style={styles.reportBtn} onPress={async () => {
              await alert({ title: 'Report', message: 'This group has been reported.', variant: 'info' });
            }} accessibilityLabel="Report this group" accessibilityRole="button">
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
            await alert({ title: 'Error', message: 'Could not link property.', variant: 'warning' });
          }
        }}
      />

      <ReportBlockModal
        visible={showGroupReport}
        onClose={() => setShowGroupReport(false)}
        userName={group?.name || 'Group'}
        type="group"
        onReport={async (reason) => {
          try { await reportGroup(user!.id, groupId, reason); } catch {}
        }}
      />

      <ReportBlockModal
        visible={showMemberReport}
        onClose={() => { setShowMemberReport(false); setReportMemberTarget(null); }}
        userName={reportMemberTarget?.name || 'User'}
        type="user"
        onReport={async (reason) => {
          try { if (reportMemberTarget) await reportUser(user!.id, reportMemberTarget.id, reason); } catch {}
        }}
        onBlock={async () => {
          try {
            if (reportMemberTarget) {
              await blockUserRemote(user!.id, reportMemberTarget.id);
              await blockUserLocal(reportMemberTarget.id);
              setShowMemberReport(false);
              setReportMemberTarget(null);
            }
          } catch {}
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
  suggestionsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  suggestionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  suggestionsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  suggestionsSectionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.sm,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  suggestionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  suggestionReason: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  suggestionScore: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b5b',
    marginTop: 2,
  },
  suggestionInviteBtn: {
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  suggestionInviteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  aiFooter: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    marginTop: 8,
  },
  noSuggestionsText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingVertical: 16,
  },
  lockedSuggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 10,
  },
  lockedText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  lockedUpgradeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff6b5b',
  },
  healthSection: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  healthSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthScoreBlock: {
    alignItems: 'center',
    marginRight: 16,
  },
  healthBigScore: {
    fontSize: 36,
    fontWeight: '800',
  },
  healthStatusLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  healthSummaryRight: {
    flex: 1,
  },
  healthTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  readyText: {
    color: '#2ecc71',
    fontSize: 12,
  },
  notReadyText: {
    color: '#888',
    fontSize: 12,
  },
  neighborhoodsText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  conflictsBlock: {
    marginBottom: 12,
  },
  conflictsTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 5,
  },
  conflictText: {
    color: '#e74c3c',
    fontSize: 12,
    flex: 1,
  },
  suggestionsBlock: {
    marginBottom: 12,
  },
  suggestionsTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  suggestionText: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  prefsCTA: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  prefsCTAText: {
    color: '#ff6b5b',
    fontSize: 13,
    fontWeight: '600',
  },
  searchCTA: {
    backgroundColor: '#ff6b5b',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  searchCTAText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: Spacing.md,
  },
  quickAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 72,
  },
});
