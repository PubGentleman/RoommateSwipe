import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroupType, GroupMember } from '../types/models';
import { isWithinActivityCutoff, getRecencyMultiplier } from '../utils/activityDecay';
import { shouldLoadMockData } from '../utils/dataUtils';

interface SupabaseGroupMessageRow {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read?: boolean;
}

interface SupabaseUserRef {
  id: string;
  full_name?: string;
  avatar_url?: string;
}

interface GroupWithListing {
  listings?: { bedrooms?: number };
  [key: string]: unknown;
}

export interface GroupData {
  name: string;
  description?: string;
  city?: string;
  state?: string;
  max_members?: number;
  budget_min?: number;
  budget_max?: number;
  move_in_date?: string;
  photo_url?: string;
  type?: GroupType;
  listing_id?: string;
  host_id?: string;
  listing_address?: string;
  is_archived?: boolean;
  is_visible_to_hosts?: boolean;
  address_revealed?: boolean;
  inquiry_status?: 'pending' | 'accepted' | 'declined';
}

export async function getGroups(city?: string, type?: GroupType) {
  let query = supabase
    .from('groups')
    .select(`
      *,
      members:group_members(user_id, is_couple, is_host, status)
    `)
    .order('created_at', { ascending: false });

  if (city) query = query.eq('city', city);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) {
    console.error('[getGroups] Query error:', error.message);
    throw error;
  }

  const groups = data || [];
  return groups
    .filter((g: any) => isWithinActivityCutoff(g.updated_at || g.created_at))
    .sort((a: any, b: any) => {
      const scoreA = getRecencyMultiplier(a.updated_at || a.created_at);
      const scoreB = getRecencyMultiplier(b.updated_at || b.created_at);
      return scoreB - scoreA;
    });
}

