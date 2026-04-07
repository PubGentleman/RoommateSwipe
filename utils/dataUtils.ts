import { isDev } from './envUtils';
import { isSupabaseConfigured } from '../lib/supabase';
import { BETA_MODE } from '../constants/betaConfig';

export { isDev } from './envUtils';

export const getMockFallback = <T>(mockData: T, realData: T | null | undefined): T | null => {
  if (realData !== null && realData !== undefined) return realData;
  if (isDev || BETA_MODE || !isSupabaseConfigured) {
    console.warn('[DEV/BETA] Using mock data fallback');
    return mockData;
  }
  return null;
};

export const shouldLoadMockData = (): boolean => {
  return isDev || BETA_MODE || !isSupabaseConfigured;
};
