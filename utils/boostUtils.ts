import { User } from '../types/models';

export const RENTER_BOOST_OPTIONS = [
  {
    id: 'quick' as const,
    durationHours: 6,
    label: '6 Hours',
    price: 2.99,
    highlight: false,
    badge: null as string | null,
  },
  {
    id: 'standard' as const,
    durationHours: 12,
    label: '12 Hours',
    price: 4.99,
    highlight: true,
    badge: 'Most Popular' as string | null,
  },
  {
    id: 'extended' as const,
    durationHours: 24,
    label: '24 Hours',
    price: 7.99,
    highlight: false,
    badge: 'Best Value' as string | null,
  },
] as const;

export type RenterBoostOptionId = typeof RENTER_BOOST_OPTIONS[number]['id'];

export function getFreeBoostDurationHours(plan: string): number {
  if (plan === 'elite') return 24;
  if (plan === 'plus') return 12;
  return 0;
}

export function getBoostDuration(plan: string): 6 | 12 | 24 {
  if (plan === 'elite') return 24;
  if (plan === 'plus') return 12;
  return 6;
}

export function isBoostExpired(boostExpiresAt?: string): boolean {
  if (!boostExpiresAt) return true;
  return new Date().getTime() > new Date(boostExpiresAt).getTime();
}

export function getBoostTimeRemaining(boostExpiresAt?: string): string {
  if (!boostExpiresAt) return '';
  const now = new Date().getTime();
  const expires = new Date(boostExpiresAt).getTime();
  const diff = expires - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export function canActivateBoost(user: User): { allowed: boolean; reason?: string; nextAvailableAt?: string; requiresPayment?: boolean } {
  const plan = user.subscription?.plan || 'basic';

  if (user.boostData?.isBoosted && user.boostData.boostExpiresAt && !isBoostExpired(user.boostData.boostExpiresAt)) {
    return { allowed: false, reason: 'Boost is already active' };
  }

  if (plan === 'basic') {
    return { allowed: true, requiresPayment: true };
  }

  if (plan === 'elite') {
    return { allowed: true };
  }

  if (plan === 'plus') {
    const nextFree = user.boostData?.nextFreeBoostAvailableAt;
    if (nextFree) {
      const nextFreeDate = new Date(nextFree);
      if (new Date() < nextFreeDate) {
        return {
          allowed: true,
          requiresPayment: true,
          reason: `Next free boost available on ${nextFreeDate.toLocaleDateString()}`,
          nextAvailableAt: nextFree,
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Cannot boost' };
}

export function hasFreeBoostAvailable(user: User): boolean {
  const plan = user.subscription?.plan || 'basic';
  if (plan === 'elite') return true;
  if (plan === 'plus') {
    const nextFree = user.boostData?.nextFreeBoostAvailableAt;
    if (!nextFree) return true;
    return new Date() >= new Date(nextFree);
  }
  return false;
}
