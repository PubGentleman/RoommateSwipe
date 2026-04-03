import { supabase } from '../lib/supabase';

export async function sendSuperInterest(userId: string, recipientId: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data: ic, error: icError } = await supabase
    .from('interest_cards')
    .insert({ sender_id: userId, recipient_id: recipientId, action: 'super_interest' })
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
      data: { sender_id: userId },
    });

  await incrementSuperInterestUsage(userId);

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .or(`and(user_id_1.eq.${userId},user_id_2.eq.${recipientId}),and(user_id_1.eq.${recipientId},user_id_2.eq.${userId})`)
    .eq('status', 'matched')
    .single();

  return { interestCard: ic, match };
}

export async function getSuperInterestsSentThisMonth(userId: string) {
  if (!userId) return 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('interest_cards')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .eq('action', 'super_interest')
    .gte('created_at', monthStart.toISOString());

  return count || 0;
}

export async function getReceivedSuperInterests(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, sender:users!sender_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('recipient_id', userId)
    .eq('action', 'super_interest')
    .order('created_at', { ascending: false });

  return data || [];
}

async function incrementSuperInterestUsage(userId: string) {
  if (!userId) return;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('super_interests_this_month, super_interests_reset_date')
    .eq('user_id', userId)
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
      .eq('user_id', userId);
  } else {
    await supabase
      .from('usage_tracking')
      .update({
        super_interests_this_month: (usage.super_interests_this_month || 0) + 1,
      })
      .eq('user_id', userId);
  }
}
