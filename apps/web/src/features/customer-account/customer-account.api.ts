import { request } from '../../api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { Profile } from './customer-account.types';

export const fetchMemberProfile = () => request<Profile>('/member/profile');

export const updateMemberProfile = (data: { fullName: string }) =>
  request('/member/profile', { fullName: data.fullName.trim() });

export const changeMemberPassword = (body: unknown) => request('/member/password', body);

export const fetchMemberHistory = (page: number) =>
  request<components['schemas']['CustomerHistoryPage']>(`/member/history?page=${page}`);
