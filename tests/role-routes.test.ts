import { describe, it, expect } from 'vitest';
import { accountPath, workspaceBase } from '../apps/web/src/roleRoutes';

describe('Role routes mapping unit tests', () => {
  it('maps ADMIN to /admin', () => {
    expect(accountPath('ADMIN')).toBe('/admin');
    expect(workspaceBase('ADMIN')).toBe('/admin');
  });

  it('maps OPERATIONS_MANAGER to /operations', () => {
    expect(accountPath('OPERATIONS_MANAGER')).toBe('/operations');
    expect(workspaceBase('OPERATIONS_MANAGER')).toBe('/operations');
  });

  it('maps TECHNICIAN to /technician', () => {
    expect(accountPath('TECHNICIAN')).toBe('/technician');
    expect(workspaceBase('TECHNICIAN')).toBe('/technician');
  });

  it('maps SELLER to /seller', () => {
    expect(accountPath('SELLER')).toBe('/seller');
    expect(workspaceBase('SELLER')).toBe('/seller');
  });

  it('maps SELLER_STAFF to /staff', () => {
    expect(accountPath('SELLER_STAFF')).toBe('/staff');
    expect(workspaceBase('SELLER_STAFF')).toBe('/staff');
  });

  it('maps CUSTOMER to /tai-khoan', () => {
    expect(accountPath('CUSTOMER')).toBe('/tai-khoan');
    expect(workspaceBase('CUSTOMER')).toBe('/tai-khoan');
  });

  it('maps retired STAFF to /workspace', () => {
    expect(accountPath('STAFF')).toBe('/workspace');
    expect(workspaceBase('STAFF')).toBe('/workspace');
  });

  it('maps unknown, empty or undefined role to /workspace as default-deny', () => {
    expect(accountPath('UNKNOWN_ROLE')).toBe('/workspace');
    expect(accountPath('ANONYMOUS')).toBe('/workspace');
    expect(accountPath('')).toBe('/workspace');
    expect(accountPath(undefined)).toBe('/workspace');
    expect(accountPath(null)).toBe('/workspace');
  });
});
