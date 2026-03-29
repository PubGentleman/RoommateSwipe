import { supabase } from '../lib/supabase';
import { applyBoostRotation } from '../utils/boostRotation';
import { getRecencyMultiplier, isWithinActivityCutoff } from '../utils/activityDecay';
import { getClosestNeighborhoodDistance } from '../utils/locationData';
import { getCachedDeckRanking, generateDeckReranking } from './piMatchingService';
import { RENTER_PLAN_LIMITS, normalizeRenterPlan } from '../constants/renterPlanLimits';

export async function getSwipeDeck(city?: string, filters?: {
  budgetMin?: number;
  budgetMax?: number;
  roomType?: string;
  minCompatibility?: number;
  neighborhoods?: string[];
  zipCode?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [blockedResult, swipedResult] = await Promise.all([
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id),
    supabase.from('interest_cards').select('recipient_id').eq('sender_id', user.id),
  ]);
  const blocked = (blockedResult.data || []).map((b: any) => b.blocked_id);
  const swiped = (swipedResult.data || []).map((s: any) => s.recipient_id);

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
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .or('is_deleted.is.null,is_deleted.eq.false');

  if (city) {
    query = query.eq('city', city);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;

  let profiles = (data || []).filter(p => {
    if (p.profile?.search_paused === true) return false;
    const photos = p.profile?.photos || p.photos || [];
    return Array.isArray(photos) && photos.length >= 1;
  });

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

  let decayScored = profiles
    .filter((p: any) => isWithinActivityCutoff(p.last_active_at))
    .map((p: any) => ({
      ...p,
      _decayScore: (p.profile?.compatibility ?? 1) * getRecencyMultiplier(p.last_active_at),
    }))
    .sort((a: any, b: any) => b._decayScore - a._decayScore);

  if (filters?.neighborhoods && filters.neighborhoods.length > 0) {
    decayScored.sort((a: any, b: any) => {
      const aN = a.profile?.preferred_neighborhoods || [];
      const bN = b.profile?.preferred_neighborhoods || [];

      const aOverlap = aN.filter((n: string) => filters.neighborhoods!.includes(n)).length;
      const bOverlap = bN.filter((n: string) => filters.neighborhoods!.includes(n)).length;

      if (aOverlap !== bOverlap) return bOverlap - aOverlap;

      const aDist = getClosestNeighborhoodDistance(filters.neighborhoods!, aN);
      const bDist = getClosestNeighborhoodDistance(filters.neighborhoods!, bN);
      const aMin = aDist?.distance ?? 999;
      const bMin = bDist?.distance ?? 999;
      if (aMin !== bMin) return aMin - bMin;

      return b._decayScore - a._decayScore;
    });
  }

  const sortedProfiles = decayScored;

  const boosted = sortedProfiles.filter(p =>
    p.boost?.some((b: any) => b.is_active && new Date(b.expires_at) > new Date())
  );
  const normal = sortedProfiles.filter(p =>
    !p.boost?.some((b: any) => b.is_active && new Date(b.expires_at) > new Date())
  );

  let finalDeck = applyBoostRotation(boosted, normal, user.id);

  const hasPiReranking = await checkPiDeckReranking(user.id);
  if (hasPiReranking && finalDeck.length >= 5) {
    try {
      const cached = await getCachedDeckRanking();
      if (cached) {
        finalDeck = applyAIRanking(finalDeck, cached.ranked_user_ids);
      } else {
        const top30Ids = finalDeck.slice(0, 30).map((p: any) => p.id);
        generateDeckReranking(top30Ids).catch(() => {});
      }
    } catch {}
  }

  return finalDeck;
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

  incrementUsage('interest_cards_today').catch(() => {});

  supabase.functions.invoke('calculate-match-scores', {
    body: { userId: user.id },
  }).catch(() => {});

  const matchPromise = supabase
    .from('matches')
    .select('*')
    .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${recipientId}),and(user_id_1.eq.${recipientId},user_id_2.eq.${user.id})`)
    .eq('status', 'matched')
    .single()
    .then(({ data: match }) => match)
    .catch(() => null);

  return { interestCard: data, matchPromise };
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

export async function saveRefinementAnswer(questionId: string, value: string): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('personality_answers')
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
    console.error('[saveRefinementAnswer] Failed to fetch profile:', fetchError.message);
    return { success: false };
  }

  const updated = {
    ...(profile?.personality_answers || {}),
    [questionId]: value,
    [`${questionId}_source`]: 'ai_refinement',
    [`${questionId}_collectedAt`]: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ personality_answers: updated })
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[saveRefinementAnswer] Failed to update profile:', updateError.message);
    return { success: false };
  }

  const { error: memoryError } = await supabase
    .from('user_ai_memory')
    .insert({
      user_id: user.id,
      memory_text: `Refinement answer: ${questionId} = ${value}`,
      memory_type: 'refinement',
    });

  if (memoryError) {
    console.warn('[saveRefinementAnswer] AI memory insert failed:', memoryError.message);
  }

  return { success: true };
}

function applyAIRanking(deck: any[], rankedIds: string[]): any[] {
  const idToProfile = new Map<string, any>();
  for (const p of deck) {
    idToProfile.set(p.id, p);
  }

  const reordered: any[] = [];
  const usedIds = new Set<string>();

  for (const id of rankedIds) {
    const profile = idToProfile.get(id);
    if (profile) {
      reordered.push(profile);
      usedIds.add(id);
    }
  }

  for (const p of deck) {
    if (!usedIds.has(p.id)) {
      reordered.push(p);
    }
  }

  return reordered;
}

async function checkPiDeckReranking(userId: string): Promise<boolean> {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .single();

    const plan = normalizeRenterPlan(sub?.plan);
    return RENTER_PLAN_LIMITS[plan]?.hasPiDeckReranking === true;
  } catch {
    return false;
  }
}
