import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PlanLimits {
  maxListings: number;
  outreachPerDay: number;
  piMatchesPerMonth: number;
  simultaneousBoosts: number;
  canAccessAnalytics: boolean;
  canAccessAIMatching: boolean;
  teamSeats: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  'free':                { maxListings: 1,  outreachPerDay: 0,  piMatchesPerMonth: 0,   simultaneousBoosts: 0, canAccessAnalytics: false, canAccessAIMatching: false, teamSeats: 0 },
  'none':                { maxListings: 1,  outreachPerDay: 0,  piMatchesPerMonth: 0,   simultaneousBoosts: 0, canAccessAnalytics: false, canAccessAIMatching: false, teamSeats: 0 },
  'starter':             { maxListings: 5,  outreachPerDay: 3,  piMatchesPerMonth: 10,  simultaneousBoosts: 1, canAccessAnalytics: false, canAccessAIMatching: false, teamSeats: 0 },
  'pro':                 { maxListings: -1, outreachPerDay: 5,  piMatchesPerMonth: 30,  simultaneousBoosts: 2, canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: 0 },
  'business':            { maxListings: -1, outreachPerDay: 10, piMatchesPerMonth: 50,  simultaneousBoosts: 3, canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: 0 },
  'pay_per_use':         { maxListings: 3,  outreachPerDay: 2,  piMatchesPerMonth: 5,   simultaneousBoosts: 0, canAccessAnalytics: false, canAccessAIMatching: false, teamSeats: 0 },
  'agent_starter':       { maxListings: 10, outreachPerDay: 5,  piMatchesPerMonth: 15,  simultaneousBoosts: 1, canAccessAnalytics: false, canAccessAIMatching: true,  teamSeats: 0 },
  'agent_pro':           { maxListings: 30, outreachPerDay: 10, piMatchesPerMonth: 100, simultaneousBoosts: 5, canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: 0 },
  'agent_business':      { maxListings: -1, outreachPerDay: -1, piMatchesPerMonth: 200, simultaneousBoosts: 10,canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: 0 },
  'company_starter':     { maxListings: -1, outreachPerDay: 10, piMatchesPerMonth: 50,  simultaneousBoosts: 3, canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: 5 },
  'company_pro':         { maxListings: -1, outreachPerDay: -1, piMatchesPerMonth: -1,  simultaneousBoosts: 10,canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: 15 },
  'company_enterprise':  { maxListings: -1, outreachPerDay: -1, piMatchesPerMonth: -1,  simultaneousBoosts: -1,canAccessAnalytics: true,  canAccessAIMatching: true,  teamSeats: -1 },
};

export async function getEffectivePlan(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: user } = await supabase
    .from('users')
    .select('host_type, host_plan, agent_plan')
    .eq('id', userId)
    .single();

  if (!user) return 'free';

  if (user.host_type === 'agent') {
    return user.agent_plan || 'pay_per_use';
  }
  return user.host_plan || 'free';
}

export async function verifyActiveSub(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .limit(1)
    .maybeSingle();

  return !!sub;
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS['free'];
}

export async function enforceListingLimit(supabase: SupabaseClient, userId: string): Promise<{ allowed: boolean; message?: string }> {
  const plan = await getEffectivePlan(supabase, userId);
  const limits = getPlanLimits(plan);

  if (limits.maxListings === -1) return { allowed: true };

  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('host_id', userId)
    .eq('is_active', true);

  if ((count ?? 0) >= limits.maxListings) {
    return { allowed: false, message: `Your ${plan} plan allows ${limits.maxListings} active listing(s). Upgrade to add more.` };
  }
  return { allowed: true };
}
