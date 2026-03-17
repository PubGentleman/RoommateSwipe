import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/models';

export const COLD_MESSAGE_LIMITS: Record<string, number> = {
  basic: 3,
  plus: 10,
  elite: Infinity,
};

export function getDailyColdMessageLimit(plan: string): number {
  return COLD_MESSAGE_LIMITS[plan] ?? 3;
}

export async function getDailyColdMessageCount(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const key = `cold_msg_count_${userId}_${today}`;
  const stored = await AsyncStorage.getItem(key);
  return stored ? parseInt(stored, 10) : 0;
}

export async function incrementDailyColdMessageCount(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `cold_msg_count_${userId}_${today}`;
  const current = await getDailyColdMessageCount(userId);
  await AsyncStorage.setItem(key, String(current + 1));
}

export const MESSAGING_LIMITS = {
  basic: {
    dailyMessages: 20,
    activeChats: 3,
    coldMessaging: true,
  },
  plus: {
    dailyMessages: 200,
    activeChats: 10,
    coldMessaging: true,
  },
  elite: {
    dailyMessages: Infinity,
    activeChats: Infinity,
    coldMessaging: true,
  },
};

export const canSendMessage = (
  user: User,
  plan: 'basic' | 'plus' | 'elite'
): { allowed: boolean; reason?: string } => {
  const limits = MESSAGING_LIMITS[plan];

  const today = new Date().toISOString().split('T')[0];
  const resetDate = user.messagingData?.dailyMessageResetDate?.split('T')[0];
  const dailyCount = resetDate === today
    ? (user.messagingData?.dailyMessageCount ?? 0)
    : 0;

  if (plan !== 'elite' && dailyCount >= limits.dailyMessages) {
    return {
      allowed: false,
      reason: 'daily_limit',
    };
  }

  return { allowed: true };
};

export const canStartNewChat = (
  user: User,
  plan: 'basic' | 'plus' | 'elite'
): { allowed: boolean; reason?: string } => {
  const limits = MESSAGING_LIMITS[plan];
  const activeChats = user.messagingData?.activeChatsCount ?? 0;

  if (activeChats >= limits.activeChats) {
    return {
      allowed: false,
      reason: 'chat_limit',
    };
  }

  return { allowed: true };
};

export const getDailyMessageCount = (user: User): number => {
  const today = new Date().toISOString().split('T')[0];
  const resetDate = user.messagingData?.dailyMessageResetDate?.split('T')[0];
  return resetDate === today ? (user.messagingData?.dailyMessageCount ?? 0) : 0;
};

export const getTimeUntilMidnight = (): string => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};
