import { HostPlanType, HostSubscriptionData, ListingBoost, Property } from '../types/models';

export const HOST_PLANS: Record<HostPlanType, {
  label: string;
  price: number;
  listingsIncluded: number;
  overagePerListing: number;
  freeBoosts: number;
  freeBoostDuration: '6h' | '12h' | '24h' | '72h' | '7d' | null;
  simultaneousBoosts: number;
  features: { included: string[]; locked: string[] };
}> = {
  free: {
    label: 'Host Free',
    price: 0,
    listingsIncluded: 1,
    overagePerListing: 0,
    freeBoosts: 0,
    freeBoostDuration: null,
    simultaneousBoosts: 0,
    features: {
      included: [
        '1 active listing',
        'Basic inquiry management',
        'Standard placement in search',
      ],
      locked: [
        'Renter group browsing',
        'AI assistant',
        'Listing boosts',
        'Compatibility scores',
        'Verified host badge',
      ],
    },
  },
  none: {
    label: 'Host Free',
    price: 0,
    listingsIncluded: 1,
    overagePerListing: 0,
    freeBoosts: 0,
    freeBoostDuration: null,
    simultaneousBoosts: 0,
    features: {
      included: [
        '1 active listing',
        'Basic inquiry management',
        'Standard placement in search',
      ],
      locked: [
        'Renter group browsing',
        'AI assistant',
        'Listing boosts',
        'Compatibility scores',
        'Verified host badge',
      ],
    },
  },
  starter: {
    label: 'Host Starter',
    price: 19.99,
    listingsIncluded: 5,
    overagePerListing: 0,
    freeBoosts: 1,
    freeBoostDuration: '12h',
    simultaneousBoosts: 1,
    features: {
      included: [
        'Up to 5 active listings',
        'Proactive outreach to 3 groups/day',
        'Full renter group profiles',
        'Priority listing placement',
        '1 free 12-hr boost per month',
        'Verified host badge',
        'Inquiry management',
      ],
      locked: [
        'Analytics dashboard',
        'Company/Agent branding',
      ],
    },
  },
  pro: {
    label: 'Host Pro',
    price: 49.99,
    listingsIncluded: Infinity,
    overagePerListing: 0,
    freeBoosts: 1,
    freeBoostDuration: '12h',
    simultaneousBoosts: 3,
    features: {
      included: [
        'Unlimited property listings',
        'Proactive outreach to 5 groups/day',
        'Top listing placement',
        'Basic analytics dashboard',
        '1 free 12-hr boost per month',
        'Up to 3 simultaneous boosts',
        'Full renter group profiles',
      ],
      locked: [
        'Company/Agent branding',
        'Dedicated support',
      ],
    },
  },
  business: {
    label: 'Host Business',
    price: 99.99,
    listingsIncluded: Infinity,
    overagePerListing: 0,
    freeBoosts: 2,
    freeBoostDuration: '24h',
    simultaneousBoosts: 10,
    features: {
      included: [
        'Unlimited property listings',
        'Proactive outreach to 10 groups/day',
        'Featured listing badge',
        'Advanced analytics dashboard',
        '2 free 24-hr boosts per month',
        'Up to 10 simultaneous boosts',
        'Company/Agent profile branding',
        'Dedicated support',
      ],
      locked: [],
    },
  },
  agent_starter: {
    label: 'Agent Starter',
    price: 49,
    listingsIncluded: 10,
    overagePerListing: 0,
    freeBoosts: 0,
    freeBoostDuration: null,
    simultaneousBoosts: 0,
    features: {
      included: ['Up to 10 active listings', 'Client management', 'AI renter matching', 'Agent badge'],
      locked: ['Priority placement', 'Advanced analytics'],
    },
  },
  agent_pro: {
    label: 'Agent Pro',
    price: 99,
    listingsIncluded: Infinity,
    overagePerListing: 0,
    freeBoosts: 0,
    freeBoostDuration: null,
    simultaneousBoosts: 0,
    features: {
      included: ['Unlimited listings', 'Priority placement', 'Advanced analytics', 'Priority support'],
      locked: [],
    },
  },
  agent_business: {
    label: 'Agent Business',
    price: 149,
    listingsIncluded: Infinity,
    overagePerListing: 0,
    freeBoosts: 0,
    freeBoostDuration: null,
    simultaneousBoosts: 0,
    features: {
      included: ['Unlimited listings', 'Full CRM', 'Max visibility', 'Dedicated account manager'],
      locked: [],
    },
  },
} as Record<string, {
  label: string;
  price: number;
  listingsIncluded: number;
  overagePerListing: number;
  freeBoosts: number;
  freeBoostDuration: '6h' | '12h' | '24h' | '72h' | '7d' | null;
  simultaneousBoosts: number;
  features: { included: string[]; locked: string[] };
}>;

