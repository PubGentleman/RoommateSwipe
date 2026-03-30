import { supabase } from '../lib/supabase';
import { PreformedGroup, PreformedGroupMember, GroupShortlistItem } from '../types/models';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createPreformedGroup(params: {
  name?: string;
  groupSize: number;
  memberNames: string[];
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  bedroomCount?: number;
  moveInDate?: string;
}): Promise<PreformedGroup | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const invite_code = generateInviteCode();

  const { data: group, error } = await supabase
    .from('preformed_groups')
    .insert({
      name: params.name || null,
      group_lead_id: user.id,
      group_size: params.groupSize,
      invite_code,
      city: params.city || null,
      combined_budget_min: params.budgetMin || null,
      combined_budget_max: params.budgetMax || null,
      desired_bedroom_count: params.bedroomCount || null,
      move_in_date: params.moveInDate || null,
      status: 'forming',
    })
    .select()
    .single();

  if (error || !group) return null;

  await supabase.from('preformed_group_members').insert({
    preformed_group_id: group.id,
    user_id: user.id,
    name: 'You (Group Lead)',
    status: 'joined',
    joined_at: new Date().toISOString(),
  });

  const memberInserts = params.memberNames.filter(n => n.trim()).map(name => ({
    preformed_group_id: group.id,
    user_id: null,
    name: name.trim(),
    status: 'invited' as const,
  }));

  if (memberInserts.length > 0) {
    await supabase.from('preformed_group_members').insert(memberInserts);
  }

  await supabase
    .from('profiles')
    .update({ is_group_lead: true })
    .eq('user_id', user.id);

  return group as PreformedGroup;
}

export async function getMyPreformedGroup(): Promise<PreformedGroup | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('preformed_groups')
    .select('*')
    .eq('group_lead_id', user.id)
    .in('status', ['forming', 'ready', 'searching'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data as PreformedGroup | null;
}

export async function getGroupByInviteCode(code: string): Promise<PreformedGroup | null> {
  const { data } = await supabase
    .from('preformed_groups')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single();

  return data as PreformedGroup | null;
}

export async function getGroupMembers(groupId: string): Promise<PreformedGroupMember[]> {
  const { data } = await supabase
    .from('preformed_group_members')
    .select('*')
    .eq('preformed_group_id', groupId)
    .order('invited_at', { ascending: true });

  return (data || []) as PreformedGroupMember[];
}

export async function joinGroupByCode(code: string, userName: string): Promise<{ success: boolean; group?: PreformedGroup }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const group = await getGroupByInviteCode(code);
  if (!group) return { success: false };

  const members = await getGroupMembers(group.id);
  const existingMember = members.find(m => m.user_id === user.id);
  if (existingMember) return { success: true, group };

  const pendingSlot = members.find(m => !m.user_id && m.status === 'invited');

  if (pendingSlot) {
    await supabase
      .from('preformed_group_members')
      .update({
        user_id: user.id,
        name: userName,
        status: 'joined',
        joined_at: new Date().toISOString(),
      })
      .eq('id', pendingSlot.id);
  } else {
    await supabase.from('preformed_group_members').insert({
      preformed_group_id: group.id,
      user_id: user.id,
      name: userName,
      status: 'joined',
      joined_at: new Date().toISOString(),
    });
  }

  await supabase
    .from('profiles')
    .update({
      listing_type_preference: 'any',
      apartment_search_type: 'have_group',
    })
    .eq('user_id', user.id);

  const updatedMembers = await getGroupMembers(group.id);
  const allJoined = updatedMembers.filter(m => m.status === 'joined').length >= group.group_size;
  if (allJoined) {
    await supabase
      .from('preformed_groups')
      .update({ status: 'ready' })
      .eq('id', group.id);
  }

  return { success: true, group };
}

export async function acceptGroupInvite(groupId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('preformed_group_members')
    .update({
      status: 'joined',
      joined_at: new Date().toISOString(),
    })
    .eq('preformed_group_id', groupId)
    .eq('user_id', user.id);

  if (error) return false;

  await supabase
    .from('profiles')
    .update({
      listing_type_preference: 'any',
      apartment_search_type: 'have_group',
    })
    .eq('user_id', user.id);

  return true;
}

export async function declineGroupInvite(groupId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('preformed_group_members')
    .update({ status: 'declined' })
    .eq('preformed_group_id', groupId)
    .eq('user_id', user.id);

  return !error;
}

