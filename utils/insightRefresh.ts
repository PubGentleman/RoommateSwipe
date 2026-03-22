import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'rhome_ai_insight_cache';

export const INSIGHT_TRIGGERS: Record<string, { trigger: string; staleAfterHours: number | null }> = {
  'profile-completion': {
    trigger: 'profile_change',
    staleAfterHours: null,
  },
  'match-rate': {
    trigger: 'swipe_session_end',
    staleAfterHours: 24,
  },
  'pool-impact': {
    trigger: 'filter_change',
    staleAfterHours: null,
  },
  'response-rate': {
    trigger: 'message_activity',
    staleAfterHours: 24,
  },
  'profile-tips': {
    trigger: 'profile_change',
    staleAfterHours: null,
  },
  'chat-coach': {
    trigger: 'message_activity',
    staleAfterHours: 48,
  },
  'move-in-timeline': {
    trigger: 'daily',
    staleAfterHours: 24,
  },
  'safety-briefing': {
    trigger: 'chat_keyword',
    staleAfterHours: null,
  },
};

interface InsightCacheEntry {
  lastCalculated: string;
  value: any;
  triggerVersion: string;
}

interface InsightCache {
  [insightType: string]: InsightCacheEntry;
}

async function getCache(): Promise<InsightCache> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache: InsightCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function shouldRecalculate(insightType: string, currentTriggerVersion: string): Promise<boolean> {
  const cache = await getCache();
  const entry = cache[insightType];
  if (!entry) return true;

  if (entry.triggerVersion !== currentTriggerVersion) return true;

  const config = INSIGHT_TRIGGERS[insightType];
  if (config?.staleAfterHours !== null && config?.staleAfterHours !== undefined) {
    const hoursSince = (Date.now() - new Date(entry.lastCalculated).getTime()) / (1000 * 60 * 60);
    if (hoursSince >= config.staleAfterHours) return true;
  }

  return false;
}

export async function cacheInsight(insightType: string, value: any, triggerVersion: string): Promise<void> {
  const cache = await getCache();
  cache[insightType] = {
    lastCalculated: new Date().toISOString(),
    value,
    triggerVersion,
  };
  await saveCache(cache);
}

export async function getCachedInsight(insightType: string): Promise<any | null> {
  const cache = await getCache();
  return cache[insightType]?.value ?? null;
}

type TriggerType = 'profile_change' | 'swipe_session_end' | 'filter_change' | 'message_activity' | 'daily' | 'chat_keyword';

const listeners: Array<(triggerType: TriggerType, insightTypes: string[]) => void> = [];

export function onInsightTrigger(callback: (triggerType: TriggerType, insightTypes: string[]) => void): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function dispatchInsightTrigger(triggerType: TriggerType): void {
  const affected = Object.entries(INSIGHT_TRIGGERS)
    .filter(([, config]) => config.trigger === triggerType)
    .map(([type]) => type);

  if (affected.length === 0) return;

  for (const listener of listeners) {
    try {
      listener(triggerType, affected);
    } catch {}
  }
}

const DAILY_CHECK_KEY = 'rhome_ai_daily_last_check';

export async function checkDailyTrigger(): Promise<void> {
  const last = await AsyncStorage.getItem(DAILY_CHECK_KEY);
  if (last) {
    const hoursSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return;
  }
  await AsyncStorage.setItem(DAILY_CHECK_KEY, new Date().toISOString());
  dispatchInsightTrigger('daily');
}

export function getTriggerVersion(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
