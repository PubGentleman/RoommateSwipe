export type RenterPlan = 'free' | 'plus' | 'elite';

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
  hasIncognito: boolean;
  hasDedicatedSupport: boolean;
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
    hasIncognito: false,
    hasDedicatedSupport: false,
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
    hasMatchBreakdown: false,
    hasProfileBoost: false,
    hasPriorityInSearch: false,
    hasReadReceipts: false,
    hasIncognito: false,
    hasDedicatedSupport: false,
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
    hasIncognito: true,
    hasDedicatedSupport: true,
  },
};

export function normalizeRenterPlan(plan: string | undefined): RenterPlan {
  if (plan === 'basic' || !plan) return 'free';
  if (plan === 'plus') return 'plus';
  if (plan === 'elite') return 'elite';
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
