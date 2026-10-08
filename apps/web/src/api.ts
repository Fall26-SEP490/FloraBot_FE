import { QueryClient } from '@tanstack/react-query';
import type { components } from '../../../packages/contracts/src/generated/api';

export type Session = components['schemas']['SessionResponse'];
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});
let refresh: Promise<boolean> | undefined;

export async function request<T>(path: string, body?: unknown, retry = true): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (
    response.status === 401 &&
    retry &&
    !['/auth/login', '/auth/admin/login', '/auth/logout'].includes(path)
  ) {
    // A rotating refresh token must be consumed once even when several queries expire together.
    refresh ??= fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(15_000),
    })
      .then((result) => result.ok)
      .finally(() => {
        refresh = undefined;
      });
    if (await refresh) return request<T>(path, body, false);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new ApiError(
      response.status,
      problem.detail ||
        (response.status === 401
          ? 'Email hoặc mật khẩu chưa đúng, hoặc phiên đã hết hạn.'
          : response.status === 429
            ? 'Bạn thao tác hơi nhanh. Hãy thử lại sau một phút.'
            : 'Chưa xử lý được yêu cầu. Bạn thử lại nhé.'),
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
export const sessionQuery = {
  queryKey: ['session'],
  queryFn: () => request<Session>('/auth/me'),
  staleTime: 0,
};
