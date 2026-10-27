import { request } from '../../api';
import type { AccountDirectoryItem, Profile, ProfileInput } from './account-management.types';

export const accountManagementApi = {
  fetchDirectory: (url: string) => request<AccountDirectoryItem[]>(url),
  createAccount: (apiBase: string, body: Record<string, unknown>) =>
    request(apiBase, { method: 'POST', body: JSON.stringify(body) }),
  updateStatus: (apiBase: string, accountId: string, status: string) =>
    request(`${apiBase}/${accountId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  resetPassword: (apiBase: string, accountId: string) =>
    request(`${apiBase}/${accountId}/reset-password`, { method: 'POST' }),
  deleteAccount: (apiBase: string, accountId: string) =>
    request(`${apiBase}/${accountId}`, { method: 'DELETE' }),
  fetchProfile: (endpoint: string) => request<Profile>(endpoint),
  updateProfile: (endpoint: string, data: ProfileInput) =>
    request<Profile>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
};
