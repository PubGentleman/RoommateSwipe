export const INACTIVE_CUTOFF_DAYS = 30;

export function getRecencyMultiplier(lastActiveAt: string | null | undefined): number {
  if (!lastActiveAt) return 0.5;
  const daysSince = (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) return 1.0;
  if (daysSince <= 7) return 0.8;
  if (daysSince <= 14) return 0.5;
  if (daysSince <= 30) return 0.2;
  return 0.0;
}

export function isWithinActivityCutoff(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return true;
  const daysSince = (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince <= INACTIVE_CUTOFF_DAYS;
}

export function applyDecaySort<T extends Record<string, any>>(
  items: T[],
  getLastActive: (item: T) => string | null | undefined,
  getScore?: (item: T) => number,
): T[] {
  return items
    .filter(item => {
      const multiplier = getRecencyMultiplier(getLastActive(item));
      return multiplier > 0;
    })
    .map(item => {
      const baseScore = getScore ? getScore(item) : 1;
      const multiplier = getRecencyMultiplier(getLastActive(item));
      return { ...item, _decayScore: baseScore * multiplier };
    })
    .sort((a, b) => (b as any)._decayScore - (a as any)._decayScore);
}
