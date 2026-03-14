import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDev } from './envUtils';

const MEMORY_KEY = 'roomdr_ai_memory';

export interface AIMemory {
  totalSwipes: number;
  rightSwipes: number;
  leftSwipes: number;
  skipReasons: string[];
  avgMatchScore: number;
  matchScoreTrend: 'improving' | 'declining' | 'stable';
  skippedDueToDistance: number;
  skippedDueToSchedule: number;
  skippedDueToBudget: number;
  autoTightenedFilters: string[];
  totalConversations: number;
  coldConversations: string[];
  avgResponseRatePercent: number;
  lastActiveByChat: Record<string, string>;
  profileCompletionPercent: number;
  missingFields: string[];
  matchesBlockedByMissingFields: number;
  moveInDate: string | null;
  daysUntilMoveIn: number | null;
  refinementQuestionsAnswered: number;
  lastRefinementTimestamp: string | null;
  lastUpdated: string;
}

const DEFAULT_MEMORY: AIMemory = {
  totalSwipes: 0,
  rightSwipes: 0,
  leftSwipes: 0,
  skipReasons: [],
  avgMatchScore: 0,
  matchScoreTrend: 'stable',
  skippedDueToDistance: 0,
  skippedDueToSchedule: 0,
  skippedDueToBudget: 0,
  autoTightenedFilters: [],
  totalConversations: 0,
  coldConversations: [],
  avgResponseRatePercent: 0,
  lastActiveByChat: {},
  profileCompletionPercent: 0,
  missingFields: [],
  matchesBlockedByMissingFields: 0,
  moveInDate: null,
  daysUntilMoveIn: null,
  refinementQuestionsAnswered: 0,
  lastRefinementTimestamp: null,
  lastUpdated: new Date().toISOString(),
};

export async function getAIMemory(): Promise<AIMemory> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_KEY);
    if (!raw) return { ...DEFAULT_MEMORY };
    return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export async function updateAIMemory(patch: Partial<AIMemory>): Promise<void> {
  const current = await getAIMemory();
  const updated = { ...current, ...patch, lastUpdated: new Date().toISOString() };
  await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(updated));
}

export async function resetAIMemory(): Promise<void> {
  if (!isDev) return;
  await AsyncStorage.removeItem(MEMORY_KEY);
}

export async function recordSwipe(wasRight: boolean, matchScore?: number): Promise<void> {
  const mem = await getAIMemory();
  const totalSwipes = mem.totalSwipes + 1;
  const rightSwipes = wasRight ? mem.rightSwipes + 1 : mem.rightSwipes;
  const leftSwipes = !wasRight ? mem.leftSwipes + 1 : mem.leftSwipes;
  let avgMatchScore = mem.avgMatchScore;
  if (matchScore !== undefined) {
    avgMatchScore = ((mem.avgMatchScore * mem.totalSwipes) + matchScore) / totalSwipes;
  }
  await updateAIMemory({ totalSwipes, rightSwipes, leftSwipes, avgMatchScore });
}

export async function recordMessageActivity(chatId: string): Promise<void> {
  const mem = await getAIMemory();
  const lastActiveByChat = { ...mem.lastActiveByChat, [chatId]: new Date().toISOString() };
  const coldConversations = Object.entries(lastActiveByChat)
    .filter(([, ts]) => {
      const daysSince = (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 5;
    })
    .map(([id]) => id);
  await updateAIMemory({ lastActiveByChat, coldConversations });
}
