export type RenterTier = 'free' | 'plus' | 'elite';
export type HostTier = 'none' | 'starter' | 'pro' | 'business' | 'agent_starter' | 'agent_pro' | 'agent_business' | 'company_starter' | 'company_pro' | 'company_enterprise';

export interface UserEntitlements {
  hostTier: HostTier;
  renterTier: RenterTier;
  hasActiveSubscription: boolean;
  subscriptionSource: 'renter' | 'host' | 'none';
}

export const HOST_TO_RENTER_BUNDLE: Record<string, RenterTier> = {
  starter: 'plus',
  pro: 'elite',
  business: 'elite',
  agent_starter: 'free',
  agent_pro: 'free',
  agent_business: 'free',
  company_starter: 'free',
  company_pro: 'free',
  company_enterprise: 'free',
  none: 'free',
};

export const BUNDLE_LABELS: Record<string, string> = {
  starter: 'Includes Renter Plus access',
  pro: 'Includes Renter Elite access',
  business: 'Includes Renter Elite access',
};

export function deriveRenterTierFromHost(hostTier: string): RenterTier {
  return HOST_TO_RENTER_BUNDLE[hostTier] || 'free';
}

export function resolveEntitlements(
  hostPlan: string | undefined,
  renterPlan: string | undefined,
  hostType?: string,
): UserEntitlements {
  const hostTier = (hostPlan && hostPlan !== 'free' && hostPlan !== 'none' ? hostPlan : 'none') as HostTier;
  const bundledRenter = deriveRenterTierFromHost(hostTier);

  if (hostTier !== 'none') {
    const directRenter = renterPlan === 'elite' ? 'elite' : renterPlan === 'plus' ? 'plus' : 'free';
    const effectiveRenter = tierRank(bundledRenter) >= tierRank(directRenter) ? bundledRenter : directRenter;
    return {
      hostTier,
      renterTier: effectiveRenter,
      hasActiveSubscription: true,
      subscriptionSource: 'host',
    };
  }

  if (renterPlan === 'elite') {
    return { hostTier: 'none', renterTier: 'elite', hasActiveSubscription: true, subscriptionSource: 'renter' };
  }
  if (renterPlan === 'plus') {
    return { hostTier: 'none', renterTier: 'plus', hasActiveSubscription: true, subscriptionSource: 'renter' };
  }

  return { hostTier: 'none', renterTier: 'free', hasActiveSubscription: false, subscriptionSource: 'none' };
}

function tierRank(tier: RenterTier): number {
  if (tier === 'elite') return 2;
  if (tier === 'plus') return 1;
  return 0;
}

export function getSubscriptionLabel(
  hostTier: HostTier,
  renterTier: RenterTier,
  subscriptionSource: 'renter' | 'host' | 'none',
): string {
  const hostLabels: Record<string, string> = {
    starter: 'Host Starter',
    pro: 'Host Pro',
    business: 'Host Business',
    agent_starter: 'Agent Starter',
    agent_pro: 'Agent Pro',
    agent_business: 'Agent Business',
    company_starter: 'Company Starter',
    company_pro: 'Company Pro',
    company_enterprise: 'Company Enterprise',
  };

  if (hostTier !== 'none') {
    const label = hostLabels[hostTier] || hostTier;
    const bundleNote = BUNDLE_LABELS[hostTier];
    return bundleNote ? `${label} · ${bundleNote}` : label;
  }

  if (renterTier === 'elite') return 'Renter Elite';
  if (renterTier === 'plus') return 'Renter Plus';
  return 'Free Plan';
}