export async function getGroup(id: string) {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(*, is_couple, partner_user_id, user:users(id, full_name, avatar_url, age, occupation)),
      creator:users!created_by(id, full_name, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getGroupDetails(userId: string, groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(
        user_id, role, is_admin, is_host, is_couple, partner_user_id, status,
        user:users(id, full_name, avatar_url, age, role)
      ),
      listing:listings(id, title, address, city, state, rent, bedrooms, photos, status)
    `)
    .eq('id', groupId)
    .single();

  if (error) throw error;

  const members = (data.members || [])
    .filter((m: any) => m.status === 'active')
    .map((m: any) => ({
      id: m.user_id || m.user?.id,
      name: m.user?.full_name || 'Unknown',
      photo: m.user?.avatar_url || null,
      age: m.user?.age || null,
      role: m.user?.role || m.role || 'renter',
      isAdmin: m.is_admin || false,
      isHost: m.is_host || false,
      isCouple: m.is_couple || false,
      partnerUserId: m.partner_user_id || null,
    }));

  const listing = data.listing;

  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    type: data.type || 'roommate',
    adminId: data.created_by || members.find((m: any) => m.isAdmin)?.id,
    members,
    memberCount: members.length,
    memberLimit: listing ? (listing.bedrooms || 1) + 1 : (data.max_members || 4),
    linkedListing: listing ? {
      id: listing.id,
      title: listing.title,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      rent: listing.rent,
      bedrooms: listing.bedrooms,
      photos: listing.photos || [],
      status: listing.status,
    } : null,
    discoverable: data.discoverable || false,
    minBudget: data.budget_min || null,
    targetNeighborhood: data.city || null,
    createdAt: data.created_at,
  };
}

export async function getMyGroups(userId: string, type?: GroupType) {
  const uid = userId;
  if (!uid) return [];

  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', uid)
    .eq('status', 'active');

  if (memberError) {
    console.error('[getMyGroups] Membership query error:', memberError);
    throw memberError;
  }

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  let query = supabase
    .from('groups')
    .select(`
      *,
      members:group_members(user_id, is_couple, is_host, status),
      listing:listings(id, title, photos, rent)
    `)
    .in('id', groupIds);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) {
    console.error('[getMyGroups] Groups query error:', error.message);
    throw error;
  }
  return data || [];
}

export async function getMyRoommateGroups(userId: string) {
  return getMyGroups(userId, 'roommate');
}

export async function getMyInquiryGroups(userId: string) {
  return getMyGroups(userId, 'listing_inquiry');
}

async function checkEmailVerifiedForGroups() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser && !authUser.email_confirmed_at) {
    throw new Error('Please verify your email to create or join groups.');
  }
}

export async function createGroup(userId: string, group: GroupData) {
  if (!userId) throw new Error('Not authenticated');

  await checkEmailVerifiedForGroups();

  const { data, error } = await supabase
    .from('groups')
    .insert({
      created_by: userId,
      type: group.type || 'roommate',
      is_visible_to_hosts: group.type === 'listing_inquiry' ? false : true,
      ...group,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('group_members')
    .insert({ group_id: data.id, user_id: userId, role: 'admin', is_host: false });

  return data;
}

export async function createListingInquiryGroup(
  userId: string,
  listingId: string,
  hostId: string,
  listingAddress: string,
  sourceGroupId: string | null,
  groupName: string
) {
  try {
    if (!userId) throw new Error('Not authenticated');

    let effectiveHostId = hostId;
    let hostType: 'individual' | 'company' | 'agent' = 'individual';
    try {
      const { data: listing } = await supabase
        .from('listings')
        .select('assigned_agent_id, host_type')
        .eq('id', listingId)
        .single();
      if (listing?.assigned_agent_id) {
        effectiveHostId = listing.assigned_agent_id;
        hostType = 'agent';
      } else if (listing?.host_type) {
        hostType = listing.host_type;
      }
    } catch (e) { console.warn('[groupService] Agent lookup failed:', e); }

    if (hostType === 'individual') {
      try {
        const { data: hostUser } = await supabase
          .from('users')
          .select('host_type')
          .eq('id', effectiveHostId)
          .single();
        if (hostUser?.host_type) {
          hostType = hostUser.host_type;
        }
      } catch (e) {}
    }

    let renterIds: string[] = [];

    if (sourceGroupId) {
      const { data: sourceMembers } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', sourceGroupId)
        .eq('status', 'active');

      renterIds = (sourceMembers || []).map(m => m.user_id);
    } else {
      renterIds = [userId];
    }

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: groupName,
        type: 'listing_inquiry',
        listing_id: listingId,
        host_id: effectiveHostId,
        host_type: hostType,
        listing_address: listingAddress,
        source_group_id: sourceGroupId,
        created_by: userId,
        is_archived: false,
      })
      .select()
      .single();

    if (error) throw error;

    const memberInserts = renterIds.map(uid => ({
      group_id: group.id,
      user_id: uid,
      role: 'member',
      is_host: false,
      status: 'active',
    }));

    memberInserts.push({
      group_id: group.id,
      user_id: effectiveHostId,
      role: 'member',
      is_host: true,
      status: 'active',
    });

    await supabase.from('group_members').insert(memberInserts);

    return group;
  } catch (supaError) {
    console.warn('[groupService] Supabase createListingInquiryGroup failed, using local fallback:', supaError);
    const { StorageService } = await import('../utils/storage');
    let fallbackHostId = hostId;
    let fallbackHostType: 'individual' | 'company' | 'agent' = 'individual';
    try {
      const listings = await StorageService.getListings();
      const listing = listings.find((l: any) => l.id === listingId);
      if (listing?.assigned_agent_id) {
        fallbackHostId = listing.assigned_agent_id;
        fallbackHostType = 'agent';
      } else if (listing?.host_type) {
        fallbackHostType = listing.host_type;
      }
    } catch (e) { console.warn('[groupService] Fallback listing lookup failed:', e); }
    const localGroup = {
      id: `local-inquiry-${Date.now()}`,
      name: groupName,
      type: 'listing_inquiry' as const,
      listing_id: listingId,
      host_id: fallbackHostId,
      host_type: fallbackHostType,
      listing_address: listingAddress,
      source_group_id: sourceGroupId,
      created_by: 'local',
      is_archived: false,
      created_at: new Date().toISOString(),
      members: [],
      inquiry_status: 'pending',
    };
    const existingGroups = await StorageService.getGroups();
    existingGroups.push(localGroup as unknown as typeof existingGroups[0]);
    await StorageService.setGroups(existingGroups);
    return localGroup;
  }
}

export async function addMemberToGroup(
  groupId: string,
  userId: string,
  userRole: 'renter' | 'host' = 'renter',
  options?: { isCouple?: boolean; partnerUserId?: string }
) {
  const { data: group } = await supabase
    .from('groups')
    .select('type')
    .eq('id', groupId)
    .single();

  if (group?.type === 'roommate' && userRole === 'host') {
    throw new Error('Hosts cannot be added to roommate groups');
  }

  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      role: 'member',
      is_host: userRole === 'host',
      is_couple: options?.isCouple || false,
      partner_user_id: options?.partnerUserId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMemberCouple(
  groupId: string,
  userId: string,
  isCouple: boolean,
  partnerUserId?: string
) {
  const { data, error } = await supabase
    .from('group_members')
    .update({
      is_couple: isCouple,
      partner_user_id: isCouple ? (partnerUserId || null) : null,
    })
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGroup(id: string, updates: Partial<GroupData>) {
  const { data, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function joinGroup(userId: string, groupId: string) {
  if (!userId) throw new Error('Not authenticated');

  await checkEmailVerifiedForGroups();

  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member', status: 'active' })
    .select()
    .single();

  if (error) throw error;

  try {
    const { data: inquiryGroups } = await supabase
      .from('groups')
      .select('id, inquiry_status, name')
      .eq('source_group_id', groupId)
      .eq('type', 'listing_inquiry')
      .eq('is_archived', false);

    if (inquiryGroups && inquiryGroups.length > 0) {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      const memberName = profile?.full_name || 'A new member';

      for (const inquiryGroup of inquiryGroups) {
        await supabase
          .from('group_members')
          .insert({
            group_id: inquiryGroup.id,
            user_id: userId,
            role: 'member',
            is_host: false,
            status: 'active',
            joined_at: new Date().toISOString(),
          })
          .select()
          .single();

        const systemMessage =
          inquiryGroup.inquiry_status === 'accepted'
            ? `${memberName} joined after this inquiry was accepted.`
            : inquiryGroup.inquiry_status === 'declined'
            ? `${memberName} joined after this inquiry was declined.`
            : `${memberName} joined the group.`;

        await supabase
          .from('messages')
          .insert({
            group_id: inquiryGroup.id,
            sender_id: null,
            content: systemMessage,
            is_system_message: true,
            created_at: new Date().toISOString(),
          });
      }
    }
  } catch (syncError) {
    console.warn('[joinGroup] Failed to sync new member to inquiry groups:', syncError);
  }

  return data;
}

export async function leaveGroup(userId: string, groupId: string): Promise<'deleted' | 'left'> {
  if (!userId) throw new Error('Not authenticated');

  const { data: myMembership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (myMembership?.role === 'admin') {
    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .neq('user_id', userId);

    if ((count || 0) > 0) {
      throw new Error('PROMOTE_REQUIRED');
    }

    await supabase.from('groups').delete().eq('id', groupId);
    return 'deleted';
  }

  await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  return 'left';
}

export async function archiveGroup(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .update({ is_archived: true })
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGroup(id: string) {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function mapGroupMember(row: any): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role || 'member',
    isHost: row.is_host || false,
    isCouple: row.is_couple || false,
    partnerUserId: row.partner_user_id || undefined,
    status: row.status || 'active',
    joinedAt: row.created_at,
    user: row.user,
  };
}

export async function acceptInquiry(groupId: string, hostUserId: string) {
  const { data: group } = await supabase
    .from('groups')
    .select('host_id, type, inquiry_status')
    .eq('id', groupId)
    .single();
  if (!group || group.host_id !== hostUserId) throw new Error('Only the host can accept inquiries');
  if (group.type !== 'listing_inquiry') throw new Error('Not an inquiry group');
  if (group.inquiry_status !== 'pending') throw new Error('Inquiry already resolved');

  const { data, error } = await supabase
    .from('groups')
    .update({
      inquiry_status: 'accepted',
      address_revealed: true,
    })
    .eq('id', groupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function declineInquiry(groupId: string, hostUserId: string) {
  const { data: group } = await supabase
    .from('groups')
    .select('host_id, type, inquiry_status')
    .eq('id', groupId)
    .single();
  if (!group || group.host_id !== hostUserId) throw new Error('Only the host can decline inquiries');
  if (group.type !== 'listing_inquiry') throw new Error('Not an inquiry group');
  if (group.inquiry_status !== 'pending') throw new Error('Inquiry already resolved');

  const { data, error } = await supabase
    .from('groups')
    .update({
      inquiry_status: 'declined',
    })
    .eq('id', groupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getInquiryStatus(groupId: string): Promise<{ inquiryStatus: string; addressRevealed: boolean }> {
  const { data } = await supabase
    .from('groups')
    .select('inquiry_status, address_revealed')
    .eq('id', groupId)
    .single();
  return {
    inquiryStatus: data?.inquiry_status ?? 'pending',
    addressRevealed: data?.address_revealed ?? false,
  };
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      user:users(id, full_name, avatar_url, age, occupation, role)
    `)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('is_host', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapGroupMember);
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  content: string;
  createdAt: string;
}

export async function getGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select(`
      id, group_id, sender_id, content, created_at,
      users ( full_name, avatar_url )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;

  return (data || []).map((msg: any) => ({
    id: msg.id,
    groupId: msg.group_id,
    senderId: msg.sender_id,
    senderName: msg.users?.full_name || 'Unknown',
    senderPhoto: msg.users?.avatar_url,
    content: msg.content,
    createdAt: msg.created_at,
  }));
}

export async function sendGroupMessage(userId: string, groupId: string, content: string, messageType?: string, metadata?: any): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  const row: any = {
    group_id: groupId,
    sender_id: userId,
    content,
  };
  if (messageType) row.message_type = messageType;
  if (metadata) row.metadata = metadata;

  const { error } = await supabase.from('group_messages').insert(row);
  if (error) throw error;
}

export function subscribeToGroupMessages(
  groupId: string,
  onMessage: (msg: GroupMessage) => void
) {
  return supabase
    .channel(`group-messages-${groupId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      async (payload) => {
        const msg = payload.new as SupabaseGroupMessageRow;
        const { data: senderData } = await supabase
          .from('users')
          .select('full_name, avatar_url')
          .eq('id', msg.sender_id)
          .single();

        onMessage({
          id: msg.id,
          groupId: msg.group_id,
          senderId: msg.sender_id,
          senderName: senderData?.full_name || 'Unknown',
          senderPhoto: senderData?.avatar_url,
          content: msg.content,
          createdAt: msg.created_at,
        });
      }
    )
    .subscribe();
}

export function getGroupLimit(plan: string): number {
  const limits: Record<string, number> = {
    basic: 1,
    plus: 3,
    elite: 10,
    starter: 1,
    pro: 3,
    business: 999,
  };
  return limits[plan] || 1;
}

export function getMemberLimit(plan: string, linkedListingBedrooms?: number | null): number {
  if (linkedListingBedrooms != null && linkedListingBedrooms > 0) {
    return linkedListingBedrooms + 1;
  }
  const limits: Record<string, number> = {
    basic: 3,
    plus: 5,
    elite: 6,
    starter: 4,
    pro: 6,
    business: 6,
  };
  return limits[plan] || 3;
}

// ─── METHOD A: Invite from Matches ───────────────────────────────────────────

export async function getInvitableMates(userId: string, groupId: string): Promise<{
  id: string;
  name: string;
  photo?: string;
  alreadyInGroup: boolean;
  alreadyInvited: boolean;
}[]> {
  if (!userId) return [];

  const { data: conversations } = await supabase
    .from('conversations')
    .select('participant_ids')
    .contains('participant_ids', [userId]);

  if (!conversations?.length) return [];

  const userIds = [...new Set(
    conversations.flatMap((c: any) => c.participant_ids)
  )].filter(id => id !== userId);

  if (!userIds.length) return [];

  const { data: profiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  const { data: pendingInvites } = await supabase
    .from('group_invites')
    .select('invited_user_id')
    .eq('group_id', groupId)
    .eq('status', 'pending');

  const memberIds = new Set((members || []).map((m: any) => m.user_id));
  const invitedIds = new Set((pendingInvites || []).map((i: any) => i.invited_user_id));

  return (profiles || []).map((p: any) => ({
    id: p.id,
    name: p.full_name || 'Unknown',
    photo: p.avatar_url,
    alreadyInGroup: memberIds.has(p.id),
    alreadyInvited: invitedIds.has(p.id),
  }));
}

export async function sendGroupInvite(userId: string, groupId: string, invitedUserId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  const { data: group } = await supabase
    .from('groups')
    .select('created_by, listing_id, listings ( bedrooms )')
    .eq('id', groupId)
    .single();

  const { data: memberData } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  const creatorPlan = await getUserPlan(group?.created_by);
  const linkedBedrooms = (group as GroupWithListing)?.listings?.bedrooms ?? null;
  const limit = getMemberLimit(creatorPlan, linkedBedrooms);

  if ((memberData?.length || 0) >= limit) {
    const reason = linkedBedrooms
      ? `This group is limited to ${limit} members based on the linked listing (${linkedBedrooms} bedrooms + 1).`
      : `This group has reached its member limit of ${limit}.`;
    throw new Error(reason);
  }

  const { error } = await supabase.from('group_invites').insert({
    group_id: groupId,
    invited_by: userId,
    invited_user_id: invitedUserId,
    status: 'pending',
  });
  if (error && error.code !== '23505') throw error;
}

export async function respondToInvite(
  userId: string,
  inviteId: string,
  response: 'accepted' | 'declined'
): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  const { data: invite } = await supabase
    .from('group_invites')
    .update({ status: response })
    .eq('id', inviteId)
    .eq('invited_user_id', userId)
    .select()
    .single();

  if (response === 'accepted' && invite) {
    const { data: group } = await supabase
      .from('groups')
      .select('created_by, listing_id, listings ( bedrooms )')
      .eq('id', invite.group_id)
      .single();

    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', invite.group_id);

    const creatorPlan = await getUserPlan(group?.created_by);
    const linkedBedrooms = (group as GroupWithListing)?.listings?.bedrooms ?? null;
    const limit = getMemberLimit(creatorPlan, linkedBedrooms);

    if ((memberData?.length || 0) >= limit) {
      await supabase
        .from('group_invites')
        .update({ status: 'pending' })
        .eq('id', inviteId);
      const reason = linkedBedrooms
        ? `This group is full — limited to ${limit} members based on the linked listing (${linkedBedrooms} bedrooms + 1).`
        : `This group is full (${limit} member limit).`;
      throw new Error(reason);
    }

    await supabase.from('group_members').insert({
      group_id: invite.group_id,
      user_id: userId,
      role: 'member',
    });
  }
}

export async function getMyPendingInvites(userId: string): Promise<{
  id: string;
  groupId: string;
  groupName: string;
  invitedByName: string;
  listingTitle?: string;
  createdAt: string;
}[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('group_invites')
    .select(`
      id, created_at, group_id,
      groups ( name, listings ( title ) ),
      inviter:users!invited_by ( full_name )
    `)
    .eq('invited_user_id', userId)
    .eq('status', 'pending');

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.groups?.name || 'Unknown Group',
    invitedByName: row.inviter?.full_name || 'Someone',
    listingTitle: row.groups?.listings?.title,
    createdAt: row.created_at,
  }));
}

