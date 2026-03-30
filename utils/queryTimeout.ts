export function withTimeout<T>(promise: Promise<T>, ms: number = 10000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}
