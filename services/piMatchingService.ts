import { supabase } from '../lib/supabase';
import { getCompanyPiMonthlyLimit, AGENT_PLAN_LIMITS, PLAN_LIMITS } from '../constants/planLimits';
import { RENTER_PLAN_LIMITS } from '../constants/renterPlanLimits';
import type { HostPlan } from '../constants/planLimits';
import type { RenterPlan } from '../constants/renterPlanLimits';
import type {
  PiMatchInsight,
  PiDeckRanking,
  PiHostRecommendation,
  PiFeature,
  PiParsedPreferences,
} from '../types/models';

const DECK_SWIPED_INVALIDATION_RATIO = 0.5;

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

export async function getCachedOrGenerateInsight(
  userId: string,
  targetUserId: string,
  matchScore?: number
): Promise<PiMatchInsight | null> {
  try {
    if (!userId) return null;

    const { data: cached } = await supabase
      .from('pi_match_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('target_user_id', targetUserId)
      .single();

    if (cached && !isExpired(cached.expires_at)) {
      return cached as PiMatchInsight;
    }

    const quotaOk = await checkAIQuota(userId, 'match_insight');
    if (!quotaOk) return cached as PiMatchInsight | null;

    const { data, error } = await supabase.functions.invoke('pi-match-insight', {
      body: { user_id: userId, target_user_id: targetUserId, match_score: matchScore },
    });

    if (error || !data) return cached as PiMatchInsight | null;
    logAIUsage(userId, 'match_insight', 0, data.model_used).catch(createErrorHandler('piMatchingService', 'logAIUsage'));
    return data as PiMatchInsight;
  } catch {
    return null;
  }
}

export async function getCachedInsight(
  userId: string,
  targetUserId: string
): Promise<PiMatchInsight | null> {
  try {
    if (!userId) return null;

    const { data } = await supabase
      .from('pi_match_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('target_user_id', targetUserId)
      .single();

    if (data && !isExpired(data.expires_at)) {
      return data as PiMatchInsight;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateDeckReranking(
  userId: string,
  candidateIds: string[]
): Promise<PiDeckRanking | null> {
  try {
    if (!userId) return null;

    const quotaOk = await checkAIQuota(userId, 'deck_rerank');
    if (!quotaOk) return null;

    const { data, error } = await supabase.functions.invoke('pi-rerank-deck', {
      body: { user_id: userId, candidate_ids: candidateIds.slice(0, 30) },
    });

    if (error || !data) return null;
    logAIUsage(userId, 'deck_rerank', 0, data.model_used).catch(createErrorHandler('piMatchingService', 'logAIUsage'));
    return data as PiDeckRanking;
  } catch {
    return null;
  }
}

export async function getCachedDeckRanking(userId: string): Promise<PiDeckRanking | null> {
  try {
    if (!userId) return null;

    const { data } = await supabase
      .from('pi_deck_rankings')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;
    if (isExpired(data.expires_at)) return null;

    const rankedIds = data.ranked_user_ids as string[];
    const swipedRatio = data.swiped_count / Math.max(rankedIds.length, 1);
    if (swipedRatio >= DECK_SWIPED_INVALIDATION_RATIO) return null;

    return data as PiDeckRanking;
  } catch {
    return null;
  }
}

export async function incrementDeckSwipedCount(rankingId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('pi_deck_rankings')
      .select('swiped_count')
      .eq('id', rankingId)
      .single();

    if (data) {
      await supabase
        .from('pi_deck_rankings')
        .update({ swiped_count: (data.swiped_count || 0) + 1 })
        .eq('id', rankingId);
    }
  } catch {
  }
}

export async function parseIdealRoommateText(
  userId: string,
  text: string
): Promise<PiParsedPreferences | null> {
  try {
    if (!userId) return null;
    if (!text || text.trim().length < 20) return null;

    const quotaOk = await checkAIQuota(userId, 'parse_preferences');
    if (!quotaOk) return null;

    const { data, error } = await supabase.functions.invoke('pi-parse-preferences', {
      body: { user_id: userId, text: text.trim().slice(0, 500) },
    });

    if (error || !data) return null;
    logAIUsage(userId, 'parse_preferences').catch(createErrorHandler('piMatchingService', 'logAIUsage'));
    return data as PiParsedPreferences;
  } catch {
    return null;
  }
}

export async function getHostRecommendations(
  userId: string,
  listingId: string
): Promise<PiHostRecommendation | null> {
  try {
    if (!userId) return null;

    const { data: cached } = await supabase
      .from('pi_host_recommendations')
      .select('*')
      .eq('host_id', userId)
      .eq('listing_id', listingId)
      .single();

    if (cached && !isExpired(cached.expires_at)) {
      return cached as PiHostRecommendation;
    }

    const quotaOk = await checkAIQuota(userId, 'host_matchmaker');
    if (!quotaOk) return cached as PiHostRecommendation | null;

    const { data, error } = await supabase.functions.invoke('pi-host-matchmaker', {
      body: { host_id: userId, listing_id: listingId },
    });

    if (error || !data) return cached as PiHostRecommendation | null;
    logAIUsage(userId, 'host_matchmaker', 0, data.model_used).catch(createErrorHandler('piMatchingService', 'logAIUsage'));
    return data as PiHostRecommendation;
  } catch {
    return null;
  }
}

export async function logAIUsage(
  userId: string,
  feature: PiFeature,
  tokensUsed: number = 0,
  modelUsed?: string
): Promise<void> {
  try {
    await supabase.from('pi_usage_log').insert({
      user_id: userId,
      feature,
      tokens_used: tokensUsed,
      model_used: modelUsed,
    });
  } catch {
  }
}

export async function getDailyUsageCount(
  userId: string
): Promise<number> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('pi_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString());

    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getMonthlyUsageCount(
  userId: string,
  feature?: PiFeature
): Promise<number> {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let query = supabase
      .from('pi_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString());

    if (feature) {
      query = query.eq('feature', feature);
    }

    const { count } = await query;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function checkAIQuota(
  userId: string,
  feature: PiFeature
): Promise<boolean> {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('role, host_type')
      .eq('id', userId)
      .single();

    if (!userData) return false;

    const isHost = userData.role === 'host';

    if (isHost) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .single();

      const rawPlan = sub?.plan || 'free';
      const normalizedPlan = normalizeHostPlan(rawPlan, userData.host_type);
      const monthlyLimit = getHostPiMonthlyLimit(normalizedPlan, userData.host_type);
      if (monthlyLimit === -1) return true;

      const used = await getMonthlyUsageCount(userId);
      return used < monthlyLimit;
    } else {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .single();

      const plan = sub?.plan || 'free';
      const dailyLimit = getRenterPiDailyLimit(plan);
      if (dailyLimit === -1) return true;

      const used = await getDailyUsageCount(userId);
      return used < dailyLimit;
    }
  } catch {
    return false;
  }
}

function normalizeHostPlan(rawPlan: string, hostType?: string): string {
  if (hostType === 'agent') {
    const prefixed: Record<string, string> = {
      agent_starter: 'starter',
      agent_pro: 'pro',
      agent_business: 'business',
      pay_per_use: 'pay_per_use',
    };
    return prefixed[rawPlan] ?? rawPlan;
  }
  if (hostType === 'company') {
    const prefixed: Record<string, string> = {
      company_starter: 'starter',
      company_pro: 'pro',
      company_business: 'business',
      company_enterprise: 'enterprise',
    };
    return prefixed[rawPlan] ?? rawPlan;
  }
  return rawPlan;
}

export function getRenterPiDailyLimit(plan: string): number {
  const normalized = (plan === 'basic' ? 'free' : plan) as RenterPlan;
  return RENTER_PLAN_LIMITS[normalized]?.piMessagesPerDay ?? RENTER_PLAN_LIMITS.free.piMessagesPerDay;
}

export function getHostPiMonthlyLimit(plan: string, hostType?: string): number {
  if (hostType === 'agent') {
    return AGENT_PLAN_LIMITS[plan]?.piCallsPerMonth ?? AGENT_PLAN_LIMITS.pay_per_use.piCallsPerMonth;
  }

  if (hostType === 'company') {
    return getCompanyPiMonthlyLimit(plan);
  }

  const hostPlan = plan as HostPlan;
  return PLAN_LIMITS[hostPlan]?.piCallsPerMonth ?? PLAN_LIMITS.free.piCallsPerMonth;
}

export async function invalidateInsightsForUser(userId: string): Promise<void> {
  try {
    await supabase
      .from('pi_match_insights')
      .delete()
      .eq('user_id', userId);

    await supabase
      .from('pi_match_insights')
      .delete()
      .eq('target_user_id', userId);
  } catch {
  }
}

export async function invalidateDeckRankingForUser(userId: string): Promise<void> {
  try {
    await supabase
      .from('pi_deck_rankings')
      .delete()
      .eq('user_id', userId);
  } catch {
  }
}

export async function invalidateHostRecsForListing(listingId: string): Promise<void> {
  try {
    await supabase
      .from('pi_host_recommendations')
      .delete()
      .eq('listing_id', listingId);
  } catch {
  }
}

export async function invalidateAllCachesForUser(userId: string): Promise<void> {
  await Promise.all([
    invalidateInsightsForUser(userId),
    invalidateDeckRankingForUser(userId),
  ]);
}

export const getMonthlyAIUsage = getMonthlyUsageCount;

export {
  getUserAutoGroups,
  getAutoGroupMembers,
  respondToAutoGroupInvite,
  getGroupClaims,
  getClaimsUsedThisMonth as getHostClaimsThisMonth,
  getClaimAllowance as canHostClaimGroup,
  getPendingAutoGroupCount,
  canJoinAutoGroup,
} from './piAutoMatchService';
import { createErrorHandler } from '../utils/errorLogger';
