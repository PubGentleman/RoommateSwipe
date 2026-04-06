import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PreformedGroup, PreformedGroupMember, GroupShortlistItem } from '../types/models';
import { shouldLoadMockData } from '../utils/dataUtils';
import { createErrorHandler } from '../utils/errorLogger';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createPreformedGroup(userId: string, params: {
  name?: string;
  groupSize: number;
  memberNames: string[];
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  bedroomCount?: number;
  moveInDate?: string;
}): Promise<PreformedGroup | null> {
  if (!userId) return null;

  const invite_code = generateInviteCode();

  let supabaseGroup: PreformedGroup | null = null;
  try {
    const supabasePromise = supabase
      .from('preformed_groups')
      .insert({
        name: params.name || null,
        group_lead_id: userId,
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

    const result = await Promise.race([
      supabasePromise,
      new Promise<{ data: null; error: { message: string } }>(resolve =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 5000)
      ),
    ]);

    if (result.data && !result.error) {
      supabaseGroup = result.data as PreformedGroup;

      supabase.from('preformed_group_members').insert({
        preformed_group_id: supabaseGroup.id,
        user_id: userId,
        name: 'You (Group Lead)',
        status: 'joined',
        joined_at: new Date().toISOString(),
      }).then(() => {});

      const memberInserts = params.memberNames.filter(n => n.trim()).map(name => ({
        preformed_group_id: supabaseGroup!.id,
        user_id: null,
        name: name.trim(),
        status: 'invited' as const,
      }));

      if (memberInserts.length > 0) {
        supabase.from('preformed_group_members').insert(memberInserts).then(() => {});
      }

      supabase.from('profiles').update({ is_group_lead: true }).eq('user_id', userId).then(() => {});

      return supabaseGroup;
    }
  } catch (e) {
    console.warn('[createPreformedGroup] Supabase failed:', e);
  }

  const now = new Date().toISOString();
  const localGroup: PreformedGroup = {
    id: `pfg-${userId.slice(0, 6)}-${Date.now()}`,
    name: params.name || 'My Group',
    group_lead_id: userId,
    group_size: params.groupSize,
    status: 'forming',
    invite_code,
    city: params.city || null,
    preferred_neighborhoods: [],
    combined_budget_min: params.budgetMin || null,
    combined_budget_max: params.budgetMax || null,
    desired_bedroom_count: params.bedroomCount || null,
    move_in_date: params.moveInDate || null,
    created_at: now,
    open_to_requests: false,
  } as PreformedGroup;

  const localMembers: PreformedGroupMember[] = [
    {
      id: `pgm-${userId.slice(0, 6)}-lead`,
      preformed_group_id: localGroup.id,
      user_id: userId,
      name: 'You',
      status: 'joined',
      invited_at: now,
      joined_at: now,
    },
    ...params.memberNames.filter(n => n.trim()).map((name, idx) => ({
      id: `pgm-${userId.slice(0, 6)}-inv-${idx}`,
      preformed_group_id: localGroup.id,
      user_id: null as any,
      name: name.trim(),
      status: 'invited' as const,
      invited_at: now,
      joined_at: null as any,
    })),
  ];

  await AsyncStorage.setItem(`@rhome/preformed_group_${userId}`, JSON.stringify(localGroup));
  await AsyncStorage.setItem(`@rhome/preformed_members_${localGroup.id}`, JSON.stringify(localMembers));
  await AsyncStorage.setItem(`@rhome/group_shortlist_${localGroup.id}`, JSON.stringify([]));
  await AsyncStorage.setItem(`@rhome/group_tours_${localGroup.id}`, JSON.stringify([]));

  return localGroup;
}

export async function getMyPreformedGroup(userId: string): Promise<PreformedGroup | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('preformed_groups')
    .select('*')
    .eq('group_lead_id', userId)
    .in('status', ['forming', 'ready', 'searching'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getMyPreformedGroup] Query error:', error);
    return null;
  }

  return data as PreformedGroup | null;
}

export async function getGroupByInviteCode(code: string): Promise<PreformedGroup | null> {
  const { data, error } = await supabase.rpc('lookup_preformed_group_by_code', {
    p_invite_code: code,
  });

  if (error || !data) return null;
  return data as PreformedGroup;
}

export async function getGroupMembers(groupId: string): Promise<PreformedGroupMember[]> {
  const supabasePromise = supabase
    .from('preformed_group_members')
    .select('*')
    .eq('preformed_group_id', groupId)
    .order('invited_at', { ascending: true })
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) return null;
      return data as PreformedGroupMember[];
    })
    .catch(createErrorHandler('preformedGroupService', 'getGroupMembers'));

  const localPromise = AsyncStorage.getItem(`@rhome/preformed_members_${groupId}`)
    .then(raw => (raw ? JSON.parse(raw) as PreformedGroupMember[] : null))
    .catch(createErrorHandler('preformedGroupService', 'getGroupMembersLocal'));

  const [supabaseResult, localResult] = await Promise.allSettled([supabasePromise, localPromise]);
  const supabaseMembers = supabaseResult.status === 'fulfilled' ? supabaseResult.value : null;
  const localMembers = localResult.status === 'fulfilled' ? localResult.value : null;

  return supabaseMembers || localMembers || [];
}

