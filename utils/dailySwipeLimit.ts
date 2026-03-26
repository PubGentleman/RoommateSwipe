import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_SWIPE_KEY = '@rhome/daily_swipe_count';
const DAILY_SWIPE_DATE_KEY = '@rhome/daily_swipe_date';

let pendingOp: Promise<any> = Promise.resolve();

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = pendingOp.then(fn, fn);
  pendingOp = next.catch(() => {});
  return next;
}

export async function getDailySwipeCount(): Promise<number> {
  return serialize(async () => {
    try {
      const storedDate = await AsyncStorage.getItem(DAILY_SWIPE_DATE_KEY);
      const today = getLocalDateString();
      if (storedDate !== today) {
        await AsyncStorage.multiSet([
          [DAILY_SWIPE_DATE_KEY, today],
          [DAILY_SWIPE_KEY, '0'],
        ]);
        return 0;
      }
      const count = await AsyncStorage.getItem(DAILY_SWIPE_KEY);
      return count ? parseInt(count, 10) : 0;
    } catch {
      return 0;
    }
  });
}

export async function incrementDailySwipeCount(): Promise<number> {
  return serialize(async () => {
    try {
      const storedDate = await AsyncStorage.getItem(DAILY_SWIPE_DATE_KEY);
      const today = getLocalDateString();
      let current = 0;
      if (storedDate === today) {
        const count = await AsyncStorage.getItem(DAILY_SWIPE_KEY);
        current = count ? parseInt(count, 10) : 0;
      } else {
        await AsyncStorage.setItem(DAILY_SWIPE_DATE_KEY, today);
      }
      const newCount = current + 1;
      await AsyncStorage.setItem(DAILY_SWIPE_KEY, String(newCount));
      return newCount;
    } catch {
      return 0;
    }
  });
}

export async function decrementDailySwipeCount(): Promise<number> {
  return serialize(async () => {
    try {
      const storedDate = await AsyncStorage.getItem(DAILY_SWIPE_DATE_KEY);
      const today = getLocalDateString();
      if (storedDate !== today) return 0;
      const count = await AsyncStorage.getItem(DAILY_SWIPE_KEY);
      const current = count ? parseInt(count, 10) : 0;
      const newCount = Math.max(0, current - 1);
      await AsyncStorage.setItem(DAILY_SWIPE_KEY, String(newCount));
      return newCount;
    } catch {
      return 0;
    }
  });
}

export function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
