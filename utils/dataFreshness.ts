const timestamps: Record<string, number> = {};

export function isDataFresh(key: string, maxAgeMs: number = 30000): boolean {
  const lastLoaded = timestamps[key];
  if (!lastLoaded) return false;
  return Date.now() - lastLoaded < maxAgeMs;
}

export function markDataFresh(key: string): void {
  timestamps[key] = Date.now();
}

export function invalidateData(key: string): void {
  delete timestamps[key];
}

export function invalidateAll(): void {
  Object.keys(timestamps).forEach(k => delete timestamps[k]);
}
