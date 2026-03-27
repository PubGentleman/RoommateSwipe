import { getRenterPlanLimits, type RenterPlan } from '../constants/renterPlanLimits';

export const canSeeWhoLiked = (p: RenterPlan) => getRenterPlanLimits(p).canSeeWhoLiked;
export const canSeeMatchBreakdown = (p: RenterPlan) => getRenterPlanLimits(p).hasMatchBreakdown;
export const hasProfileBoost = (p: RenterPlan) => getRenterPlanLimits(p).hasProfileBoost;
export const hasReadReceipts = (p: RenterPlan) => getRenterPlanLimits(p).hasReadReceipts;
export const hasAdvancedFilters = (p: RenterPlan) => getRenterPlanLimits(p).hasAdvancedFilters;
export const hasVerifiedBadge = (p: RenterPlan) => getRenterPlanLimits(p).hasVerifiedBadge;
export const hasDedicatedSupport = (p: RenterPlan) => getRenterPlanLimits(p).hasDedicatedSupport;
export const hasPriorityInSearch = (p: RenterPlan) => getRenterPlanLimits(p).hasPriorityInSearch;
