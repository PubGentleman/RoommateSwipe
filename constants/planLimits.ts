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
  hasVerifiedBadge: boolean;
  hasBoosts: boolean;
  freeBoostsPerMonth: number;
  simultaneousBoosts: number;
  piCallsPerMonth: number;
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
    hasVerifiedBadge: false,
    hasBoosts: false,
    freeBoostsPerMonth: 0,
    simultaneousBoosts: 0,
    piCallsPerMonth: 5,
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
    hasVerifiedBadge: false,
    hasBoosts: false,
    freeBoostsPerMonth: 0,
    simultaneousBoosts: 0,
    piCallsPerMonth: 5,
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
    hasVerifiedBadge: true,
    hasBoosts: true,
    freeBoostsPerMonth: 1,
    simultaneousBoosts: 1,
    piCallsPerMonth: 30,
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
    hasVerifiedBadge: true,
    hasBoosts: true,
    freeBoostsPerMonth: 1,
    simultaneousBoosts: 3,
    piCallsPerMonth: 100,
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
    hasVerifiedBadge: true,
    hasBoosts: true,
    freeBoostsPerMonth: 2,
    simultaneousBoosts: 10,
    piCallsPerMonth: 200,
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

export type AgentPlan = 'pay_per_use' | 'starter' | 'pro' | 'business';

export interface AgentPlanLimits {
  plan: AgentPlan;
  label: string;
  monthlyPrice: string;
  placementFeeCents: number;
  shortlistLimit: number;
  activeGroupsLimit: number;
  monthlyPlacementLimit: number;
  listingLimit: number;
  hasAISuggestions: boolean;
  hasAIGroupSuggestions: boolean;
  hasCompatibilityMatrix: boolean;
  hasAIChat: boolean;
  hasPriorityVisibility: boolean;
  hasAdvancedAnalytics: boolean;
  hasClientManagement: boolean;
  teamSeats: number;
  piCallsPerMonth: number;
}

const _agentBase = {
  pay_per_use: {
    plan: 'pay_per_use' as AgentPlan,
    label: 'Pay Per Use',
    monthlyPrice: '$0',
    placementFeeCents: 14900,
    shortlistLimit: 5,
    activeGroupsLimit: 1,
    monthlyPlacementLimit: -1,
    listingLimit: 1,
    hasAISuggestions: false,
    hasAIGroupSuggestions: false,
    hasCompatibilityMatrix: false,
    hasAIChat: false,
    hasPriorityVisibility: false,
    hasAdvancedAnalytics: false,
    hasClientManagement: false,
    teamSeats: 1,
    piCallsPerMonth: 20,
  },
  starter: {
    plan: 'starter' as AgentPlan,
    label: 'Agent Starter',
    monthlyPrice: '$49',
    placementFeeCents: 9900,
    shortlistLimit: 10,
    activeGroupsLimit: 1,
    monthlyPlacementLimit: 2,
    listingLimit: 5,
    hasAISuggestions: false,
    hasAIGroupSuggestions: false,
    hasCompatibilityMatrix: false,
    hasAIChat: false,
    hasPriorityVisibility: false,
    hasAdvancedAnalytics: false,
    hasClientManagement: true,
    teamSeats: 1,
    piCallsPerMonth: 100,
  },
  pro: {
    plan: 'pro' as AgentPlan,
    label: 'Agent Pro',
    monthlyPrice: '$99',
    placementFeeCents: 4900,
    shortlistLimit: 50,
    activeGroupsLimit: 5,
    monthlyPlacementLimit: 10,
    listingLimit: -1,
    hasAISuggestions: true,
    hasAIGroupSuggestions: true,
    hasCompatibilityMatrix: true,
    hasAIChat: true,
    hasPriorityVisibility: false,
    hasAdvancedAnalytics: false,
    hasClientManagement: true,
    teamSeats: 1,
    piCallsPerMonth: 200,
  },
  business: {
    plan: 'business' as AgentPlan,
    label: 'Agent Business',
    monthlyPrice: '$149',
    placementFeeCents: 2500,
    shortlistLimit: -1,
    activeGroupsLimit: -1,
    monthlyPlacementLimit: -1,
    listingLimit: -1,
    hasAISuggestions: true,
    hasAIGroupSuggestions: true,
    hasCompatibilityMatrix: true,
    hasAIChat: true,
    hasPriorityVisibility: true,
    hasAdvancedAnalytics: true,
    hasClientManagement: true,
    teamSeats: 5,
    piCallsPerMonth: 500,
  },
};

export const AGENT_PLAN_LIMITS: Record<string, AgentPlanLimits> = {
  ..._agentBase,
  agent_starter: _agentBase.starter,
  agent_pro: _agentBase.pro,
  agent_business: _agentBase.business,
};

export function getAgentPlanLimits(plan: string): AgentPlanLimits {
  return AGENT_PLAN_LIMITS[plan] ?? AGENT_PLAN_LIMITS.pay_per_use;
}

export function canAgentAddListing(plan: string, currentCount: number): boolean {
  const { listingLimit } = getAgentPlanLimits(plan);
  if (listingLimit === -1) return true;
  return currentCount < listingLimit;
}

export function getAgentListingLimitMessage(plan: string): string {
  const limits = getAgentPlanLimits(plan);
  if (limits.listingLimit === -1) return '';
  const nextPlan = plan === 'pay_per_use' ? 'Agent Starter' : plan === 'starter' ? 'Agent Pro' : 'Agent Business';
  return `Your ${limits.label} plan allows up to ${limits.listingLimit} active listing${limits.listingLimit > 1 ? 's' : ''}. Upgrade to ${nextPlan} to add more.`;
}

export function canAgentShortlist(plan: string, currentCount: number): boolean {
  const { shortlistLimit } = getAgentPlanLimits(plan);
  if (shortlistLimit === -1) return true;
  return currentCount < shortlistLimit;
}

export function canAgentCreateGroup(plan: string, activeGroupCount: number): boolean {
  const { activeGroupsLimit } = getAgentPlanLimits(plan);
  if (activeGroupsLimit === -1) return true;
  return activeGroupCount < activeGroupsLimit;
}

export function canAgentPlace(plan: string, monthlyPlacementCount: number): boolean {
  const { monthlyPlacementLimit } = getAgentPlanLimits(plan);
  if (monthlyPlacementLimit === -1) return true;
  return monthlyPlacementCount < monthlyPlacementLimit;
}

export const UNLOCK_PACKAGES = [
  { id: 'small', label: '+3 messages today',  credits: 3,  priceCents: 499  },
  { id: 'large', label: '+10 messages today', credits: 10, priceCents: 1299 },
];
