const ROTATION_WINDOW_MS = 30 * 60 * 1000;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash >>> 0;
}

function currentSlot(): number {
  return Math.floor(Date.now() / ROTATION_WINDOW_MS);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    const j = (s >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function applyBoostRotation<T>(
  boosted: T[],
  normal: T[],
  viewerId: string
): T[] {
  if (boosted.length <= 1) return [...boosted, ...normal];
  const seed = currentSlot() ^ hashString(viewerId);
  const rotated = seededShuffle(boosted, seed);
  return [...rotated, ...normal];
}

export function getBoostRotationIndex(
  itemId: string,
  allBoostedIds: string[],
  viewerId: string
): number {
  const seed = currentSlot() ^ hashString(viewerId);
  const shuffled = seededShuffle(allBoostedIds, seed);
  return shuffled.indexOf(itemId);
}
