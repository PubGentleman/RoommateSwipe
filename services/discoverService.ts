import { supabase } from '../lib/supabase';

export async function getSwipeDeck(city?: string, filters?: {
  budgetMin?: number;
  budgetMax?: number;
  roomType?: string;
  minCompatibility?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: blockedIds } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', user.id);
  const blocked = (blockedIds || []).map(b => b.blocked_id);

  const { data: alreadySwiped } = await supabase
    .from('interest_cards')
    .select('recipient_id')
    .eq('sender_id', user.id);
  const swiped = (alreadySwiped || []).map(s => s.recipient_id);

  const excludeIds = [...blocked, ...swiped, user.id];

  let query = supabase
    .from('users')
    .select(`
      *,
      profile:profiles(*),
      boost:boosts(is_active, expires_at)
    `)
    .eq('role', 'renter')
    .eq('onboarding_step', 'complete')
    .not('id', 'in', `(${excludeIds.join(',')})`);

  if (city) {
    query = query.eq('city', city);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;

  let profiles = data || [];

  if (filters?.budgetMin || filters?.budgetMax) {
    profiles = profiles.filter(p => {
      const budget = p.profile?.budget_max;
      if (!budget) return true;
      if (filters.budgetMin && budget < filters.budgetMin) return false;
      if (filters.budgetMax && budget > filters.budgetMax) return false;
      return true;
    });
  }

  if (filters?.roomType) {
    profiles = profiles.filter(p =>
      !p.profile?.room_type || p.profile.room_type === filters.roomType
    );
  }

  const boosted = profiles.filter(p =>
    p.boost?.some((b: any) => b.is_active && new Date(b.expires_at) > new Date())
  );
  const normal = profiles.filter(p =>
    !p.boost?.some((b: any) => b.is_active && new Date(b.expires_at) > new Date())
  );

  return [...boosted, ...normal];
}

export async function sendLike(recipientId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('interest_cards')
    .insert({ sender_id: user.id, recipient_id: recipientId, action: 'like' })
    .select()
    .single();

  if (error) throw error;

  await incrementUsage('interest_cards_today');

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${recipientId}),and(user_id_1.eq.${recipientId},user_id_2.eq.${user.id})`)
    .eq('status', 'matched')
    .single();

  return { interestCard: data, match };
}

export async function sendPass(recipientId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('interest_cards')
    .insert({ sender_id: user.id, recipient_id: recipientId, action: 'pass' });

  if (error) throw error;
}

export async function undoLastAction() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: lastCard } = await supabase
    .from('interest_cards')
    .select('*')
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastCard) throw new Error('No action to undo');

  await supabase
    .from('interest_cards')
    .delete()
    .eq('id', lastCard.id);

  await incrementUsage('rewinds_today');

  return lastCard;
}

export async function getReceivedInterestCards() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, sender:users!sender_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('recipient_id', user.id)
    .in('action', ['like', 'super_interest'])
    .order('created_at', { ascending: false });

  return data || [];
}

export async function acceptInterestCard(cardId: string, senderId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('interest_cards')
    .update({ status: 'accepted', responded_at: now })
    .eq('id', cardId);

  if (updateError) throw updateError;

  const userId1 = user.id < senderId ? user.id : senderId;
  const userId2 = user.id < senderId ? senderId : user.id;

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .upsert({
      user_id_1: userId1,
      user_id_2: userId2,
      match_type: 'mutual',
      status: 'matched',
    }, { onConflict: 'user_id_1,user_id_2' })
    .select()
    .single();

  if (matchError) throw matchError;

  return { match };
}

export async function rejectInterestCard(cardId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('interest_cards')
    .update({ status: 'passed', responded_at: now })
    .eq('id', cardId);

  if (error) throw error;
}

async function incrementUsage(field: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!usage) return;

  const today = new Date().toISOString().split('T')[0];
  const updates: any = {};

  if (field.includes('today') && usage[`${field.replace('_today', '_reset_date')}`] !== today) {
    updates[field] = 1;
    updates[`${field.replace('_today', '_reset_date')}`] = today;
  } else {
    updates[field] = (usage[field] || 0) + 1;
  }

  await supabase
    .from('usage_tracking')
    .update(updates)
    .eq('user_id', user.id);
}

export async function getUsage() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return data;
}

export async function getSentInterestCards() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, recipient:users!recipient_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('sender_id', user.id)
    .in('action', ['like', 'super_interest'])
    .order('created_at', { ascending: false });

  return data || [];
}

export async function updateInterestCardStatus(cardId: string, status: 'accepted' | 'passed') {
  const { data, error } = await supabase
    .from('interest_cards')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', cardId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getInterestCardsForHost() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, sender:users!sender_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('recipient_id', user.id)
    .in('action', ['like', 'super_interest'])
    .order('created_at', { ascending: false });

  return data || [];
}
