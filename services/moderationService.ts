import { supabase } from '../lib/supabase';

export async function reportUser(userId: string, reportedId: string, reason: string, details?: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: userId,
      reported_id: reportedId,
      reported_type: 'user',
      reason,
      details,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function reportListing(userId: string, listingId: string, reason: string, details?: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: userId,
      reported_id: listingId,
      reported_type: 'listing',
      reason,
      details,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function reportGroup(userId: string, groupId: string, reason: string, details?: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: userId,
      reported_id: groupId,
      reported_type: 'group',
      reason,
      details,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const { data } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  return (data || []).map(b => b.blocked_id);
}

export async function blockUser(userId: string, blockedId: string) {
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: userId, blocked_id: blockedId });

  if (error) throw error;
}

export async function unblockUser(userId: string, blockedId: string) {
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedId);

  if (error) throw error;
}

export async function getBlockedUsers(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('blocked_users')
    .select('*, blocked:users!blocked_id(id, full_name, avatar_url)')
    .eq('blocker_id', userId);

  return data || [];
}

export async function isUserBlocked(userId: string, otherUserId: string): Promise<boolean> {
  if (!userId) return false;

  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`)
    .limit(1);

  return (data?.length || 0) > 0;
}
