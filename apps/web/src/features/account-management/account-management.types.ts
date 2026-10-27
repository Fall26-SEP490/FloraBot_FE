import type { components } from '../../../../../packages/contracts/src/generated/api';

export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';
export type AccountRole = 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER_STAFF';

export interface AccountDirectoryItem {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: AccountStatus;
  role: string;
  createdAt: string;
}

export interface AccountManagementProps {
  actorRole: 'ADMIN' | 'OPERATIONS_MANAGER' | 'SELLER';
  targetRole: AccountRole;
  title: string;
  eyebrow: string;
  description: string;
  createLabel: string;
  itemName: string;
  apiBase: string;
  listEndpoint?: string;
  sellerId?: string | null;
}

export type Profile = components['schemas']['AccountDetailResponse'];
export type ProfileInput = components['schemas']['UpdateAccountProfileRequest'];
export type AdminAccountSummary = components['schemas']['AdminAccountSummary'];
export type AdminAccountProfileResponse = components['schemas']['AdminAccountProfileResponse'];
export type OperationsSellerSummary = components['schemas']['OperationsSellerSummary'];
export type OperationsSellerDetail = components['schemas']['OperationsSellerDetail'];
export type SellerAccountResponse = components['schemas']['SellerAccountResponse'];
export type SellerStatusHistoryResponse = components['schemas']['SellerStatusHistoryResponse'];
