import { HostPlanType, HostSubscriptionData, ListingBoost, Property } from '../types/models';

export const HOST_PLANS: Record<HostPlanType, {
  label: string;
  price: number;
  listingsIncluded: number;
  overagePerListing: number;
  freeBoosts: number;
  freeBoostDuration: '24h' | '72h' | '7d' | null;
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
    listingsIncluded: 1,
    overagePerListing: 0,
    freeBoosts: 1,
    freeBoostDuration: '24h',
    simultaneousBoosts: 1,
    features: {
      included: [
        '1 active listing',
        'Renter group browsing',
        'AI assistant (host modes)',
        '1 free 24-hr boost per month',
        'Verified host badge',
        'Inquiry management',
        'Compatibility scores',
      ],
      locked: [],
    },
  },
  pro: {
    label: 'Host Pro',
    price: 49.99,
    listingsIncluded: 5,
    overagePerListing: 0,
    freeBoosts: 2,
    freeBoostDuration: '72h',
    simultaneousBoosts: 3,
    features: {
      included: [
        'Up to 5 active listings',
        'Priority placement in search',
        'Renter group browsing',
        'AI assistant (host modes)',
        '2 free 72-hr boosts per month',
        'Up to 3 simultaneous boosts',
        'Advanced analytics',
        'Response rate tracking',
      ],
      locked: [],
    },
  },
  business: {
    label: 'Host Business',
    price: 99,
    listingsIncluded: 15,
    overagePerListing: 5,
    freeBoosts: 2,
    freeBoostDuration: '7d',
    simultaneousBoosts: 10,
    features: {
      included: [
        'Up to 15 active listings',
        '+$5/mo per listing after 15',
        '2 free 7-day boosts per month',
        'Up to 10 simultaneous boosts',
        'Bulk boost across listings',
        'Full analytics suite',
        'Bulk messaging tools',
        'Agent verification badge (add-on)',
        'Priority support',
      ],
      locked: [],
    },
  },
};

export const BOOST_OPTIONS: Array<{
  duration: '24h' | '72h' | '7d';
  label: string;
  price: number;
  description: string;
}> = [
  { duration: '24h', label: '24-Hour Boost', price: 4.99, description: 'Jump to top of search for 1 day' },
  { duration: '72h', label: '72-Hour Boost', price: 9.99, description: 'Featured badge for 3 days — best value' },
  { duration: '7d', label: '7-Day Boost', price: 19.99, description: 'Sustained visibility for a full week' },
];

export const AGENT_VERIFICATION_FEE = 9.99;

export function isFreePlan(plan: HostPlanType): boolean {
  return plan === 'free' || plan === 'none';
}

export function calculateHostMonthlyCost(plan: HostPlanType, activeListings: number): number {
  if (isFreePlan(plan)) return 0;
  const p = HOST_PLANS[plan];
  const base = p.price;
  const overage = Math.max(0, activeListings - p.listingsIncluded) * p.overagePerListing;
  return base + overage;
}

export function canAddListingCheck(subscription: HostSubscriptionData): { allowed: boolean; message: string } {
  const plan = HOST_PLANS[subscription.plan];
  if (subscription.plan === 'business') {
    if (subscription.activeListingCount >= subscription.listingsIncluded) {
      const overageCost = (subscription.activeListingCount - subscription.listingsIncluded + 1) * plan.overagePerListing;
      return { allowed: true, message: `This listing will add $${overageCost}/mo to your plan.` };
    }
    return { allowed: true, message: '' };
  }
  if (subscription.activeListingCount >= plan.listingsIncluded) {
    const upgradeTo = isFreePlan(subscription.plan) ? 'Starter' : subscription.plan === 'starter' ? 'Pro' : 'Business';
    return {
      allowed: false,
      message: `Your ${plan.label} plan allows up to ${plan.listingsIncluded} active listing${plan.listingsIncluded > 1 ? 's' : ''}. Upgrade to ${upgradeTo} to add more.`,
    };
  }
  return { allowed: true, message: '' };
}

export function calculateBoostExpiry(duration: '24h' | '72h' | '7d'): string {
  const hours = duration === '24h' ? 24 : duration === '72h' ? 72 : 168;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function isListingBoosted(listing: Property): boolean {
  if (!listing.listingBoost?.isActive) return false;
  return new Date(listing.listingBoost.expiresAt) > new Date();
}

export function getDefaultHostSubscription(): HostSubscriptionData {
  return {
    plan: 'free',
    listingsIncluded: 1,
    activeListingCount: 0,
    overagePerListing: 0,
    monthlyPrice: 0,
    freeBoostsRemaining: 0,
    freeBoostDuration: null,
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
    freeBoostDuration: (planData.freeBoostDuration || null) as '24h' | '72h' | '7d' | null,
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
