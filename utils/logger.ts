import { isDev } from './envUtils';

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log('[Rhome]', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('[Rhome]', ...args);
  },
  error: (...args: any[]) => {
    if (isDev) console.error('[Rhome]', ...args);
  },
  dev: (...args: any[]) => {
    if (isDev) console.log('[DEV]', ...args);
  },
};
