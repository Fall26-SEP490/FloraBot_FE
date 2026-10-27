'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { PortalScreen } from './portal.types';
import { PortalGuard } from './PortalGuard';

const AdminLoginScreen = dynamic(() => import('./screens/AdminLoginScreen'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải đăng nhập vận hành…</p>
    </main>
  ),
});

const Receipt = dynamic(() => import('../receipts/Receipt'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải biên nhận…</p>
    </main>
  ),
});

const GuestHistory = dynamic(() => import('../receipts/GuestHistory'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải lịch sử mua hàng…</p>
    </main>
  ),
});

const MemberAuth = dynamic(() => import('../auth/MemberAuth'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải xác thực tài khoản…</p>
    </main>
  ),
});

const FlowerShop = dynamic(() => import('../catalog/FlowerShop'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải cửa hàng hoa…</p>
    </main>
  ),
});

const WorkspaceAccount = dynamic(() => import('./WorkspaceAccount'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải tài khoản…</p>
    </main>
  ),
});

const SellerWorkspace = dynamic(() => import('./role-workspaces/SellerWorkspace'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải khu vực chủ shop…</p>
    </main>
  ),
});

const AdminWorkspace = dynamic(() => import('./role-workspaces/AdminWorkspace'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải khu vực quản trị…</p>
    </main>
  ),
});

const OperationsWorkspace = dynamic(() => import('./role-workspaces/OperationsWorkspace'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải khu vực quản lý vận hành…</p>
    </main>
  ),
});

const StaffWorkspace = dynamic(() => import('./role-workspaces/StaffWorkspace'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải tài khoản nhân viên shop…</p>
    </main>
  ),
});

const TechnicianWorkspace = dynamic(() => import('./role-workspaces/TechnicianWorkspace'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải tài khoản kỹ thuật viên…</p>
    </main>
  ),
});

const CustomerWorkspace = dynamic(() => import('./role-workspaces/CustomerWorkspace'), {
  loading: () => (
    <main id="main">
      <p role="status">Đang tải thông tin…</p>
    </main>
  ),
});

export function PortalScreenRouter({
  screen,
  section,
}: {
  screen: PortalScreen;
  section?: string;
}) {
  switch (screen) {
    case 'admin-login':
      return <AdminLoginScreen />;
    case 'receipt':
      return <Receipt />;
    case 'guest-history':
      return <GuestHistory />;
    case 'login':
      return <MemberAuth mode="login" />;
    case 'register':
      return <MemberAuth mode="register" />;
    case 'forgot':
      return <MemberAuth mode="forgot" />;
    case 'reset':
      return <MemberAuth mode="reset" />;
    case 'member':
      return (
        <div className="workspace-portal-root">
          <PortalGuard requiredRole="CUSTOMER">
            <CustomerWorkspace screen="member" />
          </PortalGuard>
        </div>
      );
    case 'profile':
      return (
        <div className="workspace-portal-root">
          <CustomerWorkspace screen="profile" />
        </div>
      );
    case 'shop':
      return <FlowerShop />;
    case 'seller':
      return (
        <div className="workspace-portal-root">
          <PortalGuard requiredRole="SELLER">
            <SellerWorkspace section={section} />
          </PortalGuard>
        </div>
      );
    case 'admin':
      return (
        <div className="workspace-portal-root platform-workspace" data-platform-role="admin">
          <PortalGuard requiredRole="ADMIN">
            <AdminWorkspace section={section} />
          </PortalGuard>
        </div>
      );
    case 'staff':
      return (
        <div className="workspace-portal-root">
          <PortalGuard requiredRole="SELLER_STAFF">
            <StaffWorkspace section={section} />
          </PortalGuard>
        </div>
      );
    case 'technician':
      return (
        <div className="workspace-portal-root platform-workspace" data-platform-role="technician">
          <PortalGuard requiredRole="TECHNICIAN">
            <TechnicianWorkspace />
          </PortalGuard>
        </div>
      );
    case 'technician-installations':
      return (
        <div className="workspace-portal-root platform-workspace" data-platform-role="technician">
          <PortalGuard requiredRole="TECHNICIAN">
            <TechnicianWorkspace section="installations" />
          </PortalGuard>
        </div>
      );
    case 'operations':
      return (
        <div className="workspace-portal-root platform-workspace" data-platform-role="operations">
          <PortalGuard requiredRole="OPERATIONS_MANAGER">
            <OperationsWorkspace section={section} />
          </PortalGuard>
        </div>
      );
    case 'workspace':
      return (
        <div className="workspace-portal-root">
          <WorkspaceAccount />
        </div>
      );
    case 'thue-kiosk':
      return (
        <div className="workspace-portal-root">
          <PortalGuard requiredRole="CUSTOMER">
            <CustomerWorkspace screen="thue-kiosk" />
          </PortalGuard>
        </div>
      );
  }
}
