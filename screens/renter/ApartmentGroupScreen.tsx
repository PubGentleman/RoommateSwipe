import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Feather } from '../../components/VectorIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { GroupMemberCard } from '../../components/GroupMemberCard';
import {
  getUserPreformedGroup,
  getGroupMembers,
  enableReplacement,
  disableReplacement,
  removeMember,
} from '../../services/preformedGroupService';
import {
  getGroupTours,
  createTourEvent,
  updateTourRSVP,
  cancelTourEvent,
  getPendingInvitesForGroup,
  resendGroupInvite,
} from '../../services/groupService';
import { getShortlistWithVotes, castVote, ShortlistItemWithVotes } from '../../services/groupVotingService';
import ShortlistVoteCard from '../../components/ShortlistVoteCard';
import CompareListingsModal from '../../components/CompareListingsModal';
import { TourEventCard } from '../../components/TourEventCard';
import { TourScheduleForm } from '../../components/TourScheduleForm';
import { PreformedGroup, PreformedGroupMember } from '../../types/models';
import { RhomeLogo } from '../../components/RhomeLogo';

const ACCENT = '#4a9eff';

type Tab = 'members' | 'shortlist' | 'tours';

export default function ApartmentGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [group, setGroup] = useState<PreformedGroup | null>(null);
  const [members, setMembers] = useState<PreformedGroupMember[]>([]);
  const [shortlistItems, setShortlistItems] = useState<ShortlistItemWithVotes[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [copied, setCopied] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareItems, setCompareItems] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showTourForm, setShowTourForm] = useState(false);
  const [tourSubmitting, setTourSubmitting] = useState(false);

  const isLead = group?.group_lead_id === user?.id;

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const myGroup = await getUserPreformedGroup(user.id);
      setGroup(myGroup);
      if (myGroup) {
        const [mbrs, sl, trs, inv] = await Promise.all([
          getGroupMembers(myGroup.id),
          getShortlistWithVotes(myGroup.id, user.id),
          getGroupTours(myGroup.id).catch(() => []),
          getPendingInvitesForGroup(myGroup.id).catch(() => []),
        ]);
        setMembers(mbrs);
        setShortlistItems(sl);
        setTours(trs || []);
        setPendingInvites(inv || []);
      }
    } catch (e) {
      console.warn('[ApartmentGroup] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const shareInvite = async () => {
    if (!group?.invite_code) return;
    const deepLink = Linking.createURL(`/join-group/${group.invite_code}`);
    await Share.share({
      message: `Join my apartment search group on Rhome! Use code ${group.invite_code} or tap: ${deepLink}`,
    });
  };

  const copyCode = async () => {
    if (!group?.invite_code) return;
    await Clipboard.setStringAsync(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVote = async (itemId: string, vote: 1 | -1) => {
    if (!user?.id) return;
    await castVote(itemId, user.id, vote);
    await loadData();
  };

  const handleRemoveMember = async (memberId: string) => {
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
                const freshJoined = freshMembers.filter(m => m.status === 'joined').length;
                const freshOpenSlots = (freshGroup.group_size || 0) - freshJoined;
                setGroup(freshGroup);
                setMembers(freshMembers);

                if (freshOpenSlots > 0) {
                  Alert.alert(
                    'Need a Roommate?',
                    `Your group now has ${freshOpenSlots} open ${freshOpenSlots === 1 ? 'spot' : 'spots'}. Would you like to find a replacement through Rhome's roommate matching?`,
                    [
                      { text: 'Not Now', style: 'cancel' },
                      {
                        text: 'Find a Roommate',
                        onPress: async () => {
                          await enableReplacement(freshGroup.id, freshOpenSlots);
                          loadData();
                        },
                      },
                    ],
                  );
                }
              } else {
                setMembers(prev => prev.filter(m => m.id !== memberId));
              }
            } catch (err) {
              console.error('[ApartmentGroup] Remove member error:', err);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleNeedRoommate = () => {
    if (!group) return;
    const joinedCount = members.filter(m => m.status === 'joined').length;
    const openSlots = (group.group_size || 0) - joinedCount;

    Alert.alert(
      'Find a Roommate',
      openSlots > 0
        ? `You have ${openSlots} open ${openSlots === 1 ? 'spot' : 'spots'}. Turning this on will make your group visible to people looking for roommates on Rhome. You'll be able to review requests before accepting anyone.`
        : 'All spots are filled. To find a replacement, first increase your group size or remove a member.',
      openSlots > 0
        ? [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Find Roommates',
              onPress: async () => {
                await enableReplacement(group.id, openSlots);
                loadData();
                Alert.alert(
                  'You\'re Live!',
                  'Your group is now visible to roommate seekers. You\'ll get notifications when someone requests to join. You can review their profile and compatibility before accepting.',
                );
              },
            },
          ]
        : [{ text: 'OK' }],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <RhomeLogo variant="icon" size="sm" />
          <Text style={styles.headerTitle}>My Group</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="home" size={44} color={ACCENT} />
          </View>

          <Text style={styles.emptyTitle}>Apartment hunting with friends?</Text>
          <Text style={styles.emptySubtext}>
            Create a group and invite your friends. Everyone will see liked apartments, vote on favorites, and message hosts together.
          </Text>

          <Pressable
            style={styles.createBtn}
            onPress={() => navigation.navigate('GroupSetup')}
          >
            <Feather name="plus" size={18} color="#111" />
            <Text style={styles.createBtnText}>Create a Group</Text>
          </Pressable>

          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <Feather name="send" size={14} color={ACCENT} />
              <Text style={styles.featureText}>Invite friends — even if they're not on Rhome yet</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="heart" size={14} color={ACCENT} />
              <Text style={styles.featureText}>Everyone's liked apartments in one shared list</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="thumbs-up" size={14} color={ACCENT} />
              <Text style={styles.featureText}>Vote and compare to pick your favorites</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="message-circle" size={14} color={ACCENT} />
              <Text style={styles.featureText}>Message hosts as a group</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="calendar" size={14} color={ACCENT} />
              <Text style={styles.featureText}>Schedule and RSVP for tours together</Text>
            </View>
          </View>

          <Text style={styles.soloHint}>
            Searching solo? No worries — just browse apartments on the Explore tab.
          </Text>
        </View>
      </View>
    );
  }

  const joinedCount = members.filter(m => m.status === 'joined').length;
  const openSlots = (group.group_size || 0) - joinedCount;
  const hasDropout = openSlots > 0 && joinedCount < (group.group_size || 0);
  const scheduledTours = tours.filter((t: any) => t.status === 'scheduled');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {group.name || 'Your Group'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={shareInvite} style={styles.headerAction}>
            <Feather name="send" size={18} color={ACCENT} />
          </Pressable>
        </View>
      </View>

      <View style={styles.inviteBanner}>
        <Pressable style={styles.inviteCodeBtn} onPress={copyCode}>
          <Feather name={copied ? 'check' : 'clipboard'} size={14} color={ACCENT} />
          <Text style={styles.inviteCodeText}>
            {copied ? 'Copied!' : `Code: ${group.invite_code}`}
          </Text>
        </Pressable>
        <Text style={styles.inviteHint}>
          {joinedCount}/{group.group_size} members joined
        </Text>
      </View>

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
            } else {
              handleNeedRoommate();
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
                ? 'Your group is visible to roommate seekers'
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

      <View style={styles.tabRow}>
        {(['members', 'shortlist', 'tours'] as Tab[]).map((tab) => {
          const labels: Record<Tab, { label: string; icon: string }> = {
            members: { label: 'Members', icon: 'users' },
            shortlist: { label: 'Apartments', icon: 'heart' },
            tours: { label: `Tours${scheduledTours.length > 0 ? ` (${scheduledTours.length})` : ''}`, icon: 'calendar' },
          };
          const { label, icon } = labels[tab];
          return (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Feather name={icon as any} size={14} color={activeTab === tab ? ACCENT : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <GroupMemberCard
              member={item}
              isLead={item.user_id === group.group_lead_id}
              isCurrentUser={item.user_id === user?.id}
              showRemove={isLead && item.user_id !== user?.id}
              onRemove={() => handleRemoveMember(item.id)}
            />
          )}
          ListHeaderComponent={
            pendingInvites.length > 0 ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#999', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' }}>
                  Waiting to Join
                </Text>
                {pendingInvites.map((inv: any) => (
                  <View key={inv.id} style={styles.pendingRow}>
                    <Feather name={inv.invite_email ? 'mail' : 'phone'} size={14} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#ccc', fontSize: 13 }}>
                        {inv.invite_email || inv.invite_phone}
                      </Text>
                      <Text style={{ color: '#666', fontSize: 11 }}>Invited — hasn't joined yet</Text>
                    </View>
                    {isLead ? (
                      <Pressable
                        onPress={() => {
                          resendGroupInvite(inv.id).catch(() => {});
                          Alert.alert('Sent!', 'Invite resent.');
                        }}
                        style={styles.resendBtn}
                      >
                        <Text style={styles.resendText}>Resend</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null
          }
          ListFooterComponent={
            <Pressable style={styles.inviteMoreBtn} onPress={shareInvite}>
              <Feather name="plus-circle" size={16} color={ACCENT} />
              <Text style={styles.inviteMoreText}>Invite more friends</Text>
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
                onPress={() => { setCompareMode(!compareMode); setCompareItems([]); }}
              >
                <Feather name="columns" size={14} color={compareMode ? ACCENT : 'rgba(255,255,255,0.5)'} />
                <Text style={{ color: compareMode ? ACCENT : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>
                  {compareMode ? 'Cancel' : 'Compare'}
                </Text>
              </Pressable>
              {compareMode && compareItems.length >= 2 ? (
                <Pressable
                  style={styles.compareGoBtn}
                  onPress={() => setShowCompare(true)}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                    Compare {compareItems.length}
                  </Text>
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
                totalMembers={joinedCount}
                isSelected={compareItems.includes(item.id)}
                onVoteUp={() => handleVote(item.id, 1)}
                onVoteDown={() => handleVote(item.id, -1)}
                onPress={() => {
                  if (compareMode) {
                    setCompareItems(prev =>
                      prev.includes(item.id) ? prev.filter(id => id !== item.id) :
                      prev.length >= 3 ? prev : [...prev, item.id]
                    );
                  } else if ((item as any).listingId) {
                    navigation.navigate('Explore', { screen: 'ExploreMain', params: { viewListingId: (item as any).listingId } });
                  }
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyTab}>
                <Feather name="heart" size={32} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyTabTitle}>No apartments saved yet</Text>
                <Text style={styles.emptyTabSubtext}>
                  Go to Explore and save apartments you like. They'll show up here for your group to vote on.
                </Text>
              </View>
            }
          />

          <CompareListingsModal
            visible={showCompare}
            onClose={() => { setShowCompare(false); setCompareMode(false); setCompareItems([]); }}
            items={shortlistItems.filter(i => compareItems.includes(i.id))}
            totalMembers={joinedCount}
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
                    Alert.alert('Error', 'Failed to schedule tour.');
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
            <View style={styles.emptyTab}>
              <Feather name="calendar" size={36} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyTabTitle}>No tours scheduled</Text>
              <Text style={styles.emptyTabSubtext}>
                Schedule a tour and your group can RSVP together
              </Text>
            </View>
          ) : null}

          {tours.map((tour: any) => (
            <View key={tour.id} style={{ marginTop: 12 }}>
              <TourEventCard
                tour={tour}
                currentUserId={user?.id}
                isCreator={tour.created_by === user?.id}
                onRSVP={(status) => updateTourRSVP(user!.id, tour.id, status).then(loadData)}
                onCancel={() => cancelTourEvent(tour.id).then(loadData)}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  inviteCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74,158,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteCodeText: {
    color: '#4a9eff',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  needRoommateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
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
    fontWeight: '700',
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
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(74,158,255,0.1)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  tabTextActive: {
    color: '#4a9eff',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 10,
    marginBottom: 6,
  },
  resendBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
  },
  resendText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  inviteMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  inviteMoreText: {
    color: '#4a9eff',
    fontSize: 14,
    fontWeight: '600',
  },
  compareToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  compareModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compareGoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4a9eff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scheduleTourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4a9eff',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74,158,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4a9eff',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 28,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  featuresList: {
    width: '100%',
    gap: 14,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  soloHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTabTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  emptyTabSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 6,
  },
});
