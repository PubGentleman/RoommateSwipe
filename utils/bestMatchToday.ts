import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 24 * 60 * 60 * 1000;

export async function getBestMatchToday(userId: string): Promise<{
  profile: any; score: number; reason: string;
} | null> {
  if (!isSupabaseConfigured) return null;

  const cacheKey = `@rhome/best_match_today_${userId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < TTL_MS) return parsed.data;
    }
  } catch {}

  const { data: scoreRows } = await supabase
    .from('match_scores')
    .select('user_id, target_id, score, breakdown')
    .or(`user_id.eq.${userId},target_id.eq.${userId}`)
    .gte('score', 80)
    .order('score', { ascending: false })
    .limit(1);

  if (!scoreRows || scoreRows.length === 0) return null;

  const row = scoreRows[0];
  const otherId = row.user_id === userId ? row.target_id : row.user_id;

  const { data: otherUser } = await supabase
    .from('users')
    .select('*, profile:profiles(*)')
    .eq('id', otherId)
    .single();

  if (!otherUser) return null;

  let reason = '';
  const b = row.breakdown ?? {};
  if (b.sleep >= 20 && b.cleanliness >= 15) {
    reason = 'Same sleep schedule and cleanliness level';
  } else if (b.budget >= 20) {
    reason = 'Budget and lifestyle are a strong match';
  } else {
    reason = 'High compatibility across multiple factors';
  }

  const result = { profile: otherUser, score: row.score, reason };
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: result, cachedAt: Date.now() }));
  } catch {}
  return result;
}
