'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@florabot/ui';
import { logoutSession, sessionQuery } from '../../../api';
import { accountPath } from '../../../roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../../../WorkspaceNavigation';
import '../../../operations.css';
import '../../../platform/platform-workspace.css';

const OperationsInstallations = dynamic(() => import('../../../OperationsInstallations'), {
  loading: () => <p role="status">Đang tải hồ sơ thuê & lắp đặt…</p>,
});

const OperationsSellers = dynamic(() => import('../../../platform/OperationsSellers'), {
  loading: () => <p role="status">Đang tải danh sách shop hoa…</p>,
});

const ManagedCustomers = dynamic(() => import('../../../platform/ManagedCustomers'), {
  loading: () => <p role="status">Đang tải danh sách khách hàng…</p>,
});

const AccountManagement = dynamic(() => import('../../../AccountManagement'), {
  loading: () => <p role="status">Đang tải quản lý kỹ thuật viên…</p>,
});

const OperationsOverview = dynamic(() => import('../../../OperationsOverview'), {
  loading: () => <p role="status">Đang tải tổng quan vận hành…</p>,
});

const StaffTasks = dynamic(() => import('../../../StaffTasks'), {
  loading: () => <p role="status">Đang tải điều phối công việc…</p>,
});

export default function OperationsWorkspace({ section = 'overview' }: { section?: string }) {
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
      <div className="dashboard-shell operations-workspace">
        <WorkspaceNavigation
          workspaceRole={session.data.role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS_MANAGER'}
          section={section}
        />
        <main id="main" className="workspace dashboard-content">
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
                          : 'Tổng quan vận hành'}
              </h1>
              <p>
                {section === 'sellers'
                  ? 'Theo dõi shop, thông tin chủ shop và lịch sử trạng thái hoạt động.'
                  : section === 'customers'
                    ? 'Quản lý thông tin liên hệ và trạng thái tài khoản khách hàng.'
                    : section === 'technicians'
                      ? 'Quản lý đội ngũ, thông tin liên hệ và trạng thái tài khoản kỹ thuật viên.'
                      : section === 'installations'
                        ? 'Theo dõi hồ sơ từ xác nhận liên hệ, xếp lịch lắp đặt đến nghiệm thu bàn giao.'
                        : section === 'tasks'
                          ? 'Phân công sự cố, điều chỉnh người phụ trách và duyệt báo cáo khắc phục.'
                          : `Chào ${session.data.name}, cùng theo dõi hoạt động kiosk hôm nay.`}
              </p>
            </div>
            <span className="dashboard-context">
              {section === 'technicians' ? 'Kỹ thuật viên' : 'Quản lý vận hành'}
            </span>
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
              title="Quản lý Kỹ thuật viên"
              eyebrow="Vận hành kỹ thuật"
              description="Tạo tài khoản và quản lý trạng thái kỹ thuật viên phụ trách xử lý sự cố tủ hoa."
              createLabel="Thêm Kỹ thuật viên"
              itemName="kỹ thuật viên"
              apiBase="/operations/technicians"
            />
          ) : section === 'overview' ? (
            <OperationsOverview session={session.data} />
          ) : (
            <>
              <StaffTasks
                actorRole="OPERATIONS_MANAGER"
                mode="manager"
                actorId={session.data.id}
                apiBase="/operations/staff-tasks"
                directoryEndpoint="/operations/staff"
                incidentsEndpoint="/operations/incidents"
                allowedKinds={['INCIDENT']}
                canAssign
                canReassign
              />
              <section
                id="operations-guide"
                className="dashboard-staff-guide"
                tabIndex={-1}
                aria-labelledby="operations-guide-title"
              >
                <h2 id="operations-guide-title">Hướng dẫn điều phối vận hành</h2>
                <ol>
                  <li>
                    <strong>Kiểm tra sự cố mở</strong>
                    <p>Theo dõi các cảnh báo và sự cố tủ trong phạm vi phụ trách.</p>
                  </li>
                  <li>
                    <strong>Phân công kỹ thuật viên</strong>
                    <p>Giao công việc kiểm tra sự cố cho kỹ thuật viên phù hợp.</p>
                  </li>
                  <li>
                    <strong>Duyệt kết quả xử lý</strong>
                    <p>Kiểm tra báo cáo và ảnh minh chứng trước khi xác nhận hoàn thành.</p>
                  </li>
                </ol>
                <p className="dashboard-data-note">
                  Công việc sự cố được giới hạn theo cụm tủ phụ trách. Hồ sơ thuê và đội ngũ kỹ
                  thuật được quản lý theo phân quyền nền tảng.
                </p>
              </section>
            </>
          )}
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
    </>
  );
}
