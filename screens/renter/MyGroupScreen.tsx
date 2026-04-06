import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
  FlatList,
  ScrollView,
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { GroupMemberCard } from '../../components/GroupMemberCard';
import {
  getUserPreformedGroup,
  getGroupMembers,
  getShortlist,
  leavePreformedGroup,
  updateGroupPreferences,
  removeMember,
  removeFromShortlist,
  enableReplacement,
  disableReplacement,
} from '../../services/preformedGroupService';
import { toggleOpenToRequests, getGroupRequests } from '../../services/groupJoinService';
import {
  getGroupShortlist,
  getGroupTours,
  createTourEvent,
  updateTourRSVP,
  cancelTourEvent,
  getPendingInvitesForGroup,
  resendGroupInvite,
  transferGroupLead,
  GroupShortlistListing,
} from '../../services/groupService';
import { PreformedGroup, PreformedGroupMember, GroupShortlistItem } from '../../types/models';
import { GroupShortlistCard } from '../../components/GroupShortlistCard';
import { getShortlistWithVotes, castVote, ShortlistItemWithVotes } from '../../services/groupVotingService';
import ShortlistVoteCard from '../../components/ShortlistVoteCard';
import CompareListingsModal from '../../components/CompareListingsModal';
import { TourEventCard } from '../../components/TourEventCard';
import { TourScheduleForm } from '../../components/TourScheduleForm';
import * as Linking from 'expo-linking';
import { Spacing } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ReportBlockModal } from '../../components/ReportBlockModal';
import { reportGroup, reportUser, blockUser as blockUserRemote } from '../../services/moderationService';
import { createErrorHandler } from '../../utils/errorLogger';

type Tab = 'members' | 'shortlist' | 'tours' | 'settings';