export async function leavePreformedGroup(groupId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const group = await getGroupById(groupId);
  if (!group) return false;

  if (group.group_lead_id === user.id) {
    await supabase.from('preformed_group_members').delete().eq('preformed_group_id', groupId);
    await supabase.from('group_shortlist').delete().eq('preformed_group_id', groupId);
    await supabase.from('preformed_groups').delete().eq('id', groupId);
    await supabase.from('profiles').update({ is_group_lead: false }).eq('user_id', user.id);
  } else {
    await supabase
      .from('preformed_group_members')
      .delete()
      .eq('preformed_group_id', groupId)
      .eq('user_id', user.id);
  }

  return true;
}

export async function getGroupById(groupId: string): Promise<PreformedGroup | null> {
  const { data } = await supabase
    .from('preformed_groups')
    .select('*')
    .eq('id', groupId)
    .single();

  return data as PreformedGroup | null;
}

export async function updateGroupPreferences(groupId: string, updates: {
  name?: string;
  city?: string;
  combined_budget_min?: number;
  combined_budget_max?: number;
  desired_bedroom_count?: number;
  move_in_date?: string;
  preferred_neighborhoods?: string[];
}): Promise<boolean> {
  const { error } = await supabase
    .from('preformed_groups')
    .update(updates)
    .eq('id', groupId);

  return !error;
}

export async function addToShortlist(groupId: string, listingId: string, notes?: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('group_shortlist')
    .upsert({
      preformed_group_id: groupId,
      listing_id: listingId,
      added_by: user.id,
      notes: notes || null,
    }, { onConflict: 'preformed_group_id,listing_id' });

  return !error;
}

export async function removeFromShortlist(groupId: string, listingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_shortlist')
    .delete()
    .eq('preformed_group_id', groupId)
    .eq('listing_id', listingId);

  return !error;
}

export async function getShortlist(groupId: string): Promise<GroupShortlistItem[]> {
  const { data } = await supabase
    .from('group_shortlist')
    .select('*')
    .eq('preformed_group_id', groupId)
    .order('created_at', { ascending: false });

  return (data || []) as GroupShortlistItem[];
}

export async function voteOnShortlistItem(itemId: string, increment: number): Promise<boolean> {
  const { data: current } = await supabase
    .from('group_shortlist')
    .select('vote_count')
    .eq('id', itemId)
    .single();

  if (!current) return false;

  const { error } = await supabase
    .from('group_shortlist')
    .update({ vote_count: (current.vote_count || 0) + increment })
    .eq('id', itemId);

  return !error;
}

export async function updateShortlistNotes(itemId: string, notes: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_shortlist')
    .update({ notes })
    .eq('id', itemId);

  return !error;
}

export async function removeMember(groupId: string, memberId: string): Promise<boolean> {
  const { error } = await supabase
    .from('preformed_group_members')
    .delete()
    .eq('preformed_group_id', groupId)
    .eq('id', memberId);

  return !error;
}

export async function getUserPreformedGroup(): Promise<PreformedGroup | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberData } = await supabase
    .from('preformed_group_members')
    .select('preformed_group_id')
    .eq('user_id', user.id)
    .eq('status', 'joined')
    .limit(1)
    .single();

  if (!memberData) return null;

  return getGroupById(memberData.preformed_group_id);
}

export async function convertToRealGroup(preformedGroupId: string): Promise<string | null> {
  const group = await getGroupById(preformedGroupId);
  if (!group) return null;

  const members = await getGroupMembers(preformedGroupId);
  const joinedMembers = members.filter(m => m.status === 'joined' && m.user_id);

  if (joinedMembers.length < 2) return null;

  const { data: newGroup, error } = await supabase
    .from('groups')
    .insert({
      name: group.name || 'My Group',
      type: 'roommate',
      max_members: group.group_size,
    })
    .select()
    .single();

  if (error || !newGroup) return null;

  const memberInserts = joinedMembers.map((m, idx) => ({
    group_id: newGroup.id,
    user_id: m.user_id,
    role: idx === 0 ? 'admin' : 'member',
    status: 'active',
  }));

  await supabase.from('group_members').insert(memberInserts);

  await supabase
    .from('preformed_groups')
    .update({ converted_group_id: newGroup.id, status: 'ready' })
    .eq('id', preformedGroupId);

  return newGroup.id;
}