export async function getMyPendingCompanyInvites(userId: string): Promise<{
  id: string;
  listingId: string;
  groupId: string;
  groupName: string;
  matchScore: number;
  aiReason?: string;
  address?: string;
  neighborhood?: string;
  price?: number;
  bedrooms?: number;
  companyName?: string;
}[]> {
  if (!userId) return [];

  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  const groupIds = (memberRows || []).map((r: any) => r.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('company_group_invites')
    .select(`
      id, listing_id, group_id, match_score, ai_reason, status,
      listing:listings(address, neighborhood, rent, bedrooms),
      group:groups(name),
      host:users!company_group_invites_company_host_id_fkey(full_name, company_name)
    `)
    .in('group_id', groupIds)
    .eq('status', 'pending');

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    listingId: row.listing_id,
    groupId: row.group_id,
    groupName: row.group?.name || 'Your Group',
    matchScore: row.match_score || 0,
    aiReason: row.ai_reason,
    address: row.listing?.address,
    neighborhood: row.listing?.neighborhood,
    price: row.listing?.rent || 0,
    bedrooms: row.listing?.bedrooms,
    companyName: row.host?.company_name || row.host?.full_name || 'A property manager',
  }));
}

// ─── METHOD C: Shareable Invite Code ─────────────────────────────────────────

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function getInviteCode(groupId: string): Promise<string> {
  const { data: group } = await supabase
    .from('groups')
    .select('invite_code, invite_code_enabled')
    .eq('id', groupId)
    .single();

  if (group?.invite_code && group.invite_code_enabled) {
    return group.invite_code;
  }

  const code = generateInviteCode();
  await supabase
    .from('groups')
    .update({ invite_code: code, invite_code_enabled: true })
    .eq('id', groupId);

  return code;
}

