'use client';

import React, { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Button } from '@florabot/ui';
import { ApiError, logoutSession, sessionQuery } from '../../../api';
import { accountPath } from '../../../roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../../../WorkspaceNavigation';
import { workspaceSections } from '../../../workspaceSections';
import { startPortalUpdates } from '../../../realtime';
import '../workspace-styles.css';
import '../../../dashboard-overview.css';
import '../../../platform/platform-workspace.css';
import '../../../platform/platform-refresh.css';

const DashboardOverview = dynamic(() => import('../../../DashboardOverview'), {
  loading: () => <p role="status">Đang tải tổng quan hệ thống…</p>,
});

const WebRequests = dynamic(() => import('../../orders/WebRequests'), {
  loading: () => <p role="status">Đang tải danh sách đơn hàng…</p>,
});

const AccountManagement = dynamic(() => import('../../../AccountManagement'), {
  loading: () => <p role="status">Đang tải quản lý nhân sự…</p>,
});

const AdminAccounts = dynamic(() => import('../../../platform/AdminAccounts'), {
  loading: () => <p role="status">Đang tải tài khoản quản trị…</p>,
});

const AdminSellers = dynamic(() => import('../../../AdminSellers'), {
  loading: () => <p role="status">Đang tải danh sách shop hoa…</p>,
});

const StaffTasks = dynamic(() => import('../../../StaffTasks'), {
  loading: () => <p role="status">Đang tải danh sách công việc…</p>,
});

const AdminSlots = dynamic(() => import('../../kiosk-management/AdminSlots'), {
  loading: () => <p role="status">Đang tải quản lý ô tủ…</p>,
});

const AdminIncidents = dynamic(() => import('../../../AdminIncidents'), {
  loading: () => <p role="status">Đang tải danh sách sự cố…</p>,
});

const AdminComplaints = dynamic(() => import('../../../AdminComplaints'), {
  loading: () => <p role="status">Đang tải khiếu nại…</p>,
});

const AdminRefunds = dynamic(() => import('../../../AdminRefunds'), {
  loading: () => <p role="status">Đang tải hoàn tiền…</p>,
});

const AdminKioskRefunds = dynamic(() => import('../../../AdminKioskRefunds'), {
  loading: () => <p role="status">Đang tải hoàn tiền kiosk…</p>,
});

const AdminWithdrawals = dynamic(() => import('../../../AdminWithdrawals'), {
  loading: () => <p role="status">Đang tải yêu cầu rút tiền…</p>,
});

const AdminReconciliation = dynamic(() => import('../../../AdminReconciliation'), {
  loading: () => <p role="status">Đang tải đối soát…</p>,
});

const AdminReports = dynamic(() => import('../../../AdminReports'), {
  loading: () => <p role="status">Đang tải báo cáo tổng quan…</p>,
});

function PortalUpdates() {
  useEffect(startPortalUpdates, []);
  return null;
}

export default function AdminWorkspace({ section = 'overview' }: { section?: string }) {
  const { t } = useTranslation();
  const session = useQuery({ ...sessionQuery, refetchInterval: 60_000 });
  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      window.location.replace('/admin/login');
    },
  });
  if (session.isPending)
    return (
      <main id="main">
        <p role="status">{t('loading')}</p>
      </main>
    );
  if (session.isError)
    return (
      <main id="main">
        <h1>Không tải được phiên làm việc</h1>
        <p role="alert">
          {session.error instanceof ApiError
            ? session.error.message
            : 'Kiểm tra kết nối rồi thử lại.'}
        </p>
        <Button onClick={() => void session.refetch()}>{t('retry')}</Button>{' '}
        <Link href="/admin/login">Về đăng nhập</Link>
      </main>
    );
  if (session.data.role !== 'ADMIN')
    return (
      <main id="main">
        <h1>Bạn không có quyền vào khu vực này</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="ADMIN"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell">
        <WorkspaceNavigation key={section} workspaceRole="ADMIN" section={section} />
        <main id="main" className="workspace dashboard-content">
          <PortalUpdates />
          <div className="dashboard-page-heading">
            <div>
              <h1>
                {section === 'overview'
                  ? t('welcome', { name: session.data.name })
                  : workspaceSections['ADMIN'].find(([key]) => key === section)?.[1]}
              </h1>
              <p>
                {section === 'overview'
                  ? 'Tình hình vận hành và các việc cần bạn xử lý.'
                  : workspaceSections['ADMIN'].find(([key]) => key === section)?.[2]}
              </p>
            </div>
            <span className="dashboard-context">
              {section === 'overview'
                ? 'Tổng quan'
                : workspaceSections['ADMIN']?.find(([key]) => key === section)?.[1] || 'Hệ thống'}
            </span>
          </div>
          {section === 'overview' && (
            <>
              <DashboardOverview session={session.data} />
              <details className="workspace-profile">
                <summary>Thông tin tài khoản và quyền truy cập</summary>
                <dl className="account-details">
                  <div>
                    <dt>Tài khoản</dt>
                    <dd>{session.data.name}</dd>
                  </div>
                  <div>
                    <dt>Vai trò</dt>
                    <dd>Quản trị viên</dd>
                  </div>
                </dl>
              </details>
            </>
          )}
          {section === 'orders' && <WebRequests mode="admin" />}
          {section === 'managers' && (
            <AccountManagement
              actorRole="ADMIN"
              targetRole="OPERATIONS_MANAGER"
              title="Đội ngũ quản lý vận hành"
              eyebrow="Quản trị hệ thống"
              description="Tạo tài khoản và quản lý trạng thái hoạt động của Quản lý vận hành."
              createLabel="Thêm Quản lý vận hành"
              itemName="Quản lý vận hành"
              apiBase="/admin/managers"
            />
          )}
          {section === 'accounts' && <AdminAccounts key={session.data.id} session={session.data} />}
          {section === 'shops' && <AdminSellers />}
          {section === 'tasks' && (
            <StaffTasks
              actorRole="ADMIN"
              mode="oversight"
              actorId={session.data.id}
              apiBase="/admin/staff-tasks"
              readOnly
              canAssign={false}
              canReassign={false}
            />
          )}
          {section === 'slots' && <AdminSlots />}
          {section === 'incidents' && <AdminIncidents />}
          {section === 'complaints' && <AdminComplaints />}
          {section === 'refunds' && <AdminRefunds />}
          {section === 'kiosk-refunds' && (
            <AdminKioskRefunds
              key={`${session.data.id}:${session.data.role}`}
              session={session.data}
            />
          )}
          {section === 'withdrawals' && <AdminWithdrawals />}
          {section === 'reconciliation' && <AdminReconciliation />}
          {section === 'reports' && <AdminReports session={session.data} />}
          {logout.isError && (
            <p role="alert" className="error">
              Chưa đăng xuất được. Bạn thử lại nhé.
            </p>
          )}
        </main>
      </div>
    </>
  );
}
