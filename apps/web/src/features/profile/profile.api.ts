import { request } from '../../api';
import type {
  AccountProfile,
  BankRevealResponse,
  ContactEmailChallenge,
  UpdateProfilePayload,
} from './profile.types';

export const getAccountProfile = () => request<AccountProfile>('/account/profile');

export const updateAccountProfile = (payload: UpdateProfilePayload) =>
  request<AccountProfile>('/account/profile', payload, true, 'PUT');

export const requestContactEmailChallenge = (email: string) =>
  request<ContactEmailChallenge>('/account/contact-email', { email });

export const verifyContactEmail = (challengeId: string, code: string) =>
  request<AccountProfile>('/account/contact-email/verify', { challengeId, code });

export const resetContactEmail = () => request<AccountProfile>('/account/contact-email/reset', {});

export const revealBank = () => request<BankRevealResponse>('/account/profile/bank/reveal', {});
