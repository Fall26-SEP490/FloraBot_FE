import { request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { Profile } from './customer-account.types';

export const fetchMemberProfile = () => request<Profile>('/member/profile');

export const changeMemberPassword = (body: unknown) => request('/member/password', body);

export const fetchMemberHistory = (page: number) =>
  request<components['schemas']['CustomerHistoryPage']>(`/member/history?page=${page}`);
