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
