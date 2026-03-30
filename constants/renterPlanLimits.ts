export type RenterPlan = 'free' | 'plus' | 'elite';

export type AutoMatchPriority = 'standard' | 'priority' | 'highest';

export interface RenterPlanLimits {
  plan: RenterPlan;
  label: string;
  price: string;
  dailySwipes: number;
  maxGroups: number;
  hasAdvancedFilters: boolean;
  canSeeWhoLiked: boolean;
  hasVerifiedBadge: boolean;
  hasMatchBreakdown: boolean;
  hasProfileBoost: boolean;
  hasPriorityInSearch: boolean;
  hasReadReceipts: boolean;
  hasDedicatedSupport: boolean;
  hasApartmentPreferences: boolean;
  hasTransitFiltering: boolean;
  hasAIGroupSuggestions: boolean;
  hasAIApartmentSuggestions: boolean;
  hasGroupVoting: boolean;
  apartmentSuggestionCount: number;
  hasConflictDetection: boolean;
  hasCompatibilityBreakdown: boolean;
  canSeeContactInfo: boolean;
  piMessagesPerDay: number;
  piInsightLevel: 'summary' | 'highlights' | 'full';
  hasPiDeckReranking: boolean;
  maxPendingAutoGroups: number;
  autoMatchPriority: AutoMatchPriority;
}

export const RENTER_PLAN_LIMITS: Record<RenterPlan, RenterPlanLimits> = {
  free: {
    plan: 'free',
    label: 'Free',
    price: '$0',
    dailySwipes: 10,
    maxGroups: 1,
    hasAdvancedFilters: false,
    canSeeWhoLiked: false,
    hasVerifiedBadge: false,
    hasMatchBreakdown: false,
    hasProfileBoost: false,
    hasPriorityInSearch: false,
    hasReadReceipts: false,
    hasDedicatedSupport: false,
    hasApartmentPreferences: true,
    hasTransitFiltering: false,
    hasAIGroupSuggestions: false,
    hasAIApartmentSuggestions: false,
    hasGroupVoting: false,
    apartmentSuggestionCount: 0,
    hasConflictDetection: false,
    hasCompatibilityBreakdown: false,
    canSeeContactInfo: false,
    piMessagesPerDay: 5,
    piInsightLevel: 'summary',
    hasPiDeckReranking: false,
    maxPendingAutoGroups: 1,
    autoMatchPriority: 'standard',
  },
  plus: {
    plan: 'plus',
    label: 'Plus',
    price: '$14.99/mo',
    dailySwipes: -1,
    maxGroups: 3,
    hasAdvancedFilters: true,
    canSeeWhoLiked: true,
    hasVerifiedBadge: true,
    hasMatchBreakdown: true,
    hasProfileBoost: false,
    hasPriorityInSearch: false,
    hasReadReceipts: false,
    hasDedicatedSupport: false,
    hasApartmentPreferences: true,
    hasTransitFiltering: true,
    hasAIGroupSuggestions: true,
    hasAIApartmentSuggestions: true,
    hasGroupVoting: true,
    apartmentSuggestionCount: 3,
    hasConflictDetection: false,
    hasCompatibilityBreakdown: false,
    canSeeContactInfo: true,
    piMessagesPerDay: 50,
    piInsightLevel: 'highlights',
    hasPiDeckReranking: true,
    maxPendingAutoGroups: 2,
    autoMatchPriority: 'priority',
  },
  elite: {
    plan: 'elite',
    label: 'Elite',
    price: '$29.99/mo',
    dailySwipes: -1,
    maxGroups: -1,
    hasAdvancedFilters: true,
    canSeeWhoLiked: true,
    hasVerifiedBadge: true,
    hasMatchBreakdown: true,
    hasProfileBoost: true,
    hasPriorityInSearch: true,
    hasReadReceipts: true,
    hasDedicatedSupport: true,
    hasApartmentPreferences: true,
    hasTransitFiltering: true,
    hasAIGroupSuggestions: true,
    hasAIApartmentSuggestions: true,
    hasGroupVoting: true,
    apartmentSuggestionCount: -1,
    hasConflictDetection: true,
    hasCompatibilityBreakdown: true,
    canSeeContactInfo: true,
    piMessagesPerDay: 200,
    piInsightLevel: 'full',
    hasPiDeckReranking: true,
    maxPendingAutoGroups: 3,
    autoMatchPriority: 'highest',
  },
};

/**
 * Normalizes legacy plan values from the database.
 * 'basic' was used in older webhook versions — now the webhook uses 'free'.
 * Keep this function to handle any existing 'basic' rows in the subscriptions table.
 */
export function normalizeRenterPlan(plan: string | null | undefined): RenterPlan {
  if (!plan || plan === 'basic') return 'free';
  if (plan === 'plus' || plan === 'elite') return plan;
  return 'free';
}

export function getRenterPlanLimits(plan: RenterPlan): RenterPlanLimits {
  return RENTER_PLAN_LIMITS[plan] ?? RENTER_PLAN_LIMITS.free;
}

export function canSwipe(plan: RenterPlan, swipesToday: number): boolean {
  const { dailySwipes } = getRenterPlanLimits(plan);
  if (dailySwipes === -1) return true;
  return swipesToday < dailySwipes;
}

export function canJoinGroup(plan: RenterPlan, currentGroupCount: number): boolean {
  const { maxGroups } = getRenterPlanLimits(plan);
  if (maxGroups === -1) return true;
  return currentGroupCount < maxGroups;
}