export async function joinGroupByCode(userId: string, code: string, userName: string): Promise<{ success: boolean; group?: PreformedGroup }> {
  if (!userId) return { success: false };

  const { data, error } = await supabase.rpc('join_preformed_group_by_code', {
    p_invite_code: code,
    p_user_name: userName,
  });

  if (error) return { success: false };

  const result = data as { success: boolean; group_id?: string; message?: string };
  if (!result.success || !result.group_id) return { success: false };

  const group = await getGroupById(result.group_id);
  return { success: true, group: group ?? undefined };
}

export async function acceptGroupInvite(userId: string, groupId: string): Promise<boolean> {
  if (!userId) return false;

  const { error } = await supabase
    .from('preformed_group_members')
    .update({
      status: 'joined',
      joined_at: new Date().toISOString(),
    })
    .eq('preformed_group_id', groupId)
    .eq('user_id', userId);

  if (error) return false;

  await supabase
    .from('profiles')
    .update({
      listing_type_preference: 'any',
      apartment_search_type: 'have_group',
    })
    .eq('user_id', userId);

  return true;
}

export async function declineGroupInvite(userId: string, groupId: string): Promise<boolean> {
  if (!userId) return false;

  const { error } = await supabase
    .from('preformed_group_members')
    .update({ status: 'declined' })
    .eq('preformed_group_id', groupId)
    .eq('user_id', userId);

  return !error;
}

export async function leavePreformedGroup(userId: string, groupId: string): Promise<boolean> {
  if (!userId) return false;

  const group = await getGroupById(groupId);
  if (!group) return false;

  if (group.group_lead_id === userId) {
    await supabase.from('preformed_group_members').delete().eq('preformed_group_id', groupId);
    await supabase.from('group_shortlist').delete().eq('preformed_group_id', groupId);
    await supabase.from('preformed_groups').delete().eq('id', groupId);
    await supabase.from('profiles').update({ is_group_lead: false }).eq('user_id', userId);
  } else {
    await supabase
      .from('preformed_group_members')
      .delete()
      .eq('preformed_group_id', groupId)
      .eq('user_id', userId);

    if (group.group_lead_id !== userId) {
      await supabase.from('notifications').insert({
        user_id: group.group_lead_id,
        type: 'group_member_left',
        title: 'A member left your group',
        body: `A member has left "${group.name || 'your group'}". You can find a replacement through Rhome.`,
        data: { groupId },
        read: false,
      });
    }
  }

  return true;
}

export async function enableReplacement(groupId: string, slots: number): Promise<boolean> {
  let supabaseOk = false;
  try {
    const { error } = await supabase
      .from('preformed_groups')
      .update({
        needs_replacement: true,
        replacement_slots: slots,
        open_to_requests: true,
      })
      .eq('id', groupId);
    supabaseOk = !error;
    if (error) console.warn('[enableReplacement] Supabase update failed:', error.message);
  } catch (e) {
    console.warn('[enableReplacement] Supabase threw:', e);
  }

  let localOk = false;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const groupKeys = keys.filter(k => k.startsWith('@rhome/preformed_group_') && !k.includes('members'));
    for (const key of groupKeys) {
      const val = await AsyncStorage.getItem(key);
      if (val) {
        const g = JSON.parse(val);
        if (g.id === groupId) {
          g.needs_replacement = true;
          g.replacement_slots = slots;
          g.open_to_requests = true;
          await AsyncStorage.setItem(key, JSON.stringify(g));
          localOk = true;
          break;
        }
      }
    }
  } catch (e) {
    console.warn('[enableReplacement] Local storage update failed:', e);
  }

  return supabaseOk || localOk;
}

export async function disableReplacement(groupId: string): Promise<boolean> {
  let supabaseOk = false;
  try {
    const { error } = await supabase
      .from('preformed_groups')
      .update({
        needs_replacement: false,
        replacement_slots: 0,
        open_to_requests: false,
      })
      .eq('id', groupId);
    supabaseOk = !error;
    if (error) console.warn('[disableReplacement] Supabase update failed:', error.message);
  } catch (e) {
    console.warn('[disableReplacement] Supabase threw:', e);
  }

  let localOk = false;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const groupKeys = keys.filter(k => k.startsWith('@rhome/preformed_group_') && !k.includes('members'));
    for (const key of groupKeys) {
      const val = await AsyncStorage.getItem(key);
      if (val) {
        const g = JSON.parse(val);
        if (g.id === groupId) {
          g.needs_replacement = false;
          g.replacement_slots = 0;
          g.open_to_requests = false;
          await AsyncStorage.setItem(key, JSON.stringify(g));
          localOk = true;
          break;
        }
      }
    }
  } catch (e) {
    console.warn('[disableReplacement] Local storage update failed:', e);
  }

  return supabaseOk || localOk;
}

