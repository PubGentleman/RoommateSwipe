import { isDev } from './envUtils';

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log('[Roomdr]', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('[Roomdr]', ...args);
  },
  error: (...args: any[]) => {
    if (isDev) console.error('[Roomdr]', ...args);
  },
  dev: (...args: any[]) => {
    if (isDev) console.log('[DEV]', ...args);
  },
};
