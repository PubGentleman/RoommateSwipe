import { supabase } from '../lib/supabase';
import { applyBoostRotation } from '../utils/boostRotation';
import { getRecencyMultiplier, isWithinActivityCutoff } from '../utils/activityDecay';
import { getClosestNeighborhoodDistance } from '../utils/locationData';
import { getCachedDeckRanking, generateDeckReranking } from './piMatchingService';
import { RENTER_PLAN_LIMITS, normalizeRenterPlan } from '../constants/renterPlanLimits';
import { getWeightProfile, recordSwipeWithScores, recalculateLearnedWeights } from './matchWeightService';
import { calculateWeightedCompatibility } from '../utils/matchingAlgorithm';

export async function getSwipeDeck(userId: string, city?: string, filters?: {
  budgetMin?: number;
  budgetMax?: number;
  roomType?: string;
  minCompatibility?: number;
  neighborhoods?: string[];
  zipCode?: string;
  searchType?: string;
  genderPref?: string;
  gender?: string;
}) {
  if (!userId) return [];

  const [blockedResult, swipedResult] = await Promise.all([
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
    supabase.from('interest_cards').select('recipient_id').eq('sender_id', userId),
  ]);
  const blocked = (blockedResult.data || []).map((b: any) => b.blocked_id);
  const swiped = (swipedResult.data || []).map((s: any) => s.recipient_id);

  const excludeIds = [...blocked, ...swiped, userId];

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

  let currentSearchType: string | undefined = filters?.searchType;
  let genderPref: string | undefined = filters?.genderPref;
  let currentGender: string | undefined = filters?.gender;

  if (!currentSearchType || !genderPref || !currentGender) {
    const [profileResult, userDataResult] = await Promise.all([
      (!currentSearchType || !genderPref)
        ? supabase.from('profiles').select('apartment_search_type, household_gender_preference').eq('user_id', userId).single()
        : Promise.resolve({ data: null }),
      !currentGender
        ? supabase.from('users').select('gender').eq('id', userId).single()
        : Promise.resolve({ data: null }),
    ]);

    if (!currentSearchType) currentSearchType = profileResult.data?.apartment_search_type;
    if (!genderPref) genderPref = profileResult.data?.household_gender_preference;
    if (!currentGender) currentGender = userDataResult.data?.gender;
  }

  let profiles = (data || []).filter(p => {
    if (p.profile?.search_paused === true) return false;
    const photos = p.profile?.photos || p.photos || [];
    if (!Array.isArray(photos) || photos.length < 1) return false;
    const pSearchType = p.profile?.apartment_search_type;
    if (pSearchType === 'solo' || pSearchType === 'with_partner') return false;
    return true;
  });

  if (currentSearchType === 'solo' || currentSearchType === 'with_partner') {
    return [];
  }

  if (genderPref && genderPref !== 'any') {
    profiles = profiles.filter(p => {
      const candidateGender = p.gender;
      if (!candidateGender) return true;
      if (genderPref === 'female_only' && candidateGender !== 'female') return false;
      if (genderPref === 'male_only' && candidateGender !== 'male') return false;
      if (genderPref === 'same_gender' && currentGender && candidateGender !== currentGender) return false;
      return true;
    });
  }

  if (currentGender) {
    profiles = profiles.filter(p => {
      const candidatePref = p.profile?.household_gender_preference;
      if (!candidatePref || candidatePref === 'any') return true;
      if (candidatePref === 'female_only' && currentGender !== 'female') return false;
      if (candidatePref === 'male_only' && currentGender !== 'male') return false;
      if (candidatePref === 'same_gender') {
        const candidateGender = p.gender;
        if (candidateGender && candidateGender !== currentGender) return false;
      }
      return true;
    });
  }

  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('dealbreakers, smoking, pets, pet_type, guest_policy')
    .eq('user_id', userId)
    .single();

  if (currentUserProfile?.dealbreakers?.length > 0) {
    profiles = profiles.filter(p => {
      const candidateProfile = p.profile || {};
      for (const db of currentUserProfile.dealbreakers) {
        switch (db) {
          case 'no_smokers':
            if (candidateProfile.smoking === 'yes' || candidateProfile.smoking === 'only_outside') return false;
            break;
          case 'no_cats':
            if (candidateProfile.pets === 'have_pets' && candidateProfile.pet_type === 'cat') return false;
            break;
          case 'no_dogs':
            if (candidateProfile.pets === 'have_pets' && candidateProfile.pet_type === 'dog') return false;
            break;
          case 'no_pets':
            if (candidateProfile.pets === 'have_pets') return false;
            break;
          case 'no_overnight_guests':
            if (candidateProfile.guest_policy === 'frequently') return false;
            break;
        }
      }
      return true;
    });
  }

  if (currentUserProfile) {
    profiles = profiles.filter(p => {
      const candidateDealbreakers: string[] = p.profile?.dealbreakers || [];
      for (const db of candidateDealbreakers) {
        switch (db) {
          case 'no_smokers':
            if (currentUserProfile.smoking === 'yes' || currentUserProfile.smoking === 'only_outside') return false;
            break;
          case 'no_cats':
            if (currentUserProfile.pets === 'have_pets' && currentUserProfile.pet_type === 'cat') return false;
            break;
          case 'no_dogs':
            if (currentUserProfile.pets === 'have_pets' && currentUserProfile.pet_type === 'dog') return false;
            break;
          case 'no_pets':
            if (currentUserProfile.pets === 'have_pets') return false;
            break;
          case 'no_overnight_guests':
            if (currentUserProfile.guest_policy === 'frequently') return false;
            break;
        }
      }
      return true;
    });
  }

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
      _decayScore: getRecencyMultiplier(p.last_active_at),
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

  let finalDeck = applyBoostRotation(boosted, normal, userId);

  const hasPiReranking = await checkPiDeckReranking(userId);
  if (hasPiReranking && finalDeck.length >= 5) {
    try {
      const cached = await getCachedDeckRanking(userId);
      if (cached) {
        finalDeck = applyAIRanking(finalDeck, cached.ranked_user_ids);
      } else {
        const top30Ids = finalDeck.slice(0, 30).map((p: any) => p.id);
        generateDeckReranking(userId, top30Ids).catch(() => {});
      }
    } catch {}
  }

  return finalDeck;
}

