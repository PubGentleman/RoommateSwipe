import { isDev } from './envUtils';
import { isSupabaseConfigured } from '../lib/supabase';

export { isDev } from './envUtils';

export const getMockFallback = <T>(mockData: T, realData: T | null | undefined): T | null => {
  if (realData !== null && realData !== undefined) return realData;
  if (isDev || !isSupabaseConfigured) {
    console.warn('[DEV ONLY] Using mock data fallback');
    return mockData;
  }
  return null;
};

export const shouldLoadMockData = (): boolean => {
  return isDev || !isSupabaseConfigured;
};
