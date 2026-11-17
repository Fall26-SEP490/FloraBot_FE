import { ApiError } from '@/shared/lib/api';

/** A transport error or stale target does not establish whether a write committed. */
export function requiresOutcomeCheck(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500 || [404, 409].includes(error.status);
}