export async function sendLike(
  userId: string,
  recipientId: string,
  matchScore?: number,
  matchBreakdown?: Record<string, number>
) {
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('interest_cards')
    .insert({ sender_id: userId, recipient_id: recipientId, action: 'like' })
    .select()
    .single();

  if (error) throw error;

  incrementUsage(userId, 'interest_cards_today').catch(() => {});

  supabase.functions.invoke('calculate-match-scores', {
    body: { userId },
  }).catch(() => {});

  supabase.functions.invoke('send-push-notification', {
    body: {
      userId: recipientId,
      type: 'interest_received',
      title: 'Someone likes you!',
      body: 'Open Rhome to see who sent you interest',
      data: {},
    },
  }).catch(() => {});

  if (matchBreakdown && matchScore !== undefined) {
    recordSwipeWithScores(userId, recipientId, 'like', matchScore, matchBreakdown).catch(() => {});
    triggerWeightRecalculation(userId);
  }

  const matchPromise = supabase
    .from('matches')
    .select('*')
    .or(`and(user_id_1.eq.${userId},user_id_2.eq.${recipientId}),and(user_id_1.eq.${recipientId},user_id_2.eq.${userId})`)
    .eq('status', 'matched')
    .single()
    .then(({ data: match }) => match)
    .catch(() => null);

  return { interestCard: data, matchPromise };
}

export async function sendPass(
  userId: string,
  recipientId: string,
  matchScore?: number,
  matchBreakdown?: Record<string, number>
) {
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('interest_cards')
    .insert({ sender_id: userId, recipient_id: recipientId, action: 'pass' });

  if (error) throw error;

  if (matchBreakdown && matchScore !== undefined) {
    recordSwipeWithScores(userId, recipientId, 'pass', matchScore, matchBreakdown).catch(() => {});
    triggerWeightRecalculation(userId);
  }
}

const swipeCounters: Record<string, number> = {};

