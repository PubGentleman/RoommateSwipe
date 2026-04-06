export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err<T>(error: string, code?: string): Result<T> {
  return { success: false, error, code };
}

export function isOk<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success;
}
