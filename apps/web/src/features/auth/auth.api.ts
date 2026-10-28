import {
  request,
  type Session,
  type AuthConfig,
  type RegisterPendingResponse,
} from '@/shared/lib/api';

export function fetchAuthConfig(): Promise<AuthConfig> {
  return request<AuthConfig>('/auth/config');
}

export function loginWithEmail(payload: { email: string; password: string }): Promise<Session> {
  return request<Session>('/auth/login', payload);
}

export function loginWithGoogle(payload: { idToken: string }): Promise<Session> {
  return request<Session>('/auth/google', payload);
}

export function registerWithEmail(payload: {
  fullName: string;
  email: string;
  password: string;
}): Promise<RegisterPendingResponse> {
  return request<RegisterPendingResponse>('/auth/register', payload);
}

export function verifyRegistrationOtp(payload: {
  challengeId: string;
  code: string;
}): Promise<Session> {
  return request<Session>('/auth/register/verify', payload);
}

export function requestPasswordReset(payload: { email: string }): Promise<void> {
  return request<void>('/auth/forgot-password', payload);
}

export function confirmPasswordReset(payload: {
  token: string;
  newPassword: string;
}): Promise<void> {
  return request<void>('/auth/reset-password', payload);
}

export function linkGoogleAccount(payload: { idToken: string }): Promise<{ message: string }> {
  return request<{ message: string }>('/member/google/link', payload);
}
