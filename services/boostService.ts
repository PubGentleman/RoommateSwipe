import { supabase } from '../lib/supabase';

export async function getActiveBoost(userId: string) {
  if (!userId) return null;

  const { data } = await supabase
    .from('boosts')
    .select('id, user_id, type, is_active, expires_at, created_at, listing_id, includes_top_picks')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function activateBoost(userId: string, durationHours: number) {
  if (!userId) throw new Error('Not authenticated');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + durationHours);

  await supabase
    .from('boosts')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('boosts')
    .insert({
      user_id: userId,
      is_active: true,
      expires_at: expiresAt.toISOString(),
      duration_hours: durationHours,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateExpiredBoosts(userId: string) {
  if (!userId) return;

  await supabase
    .from('boosts')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString());
}
