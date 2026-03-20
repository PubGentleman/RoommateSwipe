export type HostPlan = 'free' | 'none' | 'starter' | 'pro' | 'business';

export interface PlanLimits {
  plan: HostPlan;
  label: string;
  price: string;
  maxListings: number;
  proactiveOutreachPerDay: number;
  proactiveOutreachPerHour: number;
  groupCooldownDays: number;
  canPayToUnlock: boolean;
  groupProfileAccess: 'preview' | 'full';
  listingPlacement: 'standard' | 'priority' | 'top' | 'featured';
  hasAnalytics: boolean;
  analyticsLevel: 'none' | 'basic' | 'advanced';
  hasCompanyBranding: boolean;
  hasDedicatedSupport: boolean;
}

export const PLAN_LIMITS: Record<HostPlan, PlanLimits> = {
  free: {
    plan: 'free',
    label: 'Free',
    price: '$0',
    maxListings: 1,
    proactiveOutreachPerDay: 0,
    proactiveOutreachPerHour: 0,
    groupCooldownDays: 0,
    canPayToUnlock: false,
    groupProfileAccess: 'preview',
    listingPlacement: 'standard',
    hasAnalytics: false,
    analyticsLevel: 'none',
    hasCompanyBranding: false,
    hasDedicatedSupport: false,
  },
  none: {
    plan: 'none',
    label: 'Free',
    price: '$0',
    maxListings: 1,
    proactiveOutreachPerDay: 0,
    proactiveOutreachPerHour: 0,
    groupCooldownDays: 0,
    canPayToUnlock: false,
    groupProfileAccess: 'preview',
    listingPlacement: 'standard',
    hasAnalytics: false,
    analyticsLevel: 'none',
    hasCompanyBranding: false,
    hasDedicatedSupport: false,
  },
  starter: {
    plan: 'starter',
    label: 'Host Starter',
    price: '$19.99/mo',
    maxListings: 5,
    proactiveOutreachPerDay: 3,
    proactiveOutreachPerHour: 2,
    groupCooldownDays: 30,
    canPayToUnlock: true,
    groupProfileAccess: 'full',
    listingPlacement: 'priority',
    hasAnalytics: false,
    analyticsLevel: 'none',
    hasCompanyBranding: false,
    hasDedicatedSupport: false,
  },
  pro: {
    plan: 'pro',
    label: 'Host Pro',
    price: '$49.99/mo',
    maxListings: -1,
    proactiveOutreachPerDay: 5,
    proactiveOutreachPerHour: 2,
    groupCooldownDays: 30,
    canPayToUnlock: true,
    groupProfileAccess: 'full',
    listingPlacement: 'top',
    hasAnalytics: true,
    analyticsLevel: 'basic',
    hasCompanyBranding: false,
    hasDedicatedSupport: false,
  },
  business: {
    plan: 'business',
    label: 'Host Business',
    price: '$99.99/mo',
    maxListings: -1,
    proactiveOutreachPerDay: 10,
    proactiveOutreachPerHour: 3,
    groupCooldownDays: 30,
    canPayToUnlock: true,
    groupProfileAccess: 'full',
    listingPlacement: 'featured',
    hasAnalytics: true,
    analyticsLevel: 'advanced',
    hasCompanyBranding: true,
    hasDedicatedSupport: true,
  },
};

export function getPlanLimits(plan: HostPlan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function canAddListing(plan: HostPlan, currentListingCount: number): boolean {
  const limits = getPlanLimits(plan);
  if (limits.maxListings === -1) return true;
  return currentListingCount < limits.maxListings;
}

export function canUseProactiveOutreach(plan: HostPlan): boolean {
  return getPlanLimits(plan).proactiveOutreachPerDay > 0;
}

export const UNLOCK_PACKAGES = [
  { id: 'small', label: '+3 messages today',  credits: 3,  priceCents: 499  },
  { id: 'large', label: '+10 messages today', credits: 10, priceCents: 1299 },
];
