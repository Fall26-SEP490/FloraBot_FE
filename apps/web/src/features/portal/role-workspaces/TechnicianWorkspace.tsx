'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@florabot/ui';
import { logoutSession, sessionQuery } from '@/shared/lib/api';
import { accountPath } from '@/features/portal/config/roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../components/WorkspaceNavigation';
import '../workspace-styles.css';
import '../../account-management/styles/platform-workspace.css';
import '../../account-management/styles/platform-refresh.css';
import '../styles/technician-usability.css';

const TechnicianInstallations = dynamic(
  () => import('../../installations/TechnicianInstallations'),
  {
    loading: () => <p role="status">Đang tải hồ sơ lắp đặt…</p>,
  },
);

const StaffTasks = dynamic(() => import('../../task-management/TaskManagement'), {
  loading: () => <p role="status">Đang tải công việc kỹ thuật…</p>,
});

export default function TechnicianWorkspace({ section = 'tasks' }: { section?: string }) {
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
        <p role="status">Đang tải tài khoản kỹ thuật viên…</p>
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
  if (session.data.role !== 'TECHNICIAN')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="TECHNICIAN"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell technician-workspace">
        <WorkspaceNavigation workspaceRole="TECHNICIAN" section={section} />
        <main id="main" className="workspace dashboard-content">
          {section === 'installations' ? (
            <TechnicianInstallations
              key={`${session.data.id}:${session.data.role}`}
              session={session.data}
            />
          ) : (
            <>
              <div className="dashboard-page-heading">
                <div>
                  <h1>Công việc kỹ thuật</h1>
                  <p>Xem sự cố được giao và cập nhật kết quả xử lý.</p>
                </div>
              </div>
              <StaffTasks
                actorRole="TECHNICIAN"
                mode="worker"
                actorId={session.data.id}
                apiBase="/staff/tasks"
                allowedKinds={['INCIDENT']}
              />
              <details className="technician-help">
                <summary>Cách xử lý một sự cố</summary>
                <ol>
                  <li>Xem địa chỉ, hướng dẫn và thông tin sự cố.</li>
                  <li>Bắt đầu công việc khi đến tủ, kiểm tra và tải ảnh minh chứng.</li>
                  <li>Ghi nhận kết quả xử lý và gửi báo cáo cho Quản lý vận hành.</li>
                </ol>
                <p>
                  Việc lắp đặt kiosk nằm trong mục Lắp đặt Kiosk. Nạp hoa do nhân viên shop phụ
                  trách.
                </p>
              </details>
            </>
          )}
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
    </>
  );
}
