import { User } from '../types/models';

export function getBoostDuration(plan: string): 12 | 24 | 48 {
  if (plan === 'elite') return 48;
  if (plan === 'plus') return 24;
  return 12;
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
