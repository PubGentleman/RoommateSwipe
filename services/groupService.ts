import { supabase } from '../lib/supabase';
import { GroupType, GroupMember } from '../types/models';

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
      members:group_members(count),
      creator:users!created_by(id, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (city) query = query.eq('city', city);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getGroup(id: string) {
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(*, user:users(id, full_name, avatar_url, age, occupation)),
      creator:users!created_by(id, full_name, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getMyGroups(type?: GroupType) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  let query = supabase
    .from('groups')
    .select(`
      *,
      members:group_members(count),
      creator:users!created_by(id, full_name, avatar_url),
      listing:listings(id, title, photos, rent),
      host:users!host_id(id, full_name, avatar_url)
    `)
    .in('id', groupIds);

  if (type) query = query.eq('type', type);

  const { data } = await query;
  return data || [];
}

export async function getMyRoommateGroups() {
  return getMyGroups('roommate');
}

export async function getMyInquiryGroups() {
  return getMyGroups('listing_inquiry');
}

export async function createGroup(group: GroupData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('groups')
    .insert({
      created_by: user.id,
      type: group.type || 'roommate',
      is_visible_to_hosts: group.type === 'listing_inquiry' ? false : true,
      ...group,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('group_members')
    .insert({ group_id: data.id, user_id: user.id, role: 'admin', is_host: false });

  return data;
}

export async function createListingInquiryGroup(
  listingId: string,
  hostId: string,
  listingAddress: string,
  sourceGroupId: string | null,
  groupName: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let renterIds: string[] = [];

    if (sourceGroupId) {
      const { data: sourceMembers } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', sourceGroupId)
        .eq('status', 'active');

      renterIds = (sourceMembers || []).map(m => m.user_id);
    } else {
      renterIds = [user.id];
    }

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: groupName,
        type: 'listing_inquiry',
        listing_id: listingId,
        host_id: hostId,
        listing_address: listingAddress,
        source_group_id: sourceGroupId,
        created_by: user.id,
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
      user_id: hostId,
      role: 'member',
      is_host: true,
      status: 'active',
    });

    await supabase.from('group_members').insert(memberInserts);

    return group;
  } catch (supaError) {
    console.warn('[groupService] Supabase createListingInquiryGroup failed, using local fallback:', supaError);
    const localGroup = {
      id: `local-inquiry-${Date.now()}`,
      name: groupName,
      type: 'listing_inquiry' as const,
      listing_id: listingId,
      host_id: hostId,
      listing_address: listingAddress,
      source_group_id: sourceGroupId,
      created_by: 'local',
      is_archived: false,
      created_at: new Date().toISOString(),
      members: [],
      inquiry_status: 'pending',
    };
    const { StorageService } = await import('../utils/storage');
    const existingGroups = await StorageService.getGroups();
    existingGroups.push(localGroup as any);
    await StorageService.setGroups(existingGroups);
    return localGroup;
  }
}

export async function addMemberToGroup(groupId: string, userId: string, userRole: 'renter' | 'host' = 'renter') {
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
    })
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

export async function joinGroup(groupId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: user.id, role: 'member', status: 'active' })
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
        .eq('id', user.id)
        .single();

      const memberName = profile?.full_name || 'A new member';

      for (const inquiryGroup of inquiryGroups) {
        await supabase
          .from('group_members')
          .insert({
            group_id: inquiryGroup.id,
            user_id: user.id,
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

export async function leaveGroup(groupId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id);

  if (error) throw error;

  const { data: remaining } = await supabase
    .from('group_members')
    .select('user_id, is_host')
    .eq('group_id', groupId)
    .eq('status', 'active');

  const rentersLeft = (remaining || []).filter(m => !m.is_host);
  if (rentersLeft.length === 0) {
    await archiveGroup(groupId);
  }
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

export async function sendGroupMessage(groupId: string, content: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('group_messages').insert({
    group_id: groupId,
    sender_id: user.id,
    content,
  });
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
        const msg = payload.new as any;
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

export function getMemberLimit(plan: string): number {
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

export async function getInvitableMates(groupId: string): Promise<{
  id: string;
  name: string;
  photo?: string;
  alreadyInGroup: boolean;
  alreadyInvited: boolean;
}[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: conversations } = await supabase
    .from('conversations')
    .select('participant_ids')
    .contains('participant_ids', [user.id]);

  if (!conversations?.length) return [];

  const userIds = [...new Set(
    conversations.flatMap((c: any) => c.participant_ids)
  )].filter(id => id !== user.id);

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

export async function sendGroupInvite(groupId: string, invitedUserId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single();

  const { data: memberData } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  const creatorPlan = await getUserPlan(group?.created_by);
  const limit = getMemberLimit(creatorPlan);

  if ((memberData?.length || 0) >= limit) {
    throw new Error(`This group has reached its member limit of ${limit}.`);
  }

  const { error } = await supabase.from('group_invites').insert({
    group_id: groupId,
    invited_by: user.id,
    invited_user_id: invitedUserId,
    status: 'pending',
  });
  if (error && error.code !== '23505') throw error;
}

export async function respondToInvite(
  inviteId: string,
  response: 'accepted' | 'declined'
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: invite } = await supabase
    .from('group_invites')
    .update({ status: response })
    .eq('id', inviteId)
    .eq('invited_user_id', user.id)
    .select()
    .single();

  if (response === 'accepted' && invite) {
    const { data: group } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', invite.group_id)
      .single();

    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', invite.group_id);

    const creatorPlan = await getUserPlan(group?.created_by);
    const limit = getMemberLimit(creatorPlan);

    if ((memberData?.length || 0) >= limit) {
      await supabase
        .from('group_invites')
        .update({ status: 'pending' })
        .eq('id', inviteId);
      throw new Error(`This group is full (${limit} member limit).`);
    }

    await supabase.from('group_members').insert({
      group_id: invite.group_id,
      user_id: user.id,
      role: 'member',
    });
  }
}

export async function getMyPendingInvites(): Promise<{
  id: string;
  groupId: string;
  groupName: string;
  invitedByName: string;
  listingTitle?: string;
  createdAt: string;
}[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('group_invites')
    .select(`
      id, created_at, group_id,
      groups ( name, listings ( title ) ),
      inviter:users!invited_by ( full_name )
    `)
    .eq('invited_user_id', user.id)
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

export async function joinGroupByCode(code: string): Promise<{ groupId: string; groupName: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, invite_code_enabled, created_by')
    .eq('invite_code', code.toUpperCase())
    .single();

  if (!group) throw new Error('Invalid invite code. Please check and try again.');
  if (!group.invite_code_enabled) throw new Error('This invite link has been disabled.');

  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) throw new Error('You are already in this group.');

  const { data: memberData } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id);

  const creatorPlan = await getUserPlan(group.created_by);
  const limit = getMemberLimit(creatorPlan);

  if ((memberData?.length || 0) >= limit) {
    throw new Error(`This group is full (${limit} member limit).`);
  }

  const { error } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    role: 'member',
  });
  if (error) throw error;

  return { groupId: group.id, groupName: group.name };
}

// ─── METHOD D: Host Invites from Listing Interest ────────────────────────────

export async function getRentersInterestedInListing(listingId: string): Promise<{
  id: string;
  name: string;
  photo?: string;
  interestedAt: string;
}[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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
      members:group_members(count),
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