export async function regenerateInviteCode(groupId: string): Promise<string> {
  const code = generateInviteCode();
  await supabase
    .from('groups')
    .update({ invite_code: code, invite_code_enabled: true })
    .eq('id', groupId);
  return code;
}

export async function disableInviteCode(groupId: string): Promise<void> {
  await supabase
    .from('groups')
    .update({ invite_code_enabled: false })
    .eq('id', groupId);
}

export async function joinGroupByCode(userId: string, code: string): Promise<{ groupId: string; groupName: string }> {
  if (!userId) throw new Error('Not authenticated');

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, invite_code_enabled, created_by, listing_id, listings ( bedrooms )')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (!group) throw new Error('Invalid invite code. Please check and try again.');
  if (!group.invite_code_enabled) throw new Error('This invite link has been disabled.');

  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) throw new Error('You are already in this group.');

  const { data: memberData } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id);

  const creatorPlan = await getUserPlan(group.created_by);
  const linkedBedrooms = (group as GroupWithListing)?.listings?.bedrooms ?? null;
  const limit = getMemberLimit(creatorPlan, linkedBedrooms);

  if ((memberData?.length || 0) >= limit) {
    const reason = linkedBedrooms
      ? `This group is full — limited to ${limit} members based on the linked listing (${linkedBedrooms} bedrooms + 1).`
      : `This group is full (${limit} member limit).`;
    throw new Error(reason);
  }

  const { error } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: userId,
    role: 'member',
  });
  if (error) throw error;

  return { groupId: group.id, groupName: group.name };
}

// ─── METHOD D: Host Invites from Listing Interest ────────────────────────────

