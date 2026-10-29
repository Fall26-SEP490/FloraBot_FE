import { ApiError, request } from '@/shared/lib/api';
import { maskProfile, type ProfileResponse } from './profile.utils';
import type { ContactEmailChallenge, UpdateProfilePayload } from './profile.types';

export const getAccountProfile = async () =>
  maskProfile(await request<ProfileResponse>('/account/profile'));

export const updateAccountProfile = async (payload: UpdateProfilePayload) =>
  maskProfile(await request<ProfileResponse>('/account/profile', payload, true, 'PUT'));

export const requestContactEmailChallenge = (email: string) =>
  request<ContactEmailChallenge>('/account/contact-email', { email });

export const verifyContactEmail = async (challengeId: string, code: string) =>
  maskProfile(
    await request<ProfileResponse>('/account/contact-email/verify', { challengeId, code }),
  );

export const resetContactEmail = async () =>
  maskProfile(await request<ProfileResponse>('/account/contact-email/reset', {}));

export const revealBank = async () => {
  // Explicit, audited read outside React Query; the standalone POST is legacy.
  const profile = await request<ProfileResponse>('/account/profile');
  if (!profile.bank?.accountNumber || profile.bank.status === 'NEEDS_UPDATE') {
    throw new ApiError(404, 'Chưa đọc được số tài khoản. Vui lòng cập nhật thông tin ngân hàng.');
  }
  return { accountNumber: profile.bank.accountNumber };
};