export const BOOST_OPTIONS = [
  {
    id: 'quick' as const,
    duration: '6h' as const,
    label: 'Quick Boost',
    price: 2.99,
    description: 'Jump to the top of search in your city for 6 hours',
    includesFeaturedBadge: false,
    badgeLabel: null as string | null,
    highlight: false,
    popularBadge: null as string | null,
  },
  {
    id: 'standard' as const,
    duration: '12h' as const,
    label: 'Standard Boost',
    price: 4.99,
    description: 'Top placement + Featured badge on your listing for 12 hours',
    includesFeaturedBadge: true,
    badgeLabel: 'Featured' as string | null,
    highlight: true,
    popularBadge: 'Most Popular' as string | null,
  },
  {
    id: 'extended' as const,
    duration: '24h' as const,
    label: 'Extended Boost',
    price: 7.99,
    description: 'Top placement + Featured badge sustained for a full day',
    includesFeaturedBadge: true,
    badgeLabel: 'Featured' as string | null,
    highlight: false,
    popularBadge: 'Best Value' as string | null,
  },
];

export const AGENT_VERIFICATION_FEE = 9.99;

export function isFreePlan(plan: HostPlanType | string): boolean {
  return plan === 'free' || plan === 'none';
}

export function calculateHostMonthlyCost(plan: HostPlanType, activeListings: number): number {
  if (isFreePlan(plan)) return 0;
  const p = HOST_PLANS[plan];
  const base = p.price;
  const overage = Math.max(0, activeListings - p.listingsIncluded) * p.overagePerListing;
  return base + overage;
}

export function canAddListingCheck(subscription: HostSubscriptionData): { allowed: boolean; message: string; upgradeRequired?: boolean } {
  const plan = HOST_PLANS[subscription.plan];
  if (subscription.plan === 'pro' || subscription.plan === 'business'
      || subscription.plan === 'agent_pro' || subscription.plan === 'agent_business') {
    return { allowed: true, message: '' };
  }
  if (subscription.activeListingCount >= plan.listingsIncluded) {
    const upgradeTo = isFreePlan(subscription.plan) ? 'Host Starter' : 'Host Pro';
    return {
      allowed: false,
      message: `Your ${plan.label} plan allows up to ${plan.listingsIncluded} active listing${plan.listingsIncluded > 1 ? 's' : ''}. Upgrade to ${upgradeTo} to add more listings.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true, message: '' };
}

export function calculateBoostExpiry(duration: '6h' | '12h' | '24h' | '72h' | '7d'): string {
  const hoursMap: Record<string, number> = {
    '6h': 6,
    '12h': 12,
    '24h': 24,
    '72h': 72,
    '7d': 168,
  };
  const hours = hoursMap[duration] ?? 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function isListingBoosted(listing: Property): boolean {
  if (!listing.listingBoost?.isActive) return false;
  return new Date(listing.listingBoost.expiresAt) > new Date();
}

export function createBoostRecord(
  listingId: string,
  option: typeof BOOST_OPTIONS[0],
  usedFreeBoost: boolean
): ListingBoost {
  return {
    listingId,
    duration: option.duration,
    price: usedFreeBoost ? 0 : option.price,
    startedAt: new Date().toISOString(),
    expiresAt: calculateBoostExpiry(option.duration),
    isActive: true,
    usedFreeboost: usedFreeBoost,
    includesFeaturedBadge: option.includesFeaturedBadge,
    badgeLabel: option.badgeLabel,
  };
}

export function getDefaultHostSubscription(): HostSubscriptionData {
  return {
    plan: 'free',
    listingsIncluded: HOST_PLANS.free.listingsIncluded,
    activeListingCount: 0,
    overagePerListing: 0,
    monthlyPrice: 0,
    freeBoostsRemaining: HOST_PLANS.free.freeBoosts,
    freeBoostDuration: HOST_PLANS.free.freeBoostDuration,
    isVerifiedAgent: false,
    agentVerificationPaid: false,
  };
}

export function subscriptionFromPlan(plan: HostPlanType, existing?: Partial<HostSubscriptionData>): HostSubscriptionData {
  const planData = HOST_PLANS[plan];
  return {
    plan,
    listingsIncluded: planData.listingsIncluded,
    activeListingCount: existing?.activeListingCount || 0,
    overagePerListing: planData.overagePerListing,
    monthlyPrice: planData.price,
    freeBoostsRemaining: planData.freeBoosts,
    freeBoostDuration: (planData.freeBoostDuration || null) as '6h' | '12h' | '24h' | '72h' | '7d' | null,
    isVerifiedAgent: existing?.isVerifiedAgent || false,
    agentVerificationPaid: existing?.agentVerificationPaid || false,
    renewalDate: isFreePlan(plan) ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function getBoostTimeRemaining(boost: ListingBoost): string {
  const now = Date.now();
  const expires = new Date(boost.expiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
