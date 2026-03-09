import { supabase } from '../lib/supabase';

export async function getActiveBoost() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('boosts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function activateBoost(durationHours: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + durationHours);

  await supabase
    .from('boosts')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('boosts')
    .insert({
      user_id: user.id,
      is_active: true,
      expires_at: expiresAt.toISOString(),
      duration_hours: durationHours,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateExpiredBoosts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('boosts')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString());
}
