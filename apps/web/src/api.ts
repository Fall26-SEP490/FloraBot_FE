import { QueryClient } from '@tanstack/react-query';
import type { components } from '../../../packages/contracts/src/generated/api';

export type Session = components['schemas']['SessionResponse'];

export interface AuthConfig {
  googleClientId: string | null;
  googleEnabled: boolean;
  registrationEmailEnabled: boolean;
}

export interface RegisterPendingResponse {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  message?: string;
}

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
let logoutRequest: Promise<void> | undefined;

export async function request<T>(
  path: string,
  body?: unknown,
  retry = true,
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
): Promise<T> {
  const resolvedMethod = method ?? (body === undefined ? 'GET' : 'POST');
  const response = await fetch(`/api${path}`, {
    method: resolvedMethod,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const anonymousAuthPaths = [
    '/auth/login',
    '/auth/admin/login',
    '/auth/logout',
    '/auth/google',
    '/auth/register',
    '/auth/register/verify',
    '/auth/config',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  if (response.status === 401 && retry && !logoutRequest && !anonymousAuthPaths.includes(path)) {
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
    if (await refresh) return request<T>(path, body, false, resolvedMethod);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
      message?: string;
    };
    const default401 =
      path === '/auth/google'
        ? 'Tài khoản Google không hợp lệ hoặc phiên ủy quyền bị từ chối. Vui lòng thử lại.'
        : 'Email hoặc mật khẩu chưa đúng, hoặc phiên đã hết hạn.';
    const default403 =
      path === '/auth/google'
        ? 'Đăng nhập Google chưa được cho phép cho địa chỉ trang hiện tại. Hãy dùng email hoặc liên hệ hỗ trợ.'
        : 'Yêu cầu bị từ chối. Hãy tải lại trang; nếu lỗi còn tiếp diễn, liên hệ hỗ trợ.';
    throw new ApiError(
      response.status,
      problem.detail ||
        problem.error ||
        problem.message ||
        (response.status === 401
          ? default401
          : response.status === 403
            ? default403
            : response.status === 429
              ? 'Bạn thao tác hơi nhanh. Hãy thử lại sau một phút.'
              : 'Chưa xử lý được yêu cầu. Bạn thử lại nhé.'),
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export function logoutSession(): Promise<void> {
  logoutRequest ??= (async () => {
    // Do not wait here: some query functions do not consume React Query's abort signal,
    // so awaiting cancellation can leave the logout button stuck in its busy state.
    void queryClient.cancelQueries();

    // Wait for token rotation that started before logout, then revoke the newest token.
    const pendingRefresh = refresh;
    if (pendingRefresh) await pendingRefresh.catch(() => false);

    await request<void>('/auth/logout', {}, false);
    queryClient.clear();
  })().finally(() => {
    logoutRequest = undefined;
  });

  return logoutRequest;
}
export interface PersonalBankInfo {
  bankName: string;
  accountHolder: string;
  accountLast4: string;
  hasAccount: boolean;
}

export interface AccountProfile {
  id: string;
  fullName: string;
  loginEmail: string | null;
  phone: string | null;
  address: string | null;
  contactEmail: string | null;
  contactEmailIsDefault: boolean;
  contactEmailVerified: boolean;
  bank: PersonalBankInfo | null;
}

export interface UpdateProfilePayload {
  fullName: string;
  phone: string | null;
  address: string | null;
  bank?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
  } | null;
  clearBank?: boolean;
}

export interface BankRevealResponse {
  accountNumber: string;
}

export interface ContactEmailChallenge {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  message?: string;
}

export interface VerifyContactEmailPayload {
  challengeId: string;
  code: string;
}

export const sessionQuery = {
  queryKey: ['session'],
  queryFn: () => request<Session>('/auth/me'),
  staleTime: 30_000,
};

export const profileQuery = {
  queryKey: ['account-profile'],
  queryFn: () => request<AccountProfile>('/account/profile'),
  staleTime: 30_000,
};