export async function getGroupById(groupId: string): Promise<PreformedGroup | null> {
  const { data, error } = await supabase
    .from('preformed_groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (data) return data as PreformedGroup;

  if ((error || !data) && shouldLoadMockData()) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const groupKey = keys.find(k => k.startsWith('@rhome/preformed_group_') && !k.includes('members'));
      if (groupKey) {
        const raw = await AsyncStorage.getItem(groupKey);
        if (raw) {
          const g = JSON.parse(raw);
          if (g.id === groupId) return g as PreformedGroup;
        }
      }
    } catch (_) {}
  }

  return null;
}

export async function updateGroupPreferences(groupId: string, updates: {
  name?: string;
  city?: string;
  combined_budget_min?: number;
  combined_budget_max?: number;
  desired_bedroom_count?: number;
  move_in_date?: string;
  preferred_neighborhoods?: string[];
  group_size?: number;
}): Promise<boolean> {
  const { error } = await supabase
    .from('preformed_groups')
    .update(updates)
    .eq('id', groupId);

  if (error && shouldLoadMockData()) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const groupKey = keys.find(k => k.startsWith('@rhome/preformed_group_') && !k.includes('members'));
      if (groupKey) {
        const raw = await AsyncStorage.getItem(groupKey);
        if (raw) {
          const g = JSON.parse(raw);
          if (g.id === groupId) {
            Object.assign(g, updates);
            await AsyncStorage.setItem(groupKey, JSON.stringify(g));
            return true;
          }
        }
      }
    } catch (_) {}
  }

  return !error;
}

export async function addToShortlist(userId: string, groupId: string, listingId: string, notes?: string): Promise<boolean> {
  if (!userId) return false;

  const { error } = await supabase
    .from('group_shortlist')
    .upsert({
      preformed_group_id: groupId,
      listing_id: listingId,
      added_by: userId,
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
  const { data, error } = await supabase
    .from('group_shortlist')
    .select('*')
    .eq('preformed_group_id', groupId)
    .order('created_at', { ascending: false });

  if (data && data.length > 0) return data as GroupShortlistItem[];

  if ((error || !data || data.length === 0) && shouldLoadMockData()) {
    try {
      const local = await AsyncStorage.getItem(`@rhome/group_shortlist_${groupId}`);
      if (local) return JSON.parse(local) as GroupShortlistItem[];
    } catch (e) {
      console.warn('[getShortlist] Local fallback failed:', e);
    }
  }

  return [];
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
  let supabaseSuccess = false;

  try {
    const { error } = await supabase
      .from('preformed_group_members')
      .delete()
      .eq('preformed_group_id', groupId)
      .eq('id', memberId);
    supabaseSuccess = !error;
    if (error) console.warn('[removeMember] Supabase delete failed:', error.message);
  } catch (e) {
    console.warn('[removeMember] Supabase delete threw:', e);
  }

  let localSuccess = false;
  try {
    const localKey = `@rhome/preformed_members_${groupId}`;
    const local = await AsyncStorage.getItem(localKey);
    if (local) {
      const members = JSON.parse(local) as PreformedGroupMember[];
      const filtered = members.filter(m => m.id !== memberId);
      if (filtered.length < members.length) {
        await AsyncStorage.setItem(localKey, JSON.stringify(filtered));
        localSuccess = true;
      }
    }
  } catch (e) {
    console.warn('[removeMember] Local storage cleanup failed:', e);
  }

  return supabaseSuccess || localSuccess;
}

export async function getUserPreformedGroup(userId: string): Promise<PreformedGroup | null> {
  if (!userId) return null;

  const supabasePromise = supabase
    .from('preformed_group_members')
    .select('preformed_group_id')
    .eq('user_id', userId)
    .eq('status', 'joined')
    .limit(1)
    .maybeSingle()
    .then(async ({ data: memberData, error }) => {
      if (error || !memberData) return null;
      return getGroupById(memberData.preformed_group_id);
    })
    .catch(createErrorHandler('preformedGroupService', 'getGroupByMembership'));

  const localPromise = AsyncStorage.getItem(`@rhome/preformed_group_${userId}`)
    .then(raw => (raw ? JSON.parse(raw) as PreformedGroup : null))
    .catch(createErrorHandler('preformedGroupService', 'getGroupLocal'));

  const [supabaseResult, localResult] = await Promise.allSettled([supabasePromise, localPromise]);
  const supabaseGroup = supabaseResult.status === 'fulfilled' ? supabaseResult.value : null;
  const localGroup = localResult.status === 'fulfilled' ? localResult.value : null;

  return supabaseGroup || localGroup || null;
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
