export type AgentPlan = 'pay_per_use' | 'free' | 'agent_starter' | 'agent_pro' | 'agent_business';

interface AgentPlanLimits {
  listingLimit: number;
  placementFee: number;
  teamSeats: number;
  hasAIMatching: boolean;
  hasAdvancedAI: boolean;
  hasPIMatching: boolean;
  hasBackgroundChecks: boolean;
  hasAdvancedAnalytics: boolean;
  hasCRM: boolean;
  hasVerifiedBadge: boolean;
  hasBoosts: boolean;
  hasDedicatedSupport: boolean;
  hasCompatibilityMatrix: boolean;
  compatibilityMatrixLimit: number;
  label: string;
}

const AGENT_PLAN_LIMITS: Record<string, AgentPlanLimits> = {
  pay_per_use: {
    listingLimit: 3, placementFee: 149, teamSeats: 0,
    hasAIMatching: false, hasAdvancedAI: false, hasPIMatching: false,
    hasBackgroundChecks: false, hasAdvancedAnalytics: false, hasCRM: false,
    hasVerifiedBadge: false, hasBoosts: false, hasDedicatedSupport: false,
    hasCompatibilityMatrix: false, compatibilityMatrixLimit: 0,
    label: 'Pay Per Use',
  },
  free: {
    listingLimit: 3, placementFee: 149, teamSeats: 0,
    hasAIMatching: false, hasAdvancedAI: false, hasPIMatching: false,
    hasBackgroundChecks: false, hasAdvancedAnalytics: false, hasCRM: false,
    hasVerifiedBadge: false, hasBoosts: false, hasDedicatedSupport: false,
    hasCompatibilityMatrix: false, compatibilityMatrixLimit: 0,
    label: 'Pay Per Use',
  },
  agent_starter: {
    listingLimit: 10, placementFee: 99, teamSeats: 0,
    hasAIMatching: true, hasAdvancedAI: false, hasPIMatching: false,
    hasBackgroundChecks: false, hasAdvancedAnalytics: false, hasCRM: false,
    hasVerifiedBadge: true, hasBoosts: true, hasDedicatedSupport: false,
    hasCompatibilityMatrix: true, compatibilityMatrixLimit: 5,
    label: 'Agent Starter',
  },
  agent_pro: {
    listingLimit: 30, placementFee: 49, teamSeats: 0,
    hasAIMatching: true, hasAdvancedAI: true, hasPIMatching: true,
    hasBackgroundChecks: true, hasAdvancedAnalytics: true, hasCRM: false,
    hasVerifiedBadge: true, hasBoosts: true, hasDedicatedSupport: true,
    hasCompatibilityMatrix: true, compatibilityMatrixLimit: -1,
    label: 'Agent Pro',
  },
  agent_business: {
    listingLimit: -1, placementFee: 25, teamSeats: 0,
    hasAIMatching: true, hasAdvancedAI: true, hasPIMatching: true,
    hasBackgroundChecks: true, hasAdvancedAnalytics: true, hasCRM: true,
    hasVerifiedBadge: true, hasBoosts: true, hasDedicatedSupport: true,
    hasCompatibilityMatrix: true, compatibilityMatrixLimit: -1,
    label: 'Agent Business',
  },
};

export function getAgentLimits(plan: string): AgentPlanLimits {
  return AGENT_PLAN_LIMITS[plan] || AGENT_PLAN_LIMITS.pay_per_use;
}

export function getAgentListingLimit(plan: string): number {
  return getAgentLimits(plan).listingLimit;
}

export function getAgentPlacementFee(plan: string): number {
  return getAgentLimits(plan).placementFee;
}

export function canAgentAccessAnalytics(plan: string): boolean {
  return getAgentLimits(plan).hasAdvancedAnalytics;
}

export function canAgentUseAIMatching(plan: string): boolean {
  return getAgentLimits(plan).hasAIMatching;
}

export function canAgentRunBackgroundChecks(plan: string): boolean {
  return getAgentLimits(plan).hasBackgroundChecks;
}

/** @deprecated Agents do not manage teams — only companies do. Always returns 0. */
export function getAgentTeamSeats(_plan: string): number {
  return 0;
}

export function isAgentPlan(plan: string): boolean {
  return plan.startsWith('agent_') || plan === 'pay_per_use';
}

export function isAgentOrCompanyPlan(plan: string, hostType?: string): boolean {
  return plan.startsWith('agent_') || plan.startsWith('company_') || plan === 'pay_per_use' ||
    hostType === 'agent' || hostType === 'company';
}
