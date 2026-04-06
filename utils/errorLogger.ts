import { Platform } from 'react-native';

type ErrorContext = {
  service: string;
  method: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export function logError(error: unknown, context: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    `[${context.service}.${context.method}]`,
    errorMessage,
    {
      ...context,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      stack: errorStack,
    }
  );
}

export function createErrorHandler(service: string, method: string) {
  return (error: unknown) => logError(error, { service, method });
}