export default function MyGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, blockUser: blockUserLocal } = useAuth();
  const { theme } = useTheme();

  const [group, setGroup] = useState<PreformedGroup | null>(null);
  const [members, setMembers] = useState<PreformedGroupMember[]>([]);
  const [shortlist, setShortlist] = useState<GroupShortlistItem[]>([]);
  const [groupShortlist, setGroupShortlist] = useState<GroupShortlistListing[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [copied, setCopied] = useState(false);
  const [openToRequests, setOpenToRequests] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showTourForm, setShowTourForm] = useState(false);
  const [tourSubmitting, setTourSubmitting] = useState(false);
  const [shortlistFilter, setShortlistFilter] = useState<'all' | 'everyone' | 'mine'>('all');
  const [shortlistItems, setShortlistItems] = useState<ShortlistItemWithVotes[]>([]);
  const [compareItems, setCompareItems] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [showGroupReport, setShowGroupReport] = useState(false);
  const [showMemberReport, setShowMemberReport] = useState(false);
  const [reportMemberTarget, setReportMemberTarget] = useState<{ id: string; name: string } | null>(null);

  const isLead = group?.group_lead_id === user?.id;

  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const g = await getUserPreformedGroup(user?.id);
      setGroup(g);
      if (g) {
        const [m, s] = await Promise.all([
          getGroupMembers(g.id),
          getShortlist(g.id),
        ]);
        setMembers(m);
        setShortlist(s);
        setGroupName(g.name || '');
        setOpenToRequests(g.open_to_requests ?? false);
        const reqs = await getGroupRequests(g.id, 'preformed');
        setPendingRequestCount(reqs.length);

        try {
          const [gs, t, inv] = await Promise.all([
            getGroupShortlist(g.id),
            getGroupTours(g.id),
            getPendingInvitesForGroup(g.id),
          ]);
          setGroupShortlist(gs);
          setTours(t);
          setPendingInvites(inv);
        } catch {
          console.warn('[MyGroupScreen] Failed to load extended data');
        }
      }
    } catch (err) {
      console.error('[MyGroupScreen] Failed to load group data:', err);
      setError('Failed to load your group. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleLeave = () => {
    if (!group) return;
    const message = isLead
      ? 'Leaving your group will dissolve it for everyone. Are you sure?'
      : 'Are you sure you want to leave this group?';

    Alert.alert('Leave Group', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leavePreformedGroup(user!.id, group.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const promptForReplacement = (freshGroup: PreformedGroup, freshMembers: PreformedGroupMember[]) => {
    const freshJoined = freshMembers.filter(m => m.status === 'joined').length;
    const freshOpenSlots = (freshGroup.group_size || 0) - freshJoined;

    if (freshGroup.group_lead_id !== user?.id || freshOpenSlots <= 0) return;

    Alert.alert(
      'Need a Replacement?',
      `Your group now has ${freshOpenSlots} open ${freshOpenSlots === 1 ? 'spot' : 'spots'}. Would you like to find a replacement roommate through Rhome?`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Find a Replacement',
          onPress: async () => {
            await enableReplacement(freshGroup.id, freshOpenSlots);
            loadData();
          },
        },
      ]
    );
  };

  const handleRemoveMember = (memberId: string) => {
    if (!group) return;
    const member = members.find(m => m.id === memberId);
    const memberName = member?.name || 'this member';

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from the group? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await removeMember(group.id, memberId);
              if (!success) {
                Alert.alert('Error', 'Failed to remove member. Please try again.');
                return;
              }

              const freshGroup = await getUserPreformedGroup(user!.id);
              if (freshGroup) {
                const freshMembers = await getGroupMembers(freshGroup.id);
                setGroup(freshGroup);
                setMembers(freshMembers);
                promptForReplacement(freshGroup, freshMembers);
              } else {
                setMembers(prev => prev.filter(m => m.id !== memberId));
              }
            } catch (err) {
              console.error('[handleRemoveMember] Error:', err);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    if (!group) return;
    await updateGroupPreferences(group.id, { name: groupName.trim() || undefined });
    setEditingName(false);
    loadData();
  };

  const shareInvite = async () => {
    if (!group) return;
    const url = Linking.createURL(`join/${group.invite_code}`);
    const displayName = group.name || 'our group';
    await Share.share({
      message: `Join ${displayName} on Rhome!\n\nDownload the app and use this link to join:\n${url}\n\nOr enter invite code: ${group.invite_code}`,
    });
  };

  const copyCode = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveShortlist = async (item: GroupShortlistItem) => {
    if (!group) return;
    await removeFromShortlist(group.id, item.listing_id);
    loadData();
  };

  const loadShortlistVotes = async () => {
    if (!user?.id || !group?.id) return;
    const items = await getShortlistWithVotes(group.id, user.id);
    setShortlistItems(items);
  };

  useEffect(() => {
    if (activeTab === 'shortlist' && group?.id) {
      loadShortlistVotes();
    }
  }, [activeTab, group?.id]);

  const handleVote = async (itemId: string, vote: 1 | -1) => {
    if (!user?.id) return;
    await castVote(itemId, user.id, vote);
    await loadShortlistVotes();
  };

  const toggleCompareSelection = (itemId: string) => {
    setCompareItems(prev => {
      if (prev.includes(itemId)) return prev.filter(id => id !== itemId);
      if (prev.length >= 3) return prev;
      return [...prev, itemId];
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={{ color: '#fff', fontSize: 16, marginTop: 16, textAlign: 'center', paddingHorizontal: 32 }}>{error}</Text>
        <Pressable onPress={loadData} style={{ marginTop: 20, backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <Text style={styles.headerTitle}>My Group</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.createGroupState}>
          <View style={styles.createGroupIcon}>
            <Feather name="users" size={40} color="#22C55E" />
          </View>

          <Text style={styles.createGroupTitle}>Start Your Group</Text>
          <Text style={styles.createGroupSubtext}>
            Create a group and invite your friends to search for apartments together.
          </Text>

          <Pressable
            style={styles.createGroupBtn}
            onPress={() => navigation.navigate('GroupSetup' as never)}
          >
            <Feather name="plus" size={18} color="#111" />
            <Text style={styles.createGroupBtnText}>Create Group</Text>
          </Pressable>

          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <Feather name="mail" size={14} color="#22C55E" />
              <Text style={styles.featureText}>Invite friends by email or phone</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="heart" size={14} color="#22C55E" />
              <Text style={styles.featureText}>See what everyone likes in a shared shortlist</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="calendar" size={14} color="#22C55E" />
              <Text style={styles.featureText}>Schedule tours and RSVP together</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="message-circle" size={14} color="#22C55E" />
              <Text style={styles.featureText}>Group chat with hosts when you inquire</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const joinedCount = members.filter(m => m.status === 'joined').length;
  const openSlots = (group.group_size || 0) - joinedCount;
  const hasDropout = openSlots > 0 && joinedCount < (group.group_size || 0);

  const renderTab = (tab: Tab, label: string, icon: string) => (
    <Pressable
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Feather name={icon} size={14} color={activeTab === tab ? '#22C55E' : 'rgba(255,255,255,0.5)'} />
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text style={styles.headerTitle}>{group.name || 'Your Group'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={shareInvite} style={styles.headerAction}>
            <Feather name="send" size={18} color="#22C55E" />
          </Pressable>
          <Pressable onPress={() => setShowGroupReport(true)} style={styles.headerAction}>
            <Feather name="more-vertical" size={18} color="#999" />
          </Pressable>
        </View>
      </View>

      <View style={styles.inviteBanner}>
        <Pressable style={styles.inviteCodeBtn} onPress={copyCode}>
          <Feather name={copied ? 'check' : 'clipboard'} size={14} color="#22C55E" />
          <Text style={styles.inviteCodeText}>
            {copied ? 'Copied!' : `Code: ${group.invite_code}`}
          </Text>
        </Pressable>
        <Text style={styles.inviteHint}>
          {members.filter(m => m.status === 'joined').length}/{group.group_size} members joined
        </Text>
      </View>

      <View style={styles.tabRow}>
        {renderTab('members', 'Members', 'users')}
        {renderTab('shortlist', `Shortlist`, 'heart')}
        {renderTab('tours', `Tours${tours.length > 0 ? ` (${tours.filter(t => t.status === 'scheduled').length})` : ''}`, 'calendar')}
        {renderTab('settings', 'Settings', 'settings')}
      </View>

      {activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <GroupMemberCard
              member={item}
              isLead={item.user_id === group.group_lead_id}
              isCurrentUser={item.user_id === user?.id}
              showRemove={isLead}
              onRemove={() => handleRemoveMember(item.id)}
            />
          )}
          ListHeaderComponent={
            <>
              {hasDropout ? (
                <Pressable
                  style={styles.needRoommateBanner}
                  onPress={() => {
                    if (!isLead) {
                      Alert.alert(
                        `${openSlots} ${openSlots === 1 ? 'Spot' : 'Spots'} Open`,
                        group.needs_replacement
                          ? 'Your group lead has turned on roommate finding. New members will need approval to join.'
                          : 'Ask your group lead to find a replacement if you need one.',
                      );
                      return;
                    }

                    if (group.needs_replacement) {
                      if (pendingRequestCount > 0) {
                        navigation.navigate('GroupRequestReview' as never, {
                          groupId: group.id,
                          groupType: 'preformed',
                          isLead: true,
                          memberCount: members.length,
                        } as never);
                      } else {
                        Alert.alert(
                          'Replacement Active',
                          'Your group is visible to roommate seekers. No join requests yet \u2014 we\'ll notify you when someone is interested.',
                          [
                            { text: 'OK' },
                            {
                              text: 'Turn Off',
                              style: 'destructive',
                              onPress: async () => {
                                await disableReplacement(group.id);
                                loadData();
                              },
                            },
                          ],
                        );
                      }
                    } else {
                      Alert.alert(
                        'Need a Roommate?',
                        `Your group has ${openSlots} open ${openSlots === 1 ? 'spot' : 'spots'}. Turn this on to make your group visible to people looking for roommates on Rhome. You'll review requests before accepting anyone.`,
                        [
                          { text: 'Not Now', style: 'cancel' },
                          {
                            text: 'Find a Roommate',
                            onPress: async () => {
                              await enableReplacement(group.id, openSlots);
                              loadData();
                            },
                          },
                        ],
                      );
                    }
                  }}
                >
                  <View style={styles.needRoommateIcon}>
                    <Feather name="user-plus" size={18} color="#ff6b5b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.needRoommateTitle}>
                      {group.needs_replacement
                        ? `Looking for ${openSlots} roommate${openSlots > 1 ? 's' : ''}`
                        : `Need a roommate? ${openSlots} ${openSlots === 1 ? 'spot' : 'spots'} open`}
                    </Text>
                    <Text style={styles.needRoommateSubtext}>
                      {group.needs_replacement
                        ? pendingRequestCount > 0
                          ? `${pendingRequestCount} join ${pendingRequestCount === 1 ? 'request' : 'requests'} to review`
                          : 'Your group is visible to roommate seekers'
                        : 'Tap to find a replacement through Rhome'}
                    </Text>
                  </View>
                  {group.needs_replacement ? (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                  )}
                </Pressable>
              ) : null}

              {pendingInvites.length > 0 ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: '#999', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' }}>
                    Pending Invites
                  </Text>
                  {pendingInvites.map((inv: any) => (
                    <View key={inv.id} style={styles.pendingInviteRow}>
                      <Feather name={inv.invite_email ? 'mail' : 'phone'} size={14} color="#F59E0B" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#ccc', fontSize: 13 }}>
                          {inv.invite_email || inv.invite_phone}
                        </Text>
                        <Text style={{ color: '#666', fontSize: 11 }}>
                          Waiting to join{inv.is_couple ? ' (couple)' : ''}
                        </Text>
                      </View>
                      {isLead ? (
                        <Pressable
                          onPress={() => {
                            resendGroupInvite(inv.id).catch(createErrorHandler('MyGroupScreen', 'resendGroupInvite'));
                            Alert.alert('Invite Resent', 'The invite has been resent.');
                          }}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8 }}
                        >
                          <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>Resend</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={
            <Pressable style={styles.inviteMemberBtn} onPress={shareInvite}>
              <Feather name="plus-circle" size={16} color="#22C55E" />
              <Text style={styles.inviteMemberText}>Invite more people</Text>
            </Pressable>
          }
        />
      ) : null}

      {activeTab === 'shortlist' ? (
        <View style={{ flex: 1 }}>
          {shortlistItems.length >= 2 ? (
            <View style={styles.compareToolbar}>
              <Pressable
                style={styles.compareModeBtn}
                onPress={() => {
                  setCompareMode(!compareMode);
                  setCompareItems([]);
                }}
              >
                <Feather name="columns" size={14} color={compareMode ? '#ff6b5b' : 'rgba(255,255,255,0.5)'} />
                <Text style={[styles.compareModeText, compareMode ? { color: '#ff6b5b' } : null]}>
                  {compareMode ? 'Cancel' : 'Compare'}
                </Text>
              </Pressable>

              {compareMode && compareItems.length >= 2 ? (
                <Pressable
                  style={styles.compareGoBtn}
                  onPress={() => setShowCompare(true)}
                >
                  <Text style={styles.compareGoBtnText}>Compare {compareItems.length}</Text>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <FlatList
            data={shortlistItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <ShortlistVoteCard
                item={item}
                totalMembers={members.filter(m => m.status === 'joined').length}
                isSelected={compareItems.includes(item.id)}
                onVoteUp={() => handleVote(item.id, 1)}
                onVoteDown={() => handleVote(item.id, -1)}
                onPress={() => {
                  if (compareMode) {
                    toggleCompareSelection(item.id);
                  } else if (item.listing?.id) {
                    (navigation as any).navigate('Explore', { screen: 'ExploreMain', params: { viewListingId: item.listingId } });
                  }
                }}
                onLongPress={() => {
                  if (!compareMode) {
                    setCompareMode(true);
                    setCompareItems([item.id]);
                  }
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="bookmark" size={32} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>No shortlisted apartments yet</Text>
                <Text style={styles.emptySubtext}>Save apartments from Explore to vote on them with your group</Text>
              </View>
            }
          />

          <CompareListingsModal
            visible={showCompare}
            onClose={() => { setShowCompare(false); setCompareMode(false); setCompareItems([]); }}
            items={shortlistItems.filter(i => compareItems.includes(i.id))}
            totalMembers={members.filter(m => m.status === 'joined').length}
          />
        </View>
      ) : null}

      {activeTab === 'tours' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          <Pressable
            style={styles.scheduleTourBtn}
            onPress={() => setShowTourForm(!showTourForm)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Schedule a Tour</Text>
          </Pressable>

          {showTourForm ? (
            <View style={{ marginTop: 12 }}>
              <TourScheduleForm
                onSubmit={async (data) => {
                  if (!group) return;
                  setTourSubmitting(true);
                  try {
                    await createTourEvent(user!.id, {
                      groupId: group.id,
                      tourDate: data.tourDate,
                      tourTime: data.tourTime,
                      durationMinutes: data.durationMinutes,
                      location: data.location,
                      notes: data.notes,
                    });
                    setShowTourForm(false);
                    loadData();
                  } catch (e) {
                    Alert.alert('Error', 'Failed to schedule tour. Please try again.');
                  } finally {
                    setTourSubmitting(false);
                  }
                }}
                onCancel={() => setShowTourForm(false)}
                submitting={tourSubmitting}
              />
            </View>
          ) : null}

          {tours.length === 0 && !showTourForm ? (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={36} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>No tours scheduled</Text>
              <Text style={styles.emptySubtext}>
                Schedule a tour to visit listings with your group
              </Text>
            </View>
          ) : null}

          {tours.map((tour: any) => (
            <View key={tour.id} style={{ marginTop: 12 }}>
              <TourEventCard
                tour={tour}
                currentUserId={user?.id}
                isCreator={tour.created_by === user?.id}
                onRSVP={async (tourId, status) => {
                  try {
                    await updateTourRSVP(user!.id, tourId, status);
                    loadData();
                  } catch {
                    Alert.alert('Error', 'Failed to update RSVP.');
                  }
                }}
                onCancel={async (tourId) => {
                  Alert.alert('Cancel Tour', 'Are you sure you want to cancel this tour?', [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Yes, Cancel',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await cancelTourEvent(tourId);
                          loadData();
                        } catch {
                          Alert.alert('Error', 'Failed to cancel tour.');
                        }
                      },
                    },
                  ]);
                }}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}

      {activeTab === 'settings' ? (
        <View style={styles.settingsContent}>
          <View style={styles.settingsField}>
            <Text style={styles.settingsLabel}>Group Name</Text>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Group name"
                  placeholderTextColor="#666"
                />
                <Pressable onPress={handleSaveName}>
                  <Feather name="check" size={18} color="#22C55E" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.editRow}>
                <Text style={styles.settingsValue}>{group.name || 'Unnamed'}</Text>
                {isLead ? <Feather name="edit-2" size={14} color="rgba(255,255,255,0.4)" /> : null}
              </Pressable>
            )}
          </View>

          <View style={styles.settingsField}>
            <Text style={styles.settingsLabel}>Status</Text>
            <Text style={styles.settingsValue}>{group.status}</Text>
          </View>

          <View style={styles.settingsField}>
            <Text style={styles.settingsLabel}>Group Size</Text>
            <Text style={styles.settingsValue}>{group.group_size} people</Text>
          </View>

          {isLead && hasDropout ? (
            <>
              <View style={styles.settingsField}>
                <Text style={styles.settingsLabel}>Open to Join Requests</Text>
                <View style={styles.editRow}>
                  <Text style={[styles.settingsValue, { flex: 1 }]}>
                    {openToRequests ? 'Anyone can request to join' : 'Invite only'}
                  </Text>
                  <Switch
                    value={openToRequests}
                    onValueChange={async (val) => {
                      if (!group) return;
                      setOpenToRequests(val);
                      await toggleOpenToRequests(group.id, 'preformed', val);
                    }}
                    trackColor={{ false: '#333', true: '#22C55E50' }}
                    thumbColor={openToRequests ? '#22C55E' : '#888'}
                  />
                </View>
              </View>

              {pendingRequestCount > 0 ? (
                <Pressable
                  style={styles.reviewRequestsBtn}
                  onPress={() =>
                    navigation.navigate('GroupRequestReview' as never, {
                      groupId: group.id,
                      groupType: 'preformed',
                      isLead: true,
                      memberCount: members.length,
                    } as never)
                  }
                >
                  <Feather name="inbox" size={16} color="#3B82F6" />
                  <Text style={styles.reviewRequestsBtnText}>
                    Review Join Requests ({pendingRequestCount})
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.settingsField}>
                <Text style={styles.settingsLabel}>Find a Replacement</Text>
                <Text style={styles.replacementSubtext}>
                  {group.needs_replacement
                    ? `Looking for ${group.replacement_slots || openSlots} replacement${(group.replacement_slots || openSlots) > 1 ? 's' : ''} on Rhome`
                    : `${openSlots} open ${openSlots === 1 ? 'spot' : 'spots'} \u2014 find a roommate through Rhome`
                  }
                </Text>
                <View style={{ marginTop: 8 }}>
                  <Switch
                    value={group.needs_replacement ?? false}
                    onValueChange={async (val) => {
                      if (val) {
                        await enableReplacement(group.id, openSlots);
                      } else {
                        await disableReplacement(group.id);
                      }
                      loadData();
                    }}
                    trackColor={{ false: '#333', true: '#22C55E50' }}
                    thumbColor={group.needs_replacement ? '#22C55E' : '#888'}
                  />
                </View>
                {group.needs_replacement ? (
                  <Text style={styles.replacementHint}>
                    Your group is visible to other renters looking for roommates. They can request to join, and you'll review their compatibility in the join requests section.
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}

          {isLead && members.filter(m => m.status === 'joined' && m.user_id !== user?.id).length > 0 ? (
            <View style={styles.settingsField}>
              <Text style={styles.settingsLabel}>Transfer Leadership</Text>
              <Text style={styles.replacementSubtext}>
                Hand over group lead to another member
              </Text>
              {members
                .filter(m => m.status === 'joined' && m.user_id !== user?.id)
                .map(m => (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      Alert.alert(
                        'Transfer Lead',
                        `Make ${m.name || 'this member'} the group lead? You'll remain as a regular member.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Transfer',
                            onPress: async () => {
                              try {
                                await transferGroupLead(user!.id, group.id, m.user_id);
                                Alert.alert('Done', `${m.name || 'Member'} is now the group lead.`);
                                loadData();
                              } catch {
                                Alert.alert('Error', 'Failed to transfer leadership.');
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 8,
                      marginTop: 4,
                    }}
                  >
                    <Feather name="user" size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={{ color: '#ccc', fontSize: 13, flex: 1 }}>{m.name || 'Member'}</Text>
                    <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                ))}
            </View>
          ) : null}

          {members.filter(m => m.status === 'joined' && m.user_id !== user?.id).length > 0 ? (
            <View style={styles.settingsField}>
              <Text style={styles.settingsLabel}>Members</Text>
              {members
                .filter(m => m.status === 'joined' && m.user_id !== user?.id)
                .map(m => (
                  <View key={`report-${m.id}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 4 }}>
                    <Feather name="user" size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={{ color: '#ccc', fontSize: 13, flex: 1, marginLeft: 8 }}>{m.name || 'Member'}</Text>
                    <Pressable
                      onPress={() => {
                        setReportMemberTarget({ id: m.user_id, name: m.name || 'Member' });
                        setShowMemberReport(true);
                      }}
                      hitSlop={8}
                    >
                      <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.4)" />
                    </Pressable>
                  </View>
                ))}
            </View>
          ) : null}

          <Pressable style={styles.leaveBtn} onPress={handleLeave}>
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={styles.leaveBtnText}>
              {isLead ? 'Dissolve Group' : 'Leave Group'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ReportBlockModal
        visible={showGroupReport}
        onClose={() => setShowGroupReport(false)}
        userName={group?.name || 'Group'}
        type="group"
        onReport={async (reason) => {
          try { if (group) await reportGroup(user!.id, group.id, reason); } catch {}
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
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    marginBottom: 12,
  },
  inviteCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  inviteHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#22C55E',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  inviteMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  inviteMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  shortlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  shortlistInfo: {
    flex: 1,
  },
  shortlistTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  shortlistNotes: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  shortlistMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  shortlistVotes: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  settingsContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  settingsField: {
    marginBottom: 20,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  settingsValue: {
    fontSize: 15,
    color: '#fff',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  leaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  reviewRequestsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#3B82F630',
    backgroundColor: '#3B82F610',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  reviewRequestsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
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
  createGroupState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  createGroupIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  createGroupTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  createGroupSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 28,
  },
  createGroupBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%' as const,
    marginBottom: 32,
  },
  createGroupBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111',
  },
  featuresList: {
    width: '100%' as const,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  replacementSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  replacementHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
    lineHeight: 18,
  },
  needRoommateBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,107,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    borderRadius: 12,
  },
  needRoommateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,91,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  needRoommateTitle: {
    color: '#ff6b5b',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  needRoommateSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  pendingInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    marginBottom: 6,
  },
  compareToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  compareModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  compareModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  compareGoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ff6b5b',
  },
  compareGoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  shortlistFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  shortlistFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  shortlistFilterBtnActive: {
    backgroundColor: 'rgba(255,107,91,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.3)',
  },
  shortlistFilterText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleTourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff6b5b',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
});
