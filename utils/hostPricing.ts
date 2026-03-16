import { HostPlanType, HostSubscriptionData, ListingBoost, Property } from '../types/models';

export const HOST_PLANS: Record<HostPlanType, {
  label: string;
  price: number;
  listingsIncluded: number;
  overagePerListing: number;
  freeBoosts: number;
  freeBoostDuration: '24h' | '72h' | '7d' | null;
  features: string[];
}> = {
  none: {
    label: 'Free',
    price: 0,
    listingsIncluded: 0,
    overagePerListing: 0,
    freeBoosts: 0,
    freeBoostDuration: null,
    features: [],
  },
  starter: {
    label: 'Host Starter',
    price: 19.99,
    listingsIncluded: 1,
    overagePerListing: 0,
    freeBoosts: 1,
    freeBoostDuration: '24h',
    features: [
      '1 active listing',
      'Renter group browsing',
      'AI assistant (host modes)',
      '1 free 24-hour boost/month',
      'Verified host badge',
    ],
  },
  pro: {
    label: 'Host Pro',
    price: 49.99,
    listingsIncluded: 5,
    overagePerListing: 0,
    freeBoosts: 2,
    freeBoostDuration: '72h',
    features: [
      'Up to 5 active listings',
      'Priority placement in search',
      'Renter group browsing',
      'AI assistant (host modes)',
      '2 free 72-hour boosts/month',
      'Advanced analytics',
      'Verified host badge',
    ],
  },
  business: {
    label: 'Host Business',
    price: 99,
    listingsIncluded: 15,
    overagePerListing: 5,
    freeBoosts: 2,
    freeBoostDuration: '7d',
    features: [
      'Up to 15 active listings (+$5/listing after)',
      'Priority placement in search',
      'Renter group browsing',
      'Verified agent badge (requires license)',
      'Bulk messaging tools',
      'Full analytics suite',
      '2 free 7-day boosts/month',
    ],
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

export function calculateHostMonthlyCost(plan: HostPlanType, activeListings: number): number {
  const p = HOST_PLANS[plan];
  const base = p.price;
  const overage = Math.max(0, activeListings - p.listingsIncluded) * p.overagePerListing;
  return base + overage;
}

export function canAddListingCheck(subscription: HostSubscriptionData): { allowed: boolean; message: string } {
  const plan = HOST_PLANS[subscription.plan];
  if (subscription.plan === 'none') {
    return { allowed: false, message: 'You need a host subscription to post listings.' };
  }
  if (subscription.plan === 'business') {
    if (subscription.activeListingCount >= subscription.listingsIncluded) {
      const overageCost = (subscription.activeListingCount - subscription.listingsIncluded + 1) * plan.overagePerListing;
      return { allowed: true, message: `This listing will add $${overageCost}/mo to your plan.` };
    }
    return { allowed: true, message: '' };
  }
  if (subscription.activeListingCount >= plan.listingsIncluded) {
    return {
      allowed: false,
      message: `Your ${plan.label} plan allows up to ${plan.listingsIncluded} active listing${plan.listingsIncluded > 1 ? 's' : ''}. Upgrade to add more.`,
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
    plan: 'none',
    listingsIncluded: 0,
    activeListingCount: 0,
    overagePerListing: 0,
    monthlyPrice: 0,
    freeBoostsRemaining: 0,
    freeBoostDuration: '24h',
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
    freeBoostDuration: (planData.freeBoostDuration || '24h') as '24h' | '72h' | '7d',
    isVerifiedAgent: existing?.isVerifiedAgent || false,
    agentVerificationPaid: existing?.agentVerificationPaid || false,
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
