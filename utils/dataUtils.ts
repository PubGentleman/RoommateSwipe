const isDevelopment = process.env.EXPO_PUBLIC_ENV !== 'production';

export const isDev = (): boolean => isDevelopment;

export const getMockFallback = <T>(mockData: T, realData: T | null | undefined): T | null => {
  if (realData !== null && realData !== undefined) return realData;
  if (isDevelopment) {
    console.warn('[DEV ONLY] Using mock data fallback');
    return mockData;
  }
  return null;
};

export const shouldLoadMockData = (): boolean => {
  return isDevelopment;
};
