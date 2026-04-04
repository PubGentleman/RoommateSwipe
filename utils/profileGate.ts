import { User } from '../types/models';

export type ProfileTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ProfileGateStatus {
  tier: ProfileTier;
  tierIndex: number;
  completedItems: string[];
  nextItems: string[];
  nextTier: ProfileTier | null;
  canSwipe: boolean;
  canSave: boolean;
  canMessage: boolean;
  canJoinGroups: boolean;
  canSuperLike: boolean;
  canColdMessage: boolean;
  canAutoMatch: boolean;
  canBoost: boolean;
  completionPct: number;
}

const ALL_ITEMS = [
  { id: 'location', label: 'Add your location', check: (u: User) => !!(u.profileData?.city || u.profileData?.location) },
  { id: 'photo', label: 'Upload a profile photo', check: (u: User) => !!u.profilePicture },
  { id: 'bio', label: 'Write a short bio', check: (u: User) => !!(u.profileData?.bio && u.profileData.bio.length >= 20) },
  { id: 'lifestyle', label: 'Set lifestyle preferences', check: (u: User) => !!(u.profileData?.preferences?.sleepSchedule && u.profileData?.preferences?.cleanliness) },
  { id: 'budget', label: 'Set your budget range', check: (u: User) => !!(u.profileData?.budget) },
  { id: 'dealbreakers', label: 'Set your dealbreakers', check: (u: User) => {
    const prefs = u.profileData?.preferences;
    if (!prefs) return false;
    return !!(prefs.smoking || prefs.pets || prefs.guestPolicy);
  }},
  { id: 'photos_3', label: 'Add 3+ profile photos', check: (u: User) => (u.photos?.length || 0) >= 3 },
  { id: 'occupation', label: 'Add your occupation', check: (u: User) => !!(u.profileData?.occupation) },
  { id: 'personality', label: 'Complete personality quiz', check: (u: User) => {
    const answers = u.personalityAnswers || u.profileData?.personalityAnswers;
    return !!(answers && Object.keys(answers).length > 0);
  }},
];

const TIER_THRESHOLDS: { tier: ProfileTier; minCompleted: number }[] = [
  { tier: 'bronze', minCompleted: 1 },
  { tier: 'silver', minCompleted: 3 },
  { tier: 'gold', minCompleted: 6 },
  { tier: 'platinum', minCompleted: 8 },
];

export function getProfileGateStatus(user: User | null): ProfileGateStatus {
  if (!user) return getDefaultStatus();

  const completed = ALL_ITEMS.filter(item => item.check(user)).map(item => item.id);
  const incomplete = ALL_ITEMS.filter(item => !item.check(user));

  let tier: ProfileTier = 'bronze';
  let tierIndex = 0;
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (completed.length >= TIER_THRESHOLDS[i].minCompleted) {
      tier = TIER_THRESHOLDS[i].tier;
      tierIndex = i;
      break;
    }
  }

  const nextTierDef = TIER_THRESHOLDS[tierIndex + 1];
  const nextTier = nextTierDef ? nextTierDef.tier : null;
  const itemsNeededForNext = nextTierDef
    ? incomplete.slice(0, nextTierDef.minCompleted - completed.length)
    : [];

  return {
    tier,
    tierIndex,
    completedItems: completed,
    nextItems: itemsNeededForNext.map(i => i.label),
    nextTier,
    canSwipe: tierIndex >= 1,
    canSave: tierIndex >= 1,
    canMessage: tierIndex >= 2,
    canJoinGroups: tierIndex >= 2,
    canSuperLike: tierIndex >= 2,
    canColdMessage: tierIndex >= 3,
    canAutoMatch: tierIndex >= 3,
    canBoost: tierIndex >= 3,
    completionPct: Math.round((completed.length / ALL_ITEMS.length) * 100),
  };
}

function getDefaultStatus(): ProfileGateStatus {
  return {
    tier: 'bronze',
    tierIndex: 0,
    completedItems: [],
    nextItems: ALL_ITEMS.slice(0, 3).map(i => i.label),
    nextTier: 'silver',
    canSwipe: false,
    canSave: false,
    canMessage: false,
    canJoinGroups: false,
    canSuperLike: false,
    canColdMessage: false,
    canAutoMatch: false,
    canBoost: false,
    completionPct: 0,
  };
}

export function getItemsForTier(user: User | null, targetTier: ProfileTier): string[] {
  if (!user) return ALL_ITEMS.slice(0, 3).map(i => i.label);
  const targetIdx = TIER_THRESHOLDS.findIndex(t => t.tier === targetTier);
  if (targetIdx < 0) return [];
  const needed = TIER_THRESHOLDS[targetIdx].minCompleted;
  const completed = ALL_ITEMS.filter(item => item.check(user));
  const incomplete = ALL_ITEMS.filter(item => !item.check(user));
  const remaining = Math.max(0, needed - completed.length);
  return incomplete.slice(0, remaining).map(i => i.label);
}

export const TIER_INFO: Record<ProfileTier, {
  label: string;
  color: string;
  icon: string;
  description: string;
}> = {
  bronze: {
    label: 'Bronze',
    color: '#CD7F32',
    icon: 'shield',
    description: 'Browse listings and profiles',
  },
  silver: {
    label: 'Silver',
    color: '#C0C0C0',
    icon: 'star',
    description: 'Swipe on roommates and save listings',
  },
  gold: {
    label: 'Gold',
    color: '#FFD700',
    icon: 'award',
    description: 'Message matches, join groups, super like',
  },
  platinum: {
    label: 'Platinum',
    color: '#E5E4E2',
    icon: 'zap',
    description: 'Full access: cold messages, auto-match, boosts',
  },
};
