import { getPlanLimits, type HostPlan } from '../constants/planLimits';

export function canViewFullGroupProfile(plan: HostPlan): boolean {
  return getPlanLimits(plan).groupProfileAccess === 'full';
}

export function canAccessAnalytics(plan: HostPlan): boolean {
  return getPlanLimits(plan).hasAnalytics;
}

export function canUseCompanyBranding(plan: HostPlan): boolean {
  return getPlanLimits(plan).hasCompanyBranding;
}

export function canAccessDedicatedSupport(plan: HostPlan): boolean {
  return getPlanLimits(plan).hasDedicatedSupport;
}

export function canUseBoosts(plan: HostPlan): boolean {
  return getPlanLimits(plan).hasBoosts;
}

export function hasVerifiedBadge(plan: HostPlan): boolean {
  return getPlanLimits(plan).hasVerifiedBadge;
}

export function isHostFreePlan(plan: HostPlan): boolean {
  return plan === 'free' || plan === 'none';
}

export function getNextUpgradePlan(plan: HostPlan): HostPlan {
  if (plan === 'free' || plan === 'none') return 'starter';
  if (plan === 'starter') return 'pro';
  return 'business';
}

export function getNextUpgradePlanLabel(plan: HostPlan): string {
  const next = getNextUpgradePlan(plan);
  return getPlanLimits(next).label;
}

export function getListingLimitMessage(plan: HostPlan): string {
  const limits = getPlanLimits(plan);
  const nextLabel = getNextUpgradePlanLabel(plan);
  return `Your ${limits.label} plan allows up to ${limits.maxListings} active listing${limits.maxListings > 1 ? 's' : ''}. Upgrade to ${nextLabel} to add more listings.`;
}
