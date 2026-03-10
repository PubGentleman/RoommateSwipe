import { supabase } from '../lib/supabase';

export async function sendSuperInterest(recipientId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: ic, error: icError } = await supabase
    .from('interest_cards')
    .insert({ sender_id: user.id, recipient_id: recipientId, action: 'super_interest' })
    .select()
    .single();

  if (icError) throw icError;

  await supabase
    .from('notifications')
    .insert({
      user_id: recipientId,
      type: 'super_interest',
      title: 'Super Interest!',
      body: 'Someone sent you a Super Interest!',
      data: { sender_id: user.id },
    });

  await incrementSuperInterestUsage();

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${recipientId}),and(user_id_1.eq.${recipientId},user_id_2.eq.${user.id})`)
    .eq('status', 'matched')
    .single();

  return { interestCard: ic, match };
}

export async function getSuperInterestsSentThisMonth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('interest_cards')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', user.id)
    .eq('action', 'super_interest')
    .gte('created_at', monthStart.toISOString());

  return count || 0;
}

export async function getReceivedSuperInterests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, sender:users!sender_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('recipient_id', user.id)
    .eq('action', 'super_interest')
    .order('created_at', { ascending: false });

  return data || [];
}

async function incrementSuperInterestUsage() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('super_interests_this_month, super_interests_reset_date')
    .eq('user_id', user.id)
    .single();

  if (!usage) return;

  const resetDate = new Date(usage.super_interests_reset_date);
  if (resetDate < monthStart) {
    await supabase
      .from('usage_tracking')
      .update({
        super_interests_this_month: 1,
        super_interests_reset_date: monthStart.toISOString(),
      })
      .eq('user_id', user.id);
  } else {
    await supabase
      .from('usage_tracking')
      .update({
        super_interests_this_month: (usage.super_interests_this_month || 0) + 1,
      })
      .eq('user_id', user.id);
  }
}
