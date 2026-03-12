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
      creator:users!created_by(id, full_name, avatar_url)
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
  sourceGroupId: string,
  groupName: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: sourceMembers } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', sourceGroupId)
    .eq('status', 'active');

  const renterIds = (sourceMembers || []).map(m => m.user_id);

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name: groupName,
      type: 'listing_inquiry',
      listing_id: listingId,
      host_id: hostId,
      listing_address: listingAddress,
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
    .insert({ group_id: groupId, user_id: user.id, role: 'member' })
    .select()
    .single();

  if (error) throw error;
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
