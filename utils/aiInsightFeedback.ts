import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDev } from './envUtils';

const FEEDBACK_KEY = 'roomdr_ai_insight_feedback';

interface InsightFeedback {
  helpfulCounts: Record<string, number>;
  dismissedCounts: Record<string, number>;
  permanentlyHidden: string[];
  lastDismissed: Record<string, string>;
}

const DEFAULT_FEEDBACK: InsightFeedback = {
  helpfulCounts: {},
  dismissedCounts: {},
  permanentlyHidden: [],
  lastDismissed: {},
};

export async function getInsightFeedback(): Promise<InsightFeedback> {
  const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
  if (!raw) return { ...DEFAULT_FEEDBACK };
  try {
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_FEEDBACK };
  }
}

async function saveFeedback(feedback: InsightFeedback): Promise<void> {
  await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
}

export async function thumbsUp(insightType: string): Promise<void> {
  const fb = await getInsightFeedback();
  fb.helpfulCounts[insightType] = (fb.helpfulCounts[insightType] || 0) + 1;
  await saveFeedback(fb);
}

export async function thumbsDown(insightType: string): Promise<{ permanentlyHidden: boolean }> {
  const fb = await getInsightFeedback();
  fb.dismissedCounts[insightType] = (fb.dismissedCounts[insightType] || 0) + 1;
  fb.lastDismissed[insightType] = new Date().toISOString();
  const isPermaHidden = fb.dismissedCounts[insightType] >= 3;
  if (isPermaHidden && !fb.permanentlyHidden.includes(insightType)) {
    fb.permanentlyHidden.push(insightType);
  }
  await saveFeedback(fb);
  return { permanentlyHidden: isPermaHidden };
}

export async function shouldShowInsight(insightType: string): Promise<boolean> {
  const fb = await getInsightFeedback();
  if (fb.permanentlyHidden.includes(insightType)) return false;
  const lastDismissed = fb.lastDismissed[insightType];
  if (lastDismissed) {
    const daysSince = (Date.now() - new Date(lastDismissed).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) return false;
  }
  return true;
}

export async function resetInsightFeedback(): Promise<void> {
  if (!isDev) return;
  await AsyncStorage.removeItem(FEEDBACK_KEY);
}
