import AsyncStorage from '@react-native-async-storage/async-storage';

const IMPRESSION_QUEUE_KEY = 'BOOST_IMPRESSION_QUEUE';
const FLUSH_INTERVAL = 30000;
const MAX_BATCH_SIZE = 50;

interface ImpressionEvent {
  listingId: string;
  impressionType: 'card_view' | 'detail_view' | 'search_result';
  timestamp: string;
}

let queue: ImpressionEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function trackImpression(
  listingId: string,
  impressionType: 'card_view' | 'detail_view' | 'search_result' = 'card_view'
) {
  queue.push({
    listingId,
    impressionType,
    timestamp: new Date().toISOString(),
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    flushImpressions();
  }
}

export async function flushImpressions() {
  if (queue.length === 0) return;

  const batch = [...queue];
  queue = [];

  try {
    const existing = await AsyncStorage.getItem(IMPRESSION_QUEUE_KEY);
    const stored: ImpressionEvent[] = existing ? JSON.parse(existing) : [];
    stored.push(...batch);
    await AsyncStorage.setItem(IMPRESSION_QUEUE_KEY, JSON.stringify(stored));
  } catch {
    queue.unshift(...batch);
  }
}

export async function getStoredImpressions(): Promise<ImpressionEvent[]> {
  try {
    const data = await AsyncStorage.getItem(IMPRESSION_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function clearStoredImpressions() {
  await AsyncStorage.removeItem(IMPRESSION_QUEUE_KEY);
}

export function startImpressionTracking() {
  if (flushTimer) return;
  flushTimer = setInterval(flushImpressions, FLUSH_INTERVAL);
}

export function stopImpressionTracking() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushImpressions();
}

export async function getImpressionStats(listingId: string): Promise<{
  totalImpressions: number;
  cardViews: number;
  detailViews: number;
  searchResults: number;
}> {
  const stored = await getStoredImpressions();
  const listingImpressions = stored.filter(i => i.listingId === listingId);

  return {
    totalImpressions: listingImpressions.length,
    cardViews: listingImpressions.filter(i => i.impressionType === 'card_view').length,
    detailViews: listingImpressions.filter(i => i.impressionType === 'detail_view').length,
    searchResults: listingImpressions.filter(i => i.impressionType === 'search_result').length,
  };
}
