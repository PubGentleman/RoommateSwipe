import { getPlanLimits, type HostPlan } from '../constants/planLimits';
import { getAgentLimits, isAgentPlan } from './agentPlanGates';
import { BETA_MODE } from '../constants/betaConfig';

type ExtendedPlan = HostPlan | 'agent_starter' | 'agent_pro' | 'agent_business'
  | 'company_starter' | 'company_pro' | 'company_enterprise' | 'pay_per_use';

function resolveHostPlan(plan: string): HostPlan {
  if (plan.startsWith('agent_') || plan.startsWith('company_') || plan === 'pay_per_use') {
    const base = plan.replace(/^(agent_|company_)/, '');
    const mapped: Record<string, HostPlan> = { starter: 'starter', pro: 'pro', business: 'business', enterprise: 'business', pay_per_use: 'free' };
    return mapped[base] || 'free';
  }
  return plan as HostPlan;
}

export function canViewFullGroupProfile(plan: string): boolean {
  if (isAgentPlan(plan)) return getAgentLimits(plan).hasAdvancedAI;
  return getPlanLimits(resolveHostPlan(plan)).groupProfileAccess === 'full';
}

export function canAccessAnalytics(plan: string): boolean {
  if (isAgentPlan(plan)) return getAgentLimits(plan).hasAdvancedAnalytics;
  if (['company_pro', 'company_enterprise'].includes(plan)) return true;
  if (plan === 'company_starter') return true;
  return getPlanLimits(resolveHostPlan(plan)).hasAnalytics;
}

export function canUseCompanyBranding(plan: string): boolean {
  if (plan.startsWith('company_')) return plan !== 'company_free';
  return getPlanLimits(resolveHostPlan(plan)).hasCompanyBranding;
}

export function canAccessDedicatedSupport(plan: string): boolean {
  if (isAgentPlan(plan)) return getAgentLimits(plan).hasDedicatedSupport;
  if (['company_pro', 'company_enterprise'].includes(plan)) return true;
  return getPlanLimits(resolveHostPlan(plan)).hasDedicatedSupport;
}

export function canUseBoosts(plan: string): boolean {
  if (isAgentPlan(plan)) return getAgentLimits(plan).hasBoosts;
  if (plan.startsWith('company_')) return getPlanLimits(plan as any).hasBoosts;
  return getPlanLimits(resolveHostPlan(plan)).hasBoosts;
}

export function hasVerifiedBadge(plan: string): boolean {
  if (isAgentPlan(plan)) return getAgentLimits(plan).hasVerifiedBadge;
  if (plan.startsWith('company_') && plan !== 'free') return true;
  return getPlanLimits(resolveHostPlan(plan)).hasVerifiedBadge;
}

export function isHostFreePlan(plan: string): boolean {
  if (BETA_MODE) return false;
  return plan === 'free' || plan === 'none' || plan === 'pay_per_use';
}

export function getNextUpgradePlan(plan: string): string {
  if (isAgentPlan(plan)) {
    if (plan === 'pay_per_use' || plan === 'free') return 'agent_starter';
    if (plan === 'agent_starter') return 'agent_pro';
    return 'agent_business';
  }
  if (plan.startsWith('company_')) {
    if (plan === 'company_starter') return 'company_pro';
    return 'company_enterprise';
  }
  if (plan === 'free' || plan === 'none') return 'starter';
  if (plan === 'starter') return 'pro';
  return 'business';
}

export function getNextUpgradePlanLabel(plan: string): string {
  const next = getNextUpgradePlan(plan);
  if (isAgentPlan(next)) return getAgentLimits(next).label;
  return getPlanLimits(resolveHostPlan(next)).label;
}

export function getListingLimitMessage(plan: string): string {
  if (isAgentPlan(plan)) {
    const limits = getAgentLimits(plan);
    const nextLabel = getNextUpgradePlanLabel(plan);
    const max = limits.listingLimit === -1 ? 'unlimited' : `${limits.listingLimit}`;
    return `Your ${limits.label} plan allows up to ${max} active listings. Upgrade to ${nextLabel} to add more listings.`;
  }
  const limits = getPlanLimits(resolveHostPlan(plan));
  const nextLabel = getNextUpgradePlanLabel(plan);
  return `Your ${limits.label} plan allows up to ${limits.maxListings} active listing${limits.maxListings > 1 ? 's' : ''}. Upgrade to ${nextLabel} to add more listings.`;
}
