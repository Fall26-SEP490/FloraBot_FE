/**
 * Single source of truth for platform role-to-route path mappings.
 * Independent of React or UI frameworks to avoid bundle leakage or circular imports.
 */

export type PlatformRole =
  | 'ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'TECHNICIAN'
  | 'SELLER'
  | 'SELLER_STAFF'
  | 'CUSTOMER'
  | 'STAFF'
  | string;

export function accountPath(role?: PlatformRole | null): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'OPERATIONS_MANAGER':
      return '/operations';
    case 'TECHNICIAN':
      return '/technician';
    case 'SELLER':
      return '/seller';
    case 'SELLER_STAFF':
      return '/staff';
    case 'CUSTOMER':
      return '/tai-khoan';
    case 'STAFF':
    default:
      return '/workspace';
  }
}

export const workspaceBase = accountPath;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  OPERATIONS_MANAGER: 'Quản lý vận hành',
  TECHNICIAN: 'Kỹ thuật viên',
  SELLER: 'Chủ shop',
  SELLER_STAFF: 'Nhân viên shop',
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên FloraBot (cũ)',
};

export const getRoleLabel = (role: string): string => ROLE_LABELS[role] ?? role;

export const isDedicatedWorkspaceRole = (role: string): boolean =>
  role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN' || role === 'SELLER_STAFF';

export const isExistingFullPortalRole = (role: string): boolean =>
  role === 'ADMIN' ||
  role === 'OPERATIONS_MANAGER' ||
  role === 'TECHNICIAN' ||
  role === 'SELLER' ||
  role === 'SELLER_STAFF' ||
  role === 'CUSTOMER';

export const isPlatformOperatorRole = (role: string): boolean =>
  role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN' || role === 'ADMIN' || role === 'STAFF';
