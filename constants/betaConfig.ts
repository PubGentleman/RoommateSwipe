export const BETA_MODE = true;

export function isBetaUnlocked(): boolean {
  return BETA_MODE;
}

export function effectiveRenterPlan(actualPlan: string): string {
  if (BETA_MODE) return 'elite';
  return actualPlan;
}

export function effectiveHostPlan(actualPlan: string): string {
  if (BETA_MODE) return 'business';
  return actualPlan;
}

export function isAtLeastPlan(
  actualPlan: string | undefined | null,
  requiredPlan: 'plus' | 'elite' | 'starter' | 'pro' | 'business',
): boolean {
  if (BETA_MODE) return true;
  const renterOrder: Record<string, number> = { basic: 0, free: 0, plus: 1, elite: 2 };
  const hostOrder: Record<string, number> = { free: 0, none: 0, starter: 1, pro: 2, business: 3 };

  const p = actualPlan || 'free';
  if (requiredPlan in renterOrder) {
    return (renterOrder[p] ?? 0) >= (renterOrder[requiredPlan] ?? 0);
  }
  return (hostOrder[p] ?? 0) >= (hostOrder[requiredPlan] ?? 0);
}
