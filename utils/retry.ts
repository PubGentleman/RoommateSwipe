type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  shouldRetry: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as Record<string, unknown>).status;
      if (typeof status === 'number' && status >= 400 && status < 500) return false;
    }
    return true;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      const baseDelay = opts.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * opts.baseDelayMs;
      const delayMs = Math.min(baseDelay + jitter, opts.maxDelayMs);

      console.warn(
        `[retry] Attempt ${attempt + 1}/${opts.maxRetries} failed, retrying in ${Math.round(delayMs)}ms:`,
        error instanceof Error ? error.message : error
      );

      await delay(delayMs);
    }
  }

  throw lastError;
}
