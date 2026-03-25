import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resolveEntitlements, UserEntitlements } from '../utils/entitlements';

const defaultEntitlements: UserEntitlements = {
  hostTier: 'none',
  renterTier: 'free',
  hasActiveSubscription: false,
  subscriptionSource: 'none',
};

export function useEntitlements(): UserEntitlements & {
  isRenterPlus: boolean;
  isRenterElite: boolean;
  isAnyHost: boolean;
} {
  const { user } = useAuth();

  const entitlements = useMemo(() => {
    if (!user) return defaultEntitlements;
    const hostPlan = user.hostSubscription?.plan;
    const renterPlan = user.subscription?.plan;
    return resolveEntitlements(hostPlan, renterPlan, user.hostType);
  }, [user?.hostSubscription?.plan, user?.subscription?.plan, user?.hostType]);

  return {
    ...entitlements,
    isRenterPlus: entitlements.renterTier === 'plus' || entitlements.renterTier === 'elite',
    isRenterElite: entitlements.renterTier === 'elite',
    isAnyHost: entitlements.hostTier !== 'none',
  };
}