function triggerWeightRecalculation(userId: string) {
  swipeCounters[userId] = (swipeCounters[userId] || 0) + 1;
  if (swipeCounters[userId] % 10 === 0) {
    recalculateLearnedWeights(userId).catch(() => {});
  }
}

export async function undoLastAction(userId: string) {
  if (!userId) throw new Error('Not authenticated');

  const { data: lastCard } = await supabase
    .from('interest_cards')
    .select('*')
    .eq('sender_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastCard) throw new Error('No action to undo');

  await supabase
    .from('interest_cards')
    .delete()
    .eq('id', lastCard.id);

  await incrementUsage(userId, 'rewinds_today');

  return lastCard;
}

export async function getReceivedInterestCards(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, sender:users!sender_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('recipient_id', userId)
    .in('action', ['like', 'super_interest'])
    .order('created_at', { ascending: false });

  return data || [];
}

export async function acceptInterestCard(userId: string, cardId: string, senderId: string) {
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('interest_cards')
    .update({ status: 'accepted', responded_at: now })
    .eq('id', cardId);

  if (updateError) throw updateError;

  const userId1 = userId < senderId ? userId : senderId;
  const userId2 = userId < senderId ? senderId : userId;

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

  supabase.functions.invoke('send-push-notification', {
    body: {
      userId: senderId,
      type: 'interest_accepted',
      title: "It's a match!",
      body: 'Someone accepted your interest. Start chatting!',
      data: { matchId: match?.id },
    },
  }).catch(() => {});

  return { match };
}

export async function rejectInterestCard(userId: string, cardId: string) {
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('interest_cards')
    .update({ status: 'passed', responded_at: now })
    .eq('id', cardId);

  if (error) throw error;
}

async function incrementUsage(userId: string, field: string) {
  if (!userId) return;

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
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
    .eq('user_id', userId);
}

export async function getUsage(userId: string) {
  if (!userId) return null;

  const { data } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .single();

  return data;
}

export async function getSentInterestCards(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, recipient:users!recipient_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('sender_id', userId)
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

export async function getInterestCardsForHost(userId: string) {
  if (!userId) return [];

  const { data } = await supabase
    .from('interest_cards')
    .select('*, sender:users!sender_id(id, full_name, avatar_url, age, occupation, city)')
    .eq('recipient_id', userId)
    .in('action', ['like', 'super_interest'])
    .order('created_at', { ascending: false });

  return data || [];
}

export async function saveRefinementAnswer(userId: string, questionId: string, value: string): Promise<{ success: boolean }> {
  if (!userId) return { success: false };

  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('personality_answers')
    .eq('user_id', userId)
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
    .eq('user_id', userId);

  if (updateError) {
    console.error('[saveRefinementAnswer] Failed to update profile:', updateError.message);
    return { success: false };
  }

  const { error: memoryError } = await supabase
    .from('user_ai_memory')
    .insert({
      user_id: userId,
      memory_text: `Refinement answer: ${questionId} = ${value}`,
      memory_type: 'refinement',
    });

  if (memoryError) {
    console.warn('[saveRefinementAnswer] AI memory insert failed:', memoryError.message);
  }

  return { success: true };
}

function applyAIRanking(deck: any[], rankedIds: string[]): any[] {
  const top30 = deck.slice(0, 30);
  const remainder = deck.slice(30);

  const top30Ids = new Set(top30.map((p: any) => p.id));
  const overlap = rankedIds.filter(id => top30Ids.has(id));
  if (overlap.length < top30.length * 0.5) {
    return deck;
  }

  const top30Map = new Map<string, any>();
  for (const p of top30) {
    top30Map.set(p.id, p);
  }

  const reorderedTop: any[] = [];
  const usedIds = new Set<string>();

  for (const id of rankedIds) {
    if (usedIds.has(id)) continue;
    const profile = top30Map.get(id);
    if (profile) {
      reorderedTop.push(profile);
      usedIds.add(id);
    }
  }

  for (const p of top30) {
    if (!usedIds.has(p.id)) {
      reorderedTop.push(p);
    }
  }

  return [...reorderedTop, ...remainder];
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
