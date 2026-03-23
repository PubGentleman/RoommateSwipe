import { supabase } from '../lib/supabase';

export type RenterPlan = 'basic' | 'plus' | 'elite';
export type HostPlan = 'starter' | 'pro' | 'business';
export type BillingCycle = 'monthly' | '3month' | 'annual';

export async function getSubscription() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

export async function updateSubscription(plan: string, billingCycle: BillingCycle) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const periodEnd = calculatePeriodEnd(billingCycle);

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      plan,
      billing_cycle: billingCycle,
      status: 'active',
      current_period_end: periodEnd,
      cancel_at_period_end: false,
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  const agentPlans = ['pay_per_use', 'starter', 'pro', 'business'];
  if (agentPlans.includes(plan)) {
    await supabase
      .from('users')
      .update({ agent_plan: plan })
      .eq('id', user.id);
  }

  return data;
}

export async function cancelSubscription() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelling',
      cancel_at_period_end: true,
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function reactivateSubscription() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      cancel_at_period_end: false,
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function calculatePeriodEnd(cycle: BillingCycle): string {
  const now = new Date();
  switch (cycle) {
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    case '3month':
      now.setMonth(now.getMonth() + 3);
      break;
    case 'annual':
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  return now.toISOString();
}

export const PLAN_LIMITS = {
  basic: {
    interestCardsPerDay: 5,
    messagesPerMonth: 50,
    superInterestsPerMonth: 0,
    coldMessagesPerMonth: 0,
    rewindsPerDay: 0,
    canSeeWhoLikedYou: false,
    canUseAdvancedFilters: false,
    boostDurationHours: 12,
    freeBoostsPerWeek: 0,
  },
  plus: {
    interestCardsPerDay: 15,
    messagesPerMonth: Infinity,
    superInterestsPerMonth: 5,
    coldMessagesPerMonth: 0,
    rewindsPerDay: 3,
    canSeeWhoLikedYou: true,
    canUseAdvancedFilters: false,
    boostDurationHours: 24,
    freeBoostsPerWeek: 1,
  },
  elite: {
    interestCardsPerDay: Infinity,
    messagesPerMonth: Infinity,
    superInterestsPerMonth: Infinity,
    coldMessagesPerMonth: 3,
    rewindsPerDay: Infinity,
    canSeeWhoLikedYou: true,
    canUseAdvancedFilters: true,
    boostDurationHours: 48,
    freeBoostsPerWeek: Infinity,
  },
  starter: {
    activeListings: 1,
    inquiryResponsesPerMonth: 5,
  },
  pro: {
    activeListings: 5,
    inquiryResponsesPerMonth: Infinity,
  },
  business: {
    activeListings: Infinity,
    inquiryResponsesPerMonth: Infinity,
  },
} as const;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.basic;
}
