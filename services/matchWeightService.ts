import { supabase } from '../lib/supabase';

export interface MatchWeightProfile {
  user_id: string;
  weight_location: number;
  weight_budget: number;
  weight_sleep: number;
  weight_cleanliness: number;
  weight_smoking: number;
  weight_pets: number;
  weight_lifestyle: number;
  weight_social: number;
  learned_weights: Record<string, number>;
  total_swipes_analyzed: number;
}

const BASE_ALLOCATIONS: Record<string, number> = {
  location: 16,
  budget: 12,
  sleep: 12,
  cleanliness: 12,
  smoking: 10,
  pets: 4,
  lifestyle: 2,
  social: 6,
  age: 8,
  move_in: 4,
  work: 6,
  expenses: 2,
  zodiac: 2,
  personality: 2,
};

export async function getWeightProfile(userId: string): Promise<MatchWeightProfile> {
  const { data, error } = await supabase
    .from('match_weight_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    const { data: newData, error: createError } = await supabase
      .from('match_weight_profiles')
      .insert({ user_id: userId })
      .select()
      .single();
    if (createError) throw createError;
    return newData;
  }
  if (error) throw error;
  return data;
}

export async function updateWeightProfile(
  userId: string,
  weights: Partial<Pick<MatchWeightProfile,
    'weight_location' | 'weight_budget' | 'weight_sleep' | 'weight_cleanliness' |
    'weight_smoking' | 'weight_pets' | 'weight_lifestyle' | 'weight_social'
  >>
): Promise<MatchWeightProfile> {
  const { data, error } = await supabase
    .from('match_weight_profiles')
    .update({ ...weights, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function computeEffectiveWeights(
  profile: MatchWeightProfile
): Record<string, number> {
  const userWeights: Record<string, number> = {
    location: profile.weight_location,
    budget: profile.weight_budget,
    sleep: profile.weight_sleep,
    cleanliness: profile.weight_cleanliness,
    smoking: profile.weight_smoking,
    pets: profile.weight_pets,
    lifestyle: profile.weight_lifestyle,
    social: profile.weight_social,
  };

  const learned = profile.learned_weights || {};
  const blended: Record<string, number> = {};

  for (const key of Object.keys(userWeights)) {
    const userW = userWeights[key] / 5;
    const learnedW = learned[key] ?? 1.0;

    if (profile.total_swipes_analyzed >= 20) {
      blended[key] = (userW * 0.7) + (learnedW * 0.3);
    } else {
      blended[key] = userW;
    }
  }

  blended['age'] = 1.0;
  blended['move_in'] = 1.0;
  blended['work'] = 1.0;
  blended['expenses'] = 1.0;
  blended['zodiac'] = 1.0;
  blended['personality'] = 1.0;

  return blended;
}

export async function recordSwipeWithScores(
  userId: string,
  targetUserId: string,
  action: 'like' | 'pass' | 'super_like',
  totalScore: number,
  scoreBreakdown: Record<string, number>
): Promise<void> {
  const { error } = await supabase
    .from('swipe_analytics')
    .insert({
      user_id: userId,
      target_user_id: targetUserId,
      action,
      total_score: totalScore,
      score_breakdown: scoreBreakdown,
    });

  if (error) console.error('Failed to record swipe analytics:', error);
}

export async function updateSwipeOutcome(
  userId: string,
  targetUserId: string,
  outcome: { resulted_in_match?: boolean; resulted_in_conversation?: boolean; conversation_message_count?: number }
): Promise<void> {
  const { error } = await supabase
    .from('swipe_analytics')
    .update(outcome)
    .eq('user_id', userId)
    .eq('target_user_id', targetUserId);

  if (error) console.error('Failed to update swipe outcome:', error);
}

export async function recalculateLearnedWeights(userId: string): Promise<void> {
  const { data: swipes, error } = await supabase
    .from('swipe_analytics')
    .select('action, score_breakdown')
    .eq('user_id', userId)
    .not('score_breakdown', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !swipes || swipes.length < 20) return;

  const factors = ['location', 'budget', 'sleep', 'cleanliness', 'smoking', 'pets', 'lifestyle', 'social'];

  const likes = swipes.filter(s => s.action === 'like' || s.action === 'super_like');
  const passes = swipes.filter(s => s.action === 'pass');

  const learnedWeights: Record<string, number> = {};
  for (const factor of factors) {
    const likeScores = likes.map(s => (s.score_breakdown as any)?.[factor] || 0);
    const passScores = passes.map(s => (s.score_breakdown as any)?.[factor] || 0);

    const likeAvg = likeScores.length > 0
      ? likeScores.reduce((a, b) => a + b, 0) / likeScores.length
      : 0;
    const passAvg = passScores.length > 0
      ? passScores.reduce((a, b) => a + b, 0) / passScores.length
      : 0;

    const maxPossible = BASE_ALLOCATIONS[factor] || 10;
    const differential = (likeAvg - passAvg) / maxPossible;
    learnedWeights[factor] = Math.max(0.5, Math.min(1.5, 1.0 + differential));
  }

  await supabase
    .from('match_weight_profiles')
    .update({
      learned_weights: learnedWeights,
      total_swipes_analyzed: swipes.length,
      last_recalculated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}
