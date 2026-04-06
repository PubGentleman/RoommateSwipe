import { Platform } from 'react-native';
import { captureError } from '../lib/sentry';

type ErrorContext = {
  service: string;
  method: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export function logError(error: unknown, context: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error(`[${context.service}.${context.method}]`, errorMessage);

  captureError(error, context);
}

export function createErrorHandler(service: string, method: string) {
  return (error: unknown) => logError(error, { service, method });
}