export async function getRentersInterestedInListing(userId: string, listingId: string): Promise<{
  id: string;
  name: string;
  photo?: string;
  interestedAt: string;
}[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('interest_cards')
    .select(`
      created_at,
      renter:users!renter_id ( id, full_name, avatar_url )
    `)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.renter?.id,
    name: row.renter?.full_name || 'Unknown',
    photo: row.renter?.avatar_url,
    interestedAt: row.created_at,
  })).filter((r: any) => r.id);
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

async function getUserPlan(userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.plan || 'basic';
}

export async function getGroupWithListing(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(user_id),
      listing:listings(id, title, address, city, state, rent, photos)
    `)
    .eq('id', groupId)
    .single();

  if (error) throw error;
  return data;
}

export async function linkListingToGroup(
  groupId: string,
  listingId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ listing_id: listingId, updated_at: new Date().toISOString() })
    .eq('id', groupId);
  if (error) throw error;
}

export async function promoteMember(callerUserId: string, groupId: string, userId: string): Promise<void> {
  if (!callerUserId) throw new Error('Not authenticated');

  const { data: callerMember } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', callerUserId)
    .single();

  if (callerMember?.role !== 'admin') throw new Error('Only admins can promote members.');

  const { error } = await supabase
    .from('group_members')
    .update({ role: 'admin' })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;

  await supabase
    .from('group_members')
    .update({ role: 'member' })
    .eq('group_id', groupId)
    .eq('user_id', callerUserId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'group_promoted',
    title: 'You are now a group admin',
    body: `You have been made the admin of a group.`,
    data: { group_id: groupId },
    read: false,
    created_at: new Date().toISOString(),
  }).then(() => {});
}

export async function removeMember(userId: string, groupId: string, targetUserId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  if (targetUserId === userId) throw new Error('Use Leave Group to remove yourself.');

  const { data: callerMember } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (callerMember?.role !== 'admin') throw new Error('Only admins can remove members.');

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);

  if (error) throw error;

  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .single();

  await supabase.from('notifications').insert({
    user_id: targetUserId,
    type: 'group_removed',
    title: 'Removed from group',
    body: `You were removed from "${group?.name || 'a group'}".`,
    data: { group_id: groupId },
    read: false,
    created_at: new Date().toISOString(),
  }).then(() => {});
}

export async function setGroupDiscoverable(groupId: string, discoverable: boolean): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ discoverable })
    .eq('id', groupId);
  if (error) throw error;
}

export async function getDiscoverableGroupsForListing(listingId: string): Promise<{
  id: string;
  name: string;
  memberCount: number;
}[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, group_members ( count )')
    .eq('listing_id', listingId)
    .eq('discoverable', true);

  if (error) return [];

  return (data || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    memberCount: g.group_members?.[0]?.count || 0,
  }));
}

export async function requestToJoinGroup(userId: string, groupId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  const { data: group } = await supabase
    .from('groups')
    .select('discoverable')
    .eq('id', groupId)
    .single();

  if (!group?.discoverable) throw new Error('This group is not accepting join requests.');

  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) throw new Error('You are already in this group.');

  const { error } = await supabase.from('group_join_requests').insert({
    group_id: groupId,
    user_id: userId,
    status: 'pending',
  });
  if (error && error.code !== '23505') throw error;
}

export async function getJoinRequests(groupId: string): Promise<{
  id: string;
  userId: string;
  name: string;
  photo?: string;
  requestedAt: string;
}[]> {
  const { data, error } = await supabase
    .from('group_join_requests')
    .select('id, user_id, created_at, users ( name, photos )')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return [];

  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    name: r.users?.name || 'Unknown',
    photo: r.users?.photos?.[0],
    requestedAt: r.created_at,
  }));
}

export async function respondToJoinRequest(
  userId: string,
  requestId: string,
  groupId: string,
  response: 'approved' | 'declined'
): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  const { data: callerMember } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (callerMember?.role !== 'admin') throw new Error('Only admins can respond to join requests.');

  const { data: request } = await supabase
    .from('group_join_requests')
    .update({ status: response })
    .eq('id', requestId)
    .eq('group_id', groupId)
    .select()
    .single();

  if (!request) throw new Error('Request not found.');

  if (response === 'approved') {
    const { data: group } = await supabase
      .from('groups')
      .select('created_by, listing_id, listings ( bedrooms ), name')
      .eq('id', groupId)
      .single();

    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId);

    const creatorPlan = await getUserPlan(group?.created_by);
    const linkedBedrooms = (group as GroupWithListing)?.listings?.bedrooms ?? null;
    const limit = getMemberLimit(creatorPlan, linkedBedrooms);

    if ((count || 0) >= limit) {
      await supabase
        .from('group_join_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);

      await supabase.from('notifications').insert({
        user_id: request.user_id,
        type: 'join_request_declined',
        title: 'Group is full',
        body: `The group you requested to join is at its member limit.`,
        data: { group_id: groupId },
        read: false,
        created_at: new Date().toISOString(),
      }).then(() => {});
      return;
    }

    await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: request.user_id,
      role: 'member',
    });

    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'join_request_approved',
      title: 'Join request approved',
      body: `You have been added to "${group?.name}".`,
      data: { group_id: groupId },
      read: false,
      created_at: new Date().toISOString(),
    }).then(() => {});
  } else {
    const { data: group2 } = await supabase
      .from('groups').select('name').eq('id', groupId).single();

    await supabase.from('notifications').insert({
      user_id: request.user_id,
      type: 'join_request_declined',
      title: 'Join request declined',
      body: `Your request to join "${group2?.name}" was declined.`,
      data: { group_id: groupId },
      read: false,
      created_at: new Date().toISOString(),
    }).then(() => {});
  }
}

export interface OutreachPackage {
  id: string;
  label: string;
  groupCount: number | null;
  priceCents: number;
  description: string;
}

export const OUTREACH_PACKAGES: OutreachPackage[] = [
  { id: 'single', label: 'Contact 1 Group', groupCount: 1, priceCents: 299, description: 'Send to one group' },
  { id: 'triple', label: 'Contact 3 Groups', groupCount: 3, priceCents: 699, description: 'Best value — save ~30%' },
  { id: 'all', label: 'Contact All Groups', groupCount: null, priceCents: 999, description: 'Reach every group on your listing' },
];

export async function getGroupsForListing(listingId: string): Promise<{
  id: string;
  name: string;
  memberCount: number;
  members: { name: string; userId: string }[];
}[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, group_members(user_id, users(full_name))')
    .eq('listing_id', listingId);

  if (error) return [];

  return (data || []).map((g: any) => {
    const members = (g.group_members || []).map((m: any) => ({
      name: m.users?.full_name || 'Unknown',
      userId: m.user_id,
    }));
    return {
      id: g.id,
      name: g.name,
      memberCount: members.length,
      members,
    };
  });
}

export async function createOutreachPayment(
  userId: string,
  listingId: string,
  packageId: string,
  groupIds: string[],
  message: string
): Promise<{ clientSecret: string; paymentIntentId: string; amountCents: number }> {
  const { data, error } = await supabase.functions.invoke('create-outreach-payment', {
    body: { listingId, packageId, groupIds },
  });

  if (error) throw error;

  const { clientSecret, paymentIntentId, amountCents } = data;

  await supabase
    .from('host_outreach_pending')
    .insert({
      payment_intent_id: paymentIntentId,
      host_id: userId,
      listing_id: listingId,
      message,
      group_ids: groupIds,
    });

  return { clientSecret, paymentIntentId, amountCents };
}

export async function getContactedGroupIds(listingId: string): Promise<string[]> {
  const { data } = await supabase
    .from('host_outreach')
    .select('group_id')
    .eq('listing_id', listingId);

  return (data || []).map((r: any) => r.group_id);
}

export async function likeGroup(userId: string, groupId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('group_likes')
    .upsert({ group_id: groupId, user_id: userId }, { onConflict: 'group_id,user_id' });
  if (error) throw error;
}

export async function unlikeGroupLike(userId: string, groupId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('group_likes')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getLikedGroups(userId: string): Promise<{
  groupId: string;
  mutualInterest: boolean;
  canRequestToJoin: boolean;
}[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('group_likes')
    .select('group_id, admin_liked_back, dismissed')
    .eq('user_id', userId)
    .eq('dismissed', false);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    groupId: r.group_id,
    mutualInterest: r.admin_liked_back,
    canRequestToJoin: r.admin_liked_back,
  }));
}

export async function getGroupLikers(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('group_likes')
    .select(`
      id, user_id, admin_liked_back, created_at,
      profile:profiles(full_name, age, bio, avatar_url, zodiac_sign, gender, verified, occupation)
    `)
    .eq('group_id', groupId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    likeId: r.id,
    userId: r.user_id,
    name: r.profile?.full_name ?? 'Unknown',
    age: r.profile?.age ?? 0,
    bio: r.profile?.bio ?? '',
    avatarUrl: r.profile?.avatar_url ?? null,
    zodiacSign: r.profile?.zodiac_sign ?? '',
    gender: r.profile?.gender ?? '',
    verified: r.profile?.verified ?? false,
    occupation: r.profile?.occupation ?? '',
    likedAt: r.created_at,
    adminLikedBack: r.admin_liked_back,
  }));
}

export async function adminLikeBack(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_likes')
    .update({ admin_liked_back: true, liked_back_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function dismissGroupLiker(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_likes')
    .update({ dismissed: true })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getGroupLikeCount(groupId: string): Promise<number> {
  const { count } = await supabase
    .from('group_likes')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('admin_liked_back', false)
    .eq('dismissed', false);
  return count ?? 0;
}

export async function checkMutualInterest(userId: string, groupId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from('group_likes')
    .select('admin_liked_back')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.admin_liked_back ?? false;
}

function generateGroupInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface GroupInviteInput {
  email?: string;
  phone?: string;
  isCouple?: boolean;
}

export async function sendGroupInvites(groupId: string, invites: GroupInviteInput[]): Promise<void> {
  const rows = invites.map(inv => ({
    group_id: groupId,
    invite_email: inv.email || null,
    invite_phone: inv.phone || null,
    invite_code: generateGroupInviteCode(),
    is_couple: inv.isCouple || false,
    delivery_method: inv.email ? 'email' : 'sms',
    delivery_status: 'pending',
    status: 'pending',
  }));
  const { error } = await supabase.from('group_invites').insert(rows);
  if (error) throw error;

  for (const row of rows) {
    try {
      await supabase.functions.invoke('send-group-invite', {
        body: {
          groupId,
          inviteCode: row.invite_code,
          email: row.invite_email,
          phone: row.invite_phone,
          isCouple: row.is_couple,
        },
      });
    } catch (e) {
      console.warn('[sendGroupInvites] Edge function failed for invite:', e);
    }
  }
}

export async function getPendingInvitesForGroup(groupId: string) {
  const { data, error } = await supabase
    .from('group_invites')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function resendGroupInvite(inviteId: string): Promise<void> {
  const { data: invite, error } = await supabase
    .from('group_invites')
    .select('*')
    .eq('id', inviteId)
    .single();
  if (error || !invite) throw error || new Error('Invite not found');

  await supabase.functions.invoke('send-group-invite', {
    body: {
      groupId: invite.group_id,
      inviteCode: invite.invite_code,
      email: invite.invite_email,
      phone: invite.invite_phone,
      isCouple: invite.is_couple,
    },
  });

  await supabase
    .from('group_invites')
    .update({ delivery_status: 'pending' })
    .eq('id', inviteId);
}

export async function checkPendingInvitesForUser(email?: string, phone?: string) {
  if (!email && !phone) return [];
  let query = supabase.from('group_invites').select('*, group:groups(id, name, created_by)').eq('status', 'pending');
  if (email && phone) {
    query = query.or(`invite_email.eq.${email},invite_phone.eq.${phone}`);
  } else if (email) {
    query = query.eq('invite_email', email);
  } else if (phone) {
    query = query.eq('invite_phone', phone);
  }
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export async function acceptGroupInvite(inviteCode: string, userId: string): Promise<{ groupId: string } | null> {
  const { data: invite, error } = await supabase
    .from('group_invites')
    .select('*')
    .eq('invite_code', inviteCode)
    .eq('status', 'pending')
    .maybeSingle();
  if (error || !invite) return null;

  await supabase.from('group_invites').update({ status: 'accepted' }).eq('id', invite.id);

  await addMemberToGroup(invite.group_id, userId, 'renter', { isCouple: invite.is_couple });
  return { groupId: invite.group_id };
}

export async function declineGroupInvite(inviteCode: string): Promise<void> {
  await supabase
    .from('group_invites')
    .update({ status: 'declined' })
    .eq('invite_code', inviteCode);
}

export async function likeListingForGroup(userId: string, groupId: string, listingId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');
  const { error } = await supabase.from('group_listing_likes').upsert({
    group_id: groupId,
    listing_id: listingId,
    user_id: userId,
  }, { onConflict: 'group_id,listing_id,user_id' });
  if (error) throw error;
}

export async function unlikeListingForGroup(userId: string, groupId: string, listingId: string): Promise<void> {
  if (!userId) return;
  await supabase
    .from('group_listing_likes')
    .delete()
    .eq('group_id', groupId)
    .eq('listing_id', listingId)
    .eq('user_id', userId);
}

export interface GroupShortlistListing {
  listing_id: string;
  like_count: number;
  liked_by: { user_id: string; name?: string; avatar_url?: string }[];
  listing?: any;
}

export async function getGroupShortlist(groupId: string): Promise<GroupShortlistListing[]> {
  try {
    const { data: likes, error } = await supabase
      .from('group_listing_likes')
      .select('listing_id, user_id, user:users(id, full_name, avatar_url)')
      .eq('group_id', groupId);
    if (error) throw error;

    const byListing: Record<string, { users: { user_id: string; name: string; avatar_url: string | null }[] }> = {};
    for (const like of (likes || [])) {
      if (!byListing[like.listing_id]) {
        byListing[like.listing_id] = { users: [] };
      }
      const userRef = like.user as SupabaseUserRef | null;
      byListing[like.listing_id].users.push({
        user_id: like.user_id,
        name: userRef?.full_name || 'Unknown',
        avatar_url: userRef?.avatar_url || null,
      });
    }

    const listingIds = Object.keys(byListing);
    if (listingIds.length === 0 && shouldLoadMockData()) {
      return getGroupShortlistFromLocal(groupId);
    }
    if (listingIds.length === 0) return [];

    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, address, city, state, rent, bedrooms, photos')
      .in('id', listingIds);

    const listingMap: Record<string, any> = {};
    for (const l of (listings || [])) {
      listingMap[l.id] = l;
    }

    return listingIds
      .map(lid => ({
        listing_id: lid,
        like_count: byListing[lid].users.length,
        liked_by: byListing[lid].users,
        listing: listingMap[lid] || null,
      }))
      .sort((a, b) => b.like_count - a.like_count);
  } catch {
    if (shouldLoadMockData()) return getGroupShortlistFromLocal(groupId);
    return [];
  }
}

async function getGroupShortlistFromLocal(groupId: string): Promise<GroupShortlistListing[]> {
  try {
    const local = await AsyncStorage.getItem(`@rhome/group_shortlist_${groupId}`);
    if (!local) return [];
    const items = JSON.parse(local);

    let listingMap: Record<string, any> = {};
    try {
      const propsData = await AsyncStorage.getItem('@rhome/properties');
      if (propsData) {
        const props = JSON.parse(propsData);
        for (const p of props) {
          listingMap[p.id] = {
            id: p.id,
            title: p.title || p.address,
            address: p.address,
            city: p.city || p.neighborhood,
            state: p.state,
            rent: p.rent || p.price,
            bedrooms: p.bedrooms,
            photos: p.photos || p.images,
          };
        }
      }
    } catch {
      console.warn('[getGroupShortlist] Failed to load local properties for hydration');
    }

    return items.map((item: any) => ({
      listing_id: item.listing_id,
      like_count: item.vote_count || 1,
      liked_by: [{ user_id: item.added_by, name: 'Group Member' }],
      listing: listingMap[item.listing_id] || { id: item.listing_id, title: 'Listing', rent: 0, bedrooms: 0 },
    }));
  } catch (e) {
    console.warn('[getGroupShortlist] Local fallback failed:', e);
    return [];
  }
}

export interface TourEventInput {
  groupId: string;
  listingId?: string;
  tourDate: string;
  tourTime: string;
  durationMinutes?: number;
  location?: string;
  notes?: string;
}

export async function createTourEvent(userId: string, input: TourEventInput) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('group_tour_events')
    .insert({
      group_id: input.groupId,
      listing_id: input.listingId || null,
      created_by: userId,
      tour_date: input.tourDate,
      tour_time: input.tourTime,
      duration_minutes: input.durationMinutes || 30,
      location: input.location || null,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', input.groupId)
    .eq('status', 'active');

  const rsvpRows = (members || []).map((m: any) => ({
    tour_id: data.id,
    user_id: m.user_id,
    status: m.user_id === userId ? 'going' : 'pending',
    responded_at: m.user_id === userId ? new Date().toISOString() : null,
  }));

  if (rsvpRows.length > 0) {
    await supabase.from('group_tour_rsvps').insert(rsvpRows);
  }

  return data;
}

export async function getGroupTours(groupId: string) {
  try {
    const { data, error } = await supabase
      .from('group_tour_events')
      .select(`
        *,
        rsvps:group_tour_rsvps(user_id, status, responded_at),
        creator:users!created_by(full_name, avatar_url),
        listing:listings(id, title, address, city, photos)
      `)
      .eq('group_id', groupId)
      .order('tour_date', { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch (e) {
    console.warn('[getGroupTours] Supabase query failed, checking local storage');
  }

  if (!shouldLoadMockData()) return [];

  try {
    const local = await AsyncStorage.getItem(`@rhome/group_tours_${groupId}`);
    if (local) return JSON.parse(local);
  } catch (e) {
    console.warn('[getGroupTours] Local fallback failed:', e);
  }

  return [];
}

export async function updateTourRSVP(userId: string, tourId: string, status: 'going' | 'maybe' | 'not_going'): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  await supabase.from('group_tour_rsvps').upsert({
    tour_id: tourId,
    user_id: userId,
    status,
    responded_at: new Date().toISOString(),
  }, { onConflict: 'tour_id,user_id' });
}

export async function cancelTourEvent(tourId: string): Promise<void> {
  await supabase
    .from('group_tour_events')
    .update({ status: 'cancelled' })
    .eq('id', tourId);
}

export async function transferGroupLead(userId: string, groupId: string, newLeadId: string): Promise<void> {
  if (!userId) throw new Error('Not authenticated');

  await supabase
    .from('preformed_groups')
    .update({ group_lead_id: newLeadId })
    .eq('id', groupId)
    .eq('group_lead_id', userId);
}

export async function sendGroupMessageWithMentions(
  userId: string,
  groupId: string,
  content: string,
  mentionedUserIds: string[],
  replyToId?: string
) {
  const { data: message, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: userId,
      content,
      reply_to_id: replyToId || null,
      metadata: mentionedUserIds.length > 0 ? { mentions: mentionedUserIds } : null,
    })
    .select()
    .single();
  if (error) throw error;

  if (mentionedUserIds.length > 0) {
    const mentionRows = mentionedUserIds.map(uid => ({
      message_id: message.id,
      mentioned_user_id: uid,
      group_id: groupId,
    }));
    await supabase.from('message_mentions').insert(mentionRows);
  }

  return message;
}

export async function pinMessage(groupId: string, messageId: string, userId: string) {
  const { error } = await supabase
    .from('pinned_messages')
    .insert({ group_id: groupId, message_id: messageId, pinned_by: userId });
  if (error) throw error;
}

export async function unpinMessage(groupId: string, messageId: string) {
  const { error } = await supabase
    .from('pinned_messages')
    .delete()
    .eq('group_id', groupId)
    .eq('message_id', messageId);
  if (error) throw error;
}

export async function getPinnedMessages(groupId: string) {
  const { data, error } = await supabase
    .from('pinned_messages')
    .select(`
      id, pinned_at, pinned_by,
      message:group_messages!message_id(id, content, sender_id, created_at)
    `)
    .eq('group_id', groupId)
    .order('pinned_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteGroupMessage(messageId: string, userId: string) {
  const { error } = await supabase
    .from('group_messages')
    .update({ deleted_at: new Date().toISOString(), content: 'This message was deleted' })
    .eq('id', messageId)
    .eq('sender_id', userId);
  if (error) throw error;
}

export async function editGroupMessage(messageId: string, userId: string, newContent: string) {
  const { error } = await supabase
    .from('group_messages')
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', userId);
  if (error) throw error;
}

export async function adminDeleteGroupMessage(messageId: string, groupId: string, adminId: string) {
  const { data: member } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', adminId)
    .single();

  if (!member?.is_admin) throw new Error('Not an admin');

  const { error } = await supabase
    .from('group_messages')
    .update({ deleted_at: new Date().toISOString(), content: 'This message was removed by an admin' })
    .eq('id', messageId);
  if (error) throw error;
}

export async function muteGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from('group_members')
    .update({ muted: true })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function unmuteGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from('group_members')
    .update({ muted: false })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateLastRead(groupId: string, userId: string, messageId: string) {
  const { error } = await supabase
    .from('group_members')
    .update({ last_read_message_id: messageId })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getUnreadMentionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('message_mentions')
    .select('id', { count: 'exact', head: true })
    .eq('mentioned_user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

export async function markMentionsRead(groupId: string, userId: string) {
  await supabase
    .from('message_mentions')
    .update({ read: true })
    .eq('group_id', groupId)
    .eq('mentioned_user_id', userId)
    .eq('read', false);
}

export async function updateGroupSettings(groupId: string, settings: Record<string, any>) {
  const { data: group } = await supabase
    .from('groups')
    .select('settings')
    .eq('id', groupId)
    .single();

  const merged = { ...(group?.settings || {}), ...settings };

  const { error } = await supabase
    .from('groups')
    .update({ settings: merged })
    .eq('id', groupId);
  if (error) throw error;
}

export async function getGroupMessagesEnhanced(groupId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('group_messages')
    .select(`
      *,
      sender:users!sender_id(id, full_name, avatar_url)
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

export async function getGroupMemberMuteStatus(groupId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('group_members')
    .select('muted')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();
  return data?.muted || false;
}

export async function getGroupSettings(groupId: string): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('groups')
    .select('settings')
    .eq('id', groupId)
    .single();
  return data?.settings || {};
}

export async function getReadStatusForMessage(groupId: string, messageId: string) {
  const { data } = await supabase
    .from('group_members')
    .select('user_id, last_read_message_id')
    .eq('group_id', groupId);

  if (!data) return [];
  return data.filter(m => m.last_read_message_id === messageId).map(m => m.user_id);
}
