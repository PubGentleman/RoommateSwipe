import { supabase } from '../lib/supabase';

export async function reportUser(reportedId: string, reason: string, details?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
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

export async function reportListing(listingId: string, reason: string, details?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
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

export async function blockUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: user.id, blocked_id: blockedId });

  if (error) throw error;
}

export async function unblockUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId);

  if (error) throw error;
}

export async function getBlockedUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('blocked_users')
    .select('*, blocked:users!blocked_id(id, full_name, avatar_url)')
    .eq('blocker_id', user.id);

  return data || [];
}

export async function isUserBlocked(otherUserId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`)
    .limit(1);

  return (data?.length || 0) > 0;
}
