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

export function getNextUpgradePlan(plan: HostPlan): HostPlan {
  if (plan === 'free' || plan === 'none') return 'starter';
  if (plan === 'starter') return 'pro';
  return 'business';
}
