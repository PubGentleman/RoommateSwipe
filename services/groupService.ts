import { supabase } from '../lib/supabase';

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
}

export async function getGroups(city?: string) {
  let query = supabase
    .from('groups')
    .select(`
      *,
      members:group_members(count),
      creator:users!created_by(id, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (city) query = query.eq('city', city);

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

export async function getMyGroups() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);

  const { data } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members(count),
      creator:users!created_by(id, full_name, avatar_url)
    `)
    .in('id', groupIds);

  return data || [];
}

export async function createGroup(group: GroupData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('groups')
    .insert({ created_by: user.id, ...group })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('group_members')
    .insert({ group_id: data.id, user_id: user.id, role: 'admin' });

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
}

export async function deleteGroup(id: string) {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
