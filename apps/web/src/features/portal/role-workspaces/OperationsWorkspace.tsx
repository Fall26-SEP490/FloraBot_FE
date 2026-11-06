'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Button } from '@florabot/ui';
import { logoutSession, sessionQuery } from '@/shared/lib/api';
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
    loading: () => <p role="status">Đang tải hồ sơ thuê & lắp đặt…</p>,
  },
);

const OperationsSellers = dynamic(
  () => import('../../account-management/components/OperationsSellers'),
  {
    loading: () => <p role="status">Đang tải danh sách shop hoa…</p>,
  },
);

const ManagedCustomers = dynamic(
  () => import('../../account-management/components/ManagedCustomers'),
  {
    loading: () => <p role="status">Đang tải danh sách khách hàng…</p>,
  },
);

const AccountManagement = dynamic(() => import('../../account-management/AccountManagement'), {
  loading: () => <p role="status">Đang tải quản lý kỹ thuật viên…</p>,
});

const OperationsOverview = dynamic(() => import('../../dashboard/OperationsOverview'), {
  loading: () => <p role="status">Đang tải tổng quan vận hành…</p>,
});

const StaffTasks = dynamic(() => import('../../task-management/TaskManagement'), {
  loading: () => <p role="status">Đang tải điều phối công việc…</p>,
});
const OperationsTerminations = dynamic(() =>
  import('../../business-v2/KioskTerminations').then((mod) => mod.OperationsTerminations),
);

export default function OperationsWorkspace({ section = 'overview' }: { section?: string }) {
  const params = useSearchParams();
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
        <p role="status">Đang tải tài khoản quản lý vận hành…</p>
      </main>
    );
  if (session.isError)
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
          {session.data.role === 'OPERATIONS_MANAGER' && (
            <nav className="manager-breadcrumb" aria-label="Vị trí hiện tại">
              {section === 'overview' ? (
                <span>Điều phối vận hành</span>
              ) : (
                <Link href="/operations">Tổng quan vận hành</Link>
              )}
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
                          ? 'Điều phối công việc kỹ thuật'
                          : section === 'terminations'
                            ? 'Chấm dứt thuê kiosk'
                            : 'Tổng quan vận hành'}
              </h1>
              {section !== 'overview' && (
                <p>
                  {section === 'sellers'
                    ? 'Theo dõi shop, thông tin chủ shop và lịch sử trạng thái hoạt động.'
                    : section === 'customers'
                      ? 'Quản lý thông tin liên hệ và trạng thái tài khoản khách hàng.'
                      : section === 'technicians'
                        ? 'Quản lý đội ngũ, thông tin liên hệ và trạng thái tài khoản kỹ thuật viên.'
                        : section === 'installations'
                          ? 'Xác nhận liên hệ, xếp lịch và kiểm tra bàn giao kiosk.'
                          : section === 'tasks'
                            ? 'Phân công sự cố, điều chỉnh người phụ trách và duyệt báo cáo khắc phục.'
                            : section === 'terminations'
                              ? 'Xem xét yêu cầu và ghi nhận bàn giao kiosk.'
                              : `Chào ${session.data.name}, xem các việc cần xử lý tại đây.`}
                </p>
              )}
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
              <details className="manager-help" id="operations-guide">
                <summary>Hướng dẫn điều phối công việc kỹ thuật</summary>
                <ol>
                  <li>Chọn sự cố cần xử lý và kỹ thuật viên phụ trách.</li>
                  <li>Theo dõi tiến độ, báo cáo và ảnh hiện trường trong công việc.</li>
                  <li>Kiểm tra kết quả trước khi duyệt hoàn thành hoặc yêu cầu làm lại.</li>
                </ol>
                <p>Công việc sự cố được giới hạn theo cụm tủ phụ trách.</p>
              </details>
            </>
          )}
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
    </>
  );
}
