'use client';
import { WorkspaceSectionSkeleton } from '@/shared/components/PageSkeleton';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Button } from '@florabot/ui';
import { isTransientSessionError, logoutSession, sessionQuery } from '@/shared/lib/api';
import { accountPath } from '@/features/portal/config/roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../components/WorkspaceNavigation';
import '../workspace-styles.css';
import '../../dashboard/styles/dashboard-overview.css';
import '../styles/operations.css';
import '../../account-management/styles/platform-workspace.css';
import '../../account-management/styles/platform-refresh.css';
import '../styles/manager-usability.css';

const OperationsInstallations = dynamic(
  () => import('../../installations/OperationsInstallations'),
  {
    loading: () => <WorkspaceSectionSkeleton />,
  },
);

const OperationsSellers = dynamic(
  () => import('../../account-management/components/OperationsSellers'),
  {
    loading: () => <WorkspaceSectionSkeleton />,
  },
);

const ManagedCustomers = dynamic(
  () => import('../../account-management/components/ManagedCustomers'),
  {
    loading: () => <WorkspaceSectionSkeleton />,
  },
);

const AccountManagement = dynamic(() => import('../../account-management/AccountManagement'), {
  loading: () => <WorkspaceSectionSkeleton />,
});

const OperationsOverview = dynamic(() => import('../../dashboard/OperationsOverview'), {
  loading: () => <WorkspaceSectionSkeleton />,
});

const StaffTasks = dynamic(() => import('../../task-management/TaskManagement'), {
  loading: () => <WorkspaceSectionSkeleton />,
});
const OperationsTerminations = dynamic(() =>
  import('../../kiosk-management/KioskTerminations').then((mod) => mod.OperationsTerminations),
);
const OperationsMaintenanceRecovery = dynamic(
  () => import('../../kiosk-management/OperationsMaintenanceRecovery'),
  { loading: () => <WorkspaceSectionSkeleton /> },
);

export default function OperationsWorkspace({ section = 'overview' }: { section?: string }) {
  const params = useSearchParams();
  const session = useQuery(sessionQuery);
  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      window.location.replace('/admin/login');
    },
  });
  if (session.isPending)
    return (
      <main id="main">
        <p role="status">Đang tải tài khoản quản lý vận hành…</p>
      </main>
    );
  if (!session.data || (session.isError && !isTransientSessionError(session.error)))
    return (
      <main id="main" className="workspace">
        <h1>Không tải được phiên làm việc</h1>
        <p role="alert">Kiểm tra kết nối hoặc đăng nhập lại để tiếp tục.</p>
        <Button onClick={() => void session.refetch()}>Thử lại</Button>{' '}
        <Link href="/admin/login">Về đăng nhập vận hành</Link>
      </main>
    );
  if (session.data.role !== 'OPERATIONS_MANAGER' && session.data.role !== 'ADMIN')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole={session.data.role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS_MANAGER'}
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div
        className={`dashboard-shell operations-workspace ${session.data.role === 'OPERATIONS_MANAGER' ? 'manager-workspace' : ''}`}
      >
        <WorkspaceNavigation
          workspaceRole={session.data.role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS_MANAGER'}
          section={section}
        />
        <main id="main" className="workspace dashboard-content">
          {session.data.role === 'OPERATIONS_MANAGER' && section !== 'overview' && (
            <nav className="manager-breadcrumb" aria-label="Vị trí hiện tại">
              <Link href="/operations">Tổng quan vận hành</Link>
            </nav>
          )}
          <div className="dashboard-page-heading">
            <div>
              <h1>
                {section === 'sellers'
                  ? 'Quản lý shop hoa'
                  : section === 'customers'
                    ? 'Quản lý khách hàng'
                    : section === 'technicians'
                      ? 'Quản lý kỹ thuật viên'
                      : section === 'installations'
                        ? 'Hồ sơ thuê & lắp đặt'
                        : section === 'tasks'
                          ? 'Sự cố & công việc'
                          : section === 'terminations'
                            ? 'Chấm dứt thuê kiosk'
                            : section === 'maintenance-recovery'
                              ? 'Khôi phục phiên thao tác'
                              : 'Tổng quan vận hành'}
              </h1>
            </div>
          </div>
          {section === 'installations' ? (
            <OperationsInstallations
              key={`${session.data.id}:${session.data.role}`}
              session={session.data}
            />
          ) : session.data.role === 'ADMIN' && section !== 'overview' ? (
            <p role="status">
              Các thao tác điều phối và quản lý kỹ thuật viên dành cho Quản lý vận hành.{' '}
              <Link href="/operations/installations">Xem hồ sơ lắp đặt ở chế độ giám sát</Link>.
            </p>
          ) : section === 'sellers' ? (
            <OperationsSellers key={session.data.id} session={session.data} />
          ) : section === 'customers' ? (
            <ManagedCustomers key={session.data.id} session={session.data} />
          ) : section === 'technicians' ? (
            <AccountManagement
              actorRole="OPERATIONS_MANAGER"
              targetRole="TECHNICIAN"
              title="Danh sách kỹ thuật viên"
              eyebrow="Vận hành kỹ thuật"
              description="Tạo tài khoản và quản lý trạng thái kỹ thuật viên phụ trách xử lý sự cố tủ hoa."
              createLabel="Thêm Kỹ thuật viên"
              itemName="kỹ thuật viên"
              apiBase="/operations/technicians"
            />
          ) : section === 'terminations' ? (
            <OperationsTerminations />
          ) : section === 'maintenance-recovery' ? (
            <OperationsMaintenanceRecovery key={session.data.id} managerId={session.data.id} />
          ) : section === 'overview' ? (
            <OperationsOverview session={session.data} />
          ) : (
            <>
              <StaffTasks
                actorRole="OPERATIONS_MANAGER"
                initialStatus={params.get('status') ?? undefined}
                mode="manager"
                actorId={session.data.id}
                apiBase="/operations/staff-tasks"
                directoryEndpoint="/operations/staff"
                incidentsEndpoint="/operations/incidents"
                allowedKinds={['INCIDENT']}
                canAssign
                canReassign
              />
            </>
          )}
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
    </>
  );
}
