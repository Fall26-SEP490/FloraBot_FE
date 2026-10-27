'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@florabot/ui';
import { logoutSession, sessionQuery } from '../../../api';
import { accountPath } from '../../../roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../../../WorkspaceNavigation';
import '../workspace-styles.css';
import '../../../platform/platform-workspace.css';
import '../../../platform/platform-refresh.css';
import WorkspaceWelcome from '../../../platform/WorkspaceWelcome';

const TechnicianInstallations = dynamic(() => import('../../../TechnicianInstallations'), {
  loading: () => <p role="status">Đang tải hồ sơ lắp đặt…</p>,
});

const StaffTasks = dynamic(() => import('../../../StaffTasks'), {
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
      <div className="dashboard-shell">
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
                  <h1>Chào {session.data.name}</h1>
                  <p>Nhận việc kiểm tra sự cố, cập nhật tiến độ và gửi báo cáo tại tủ.</p>
                </div>
                <span className="dashboard-context">Kỹ thuật viên</span>
              </div>
              <WorkspaceWelcome workspaceRole="technician" />
              <StaffTasks
                actorRole="TECHNICIAN"
                mode="worker"
                actorId={session.data.id}
                apiBase="/staff/tasks"
                allowedKinds={['INCIDENT']}
              />
              <section
                id="technician-guide"
                className="dashboard-staff-guide"
                tabIndex={-1}
                aria-labelledby="technician-guide-title"
              >
                <h2 id="technician-guide-title">Từ nhận việc đến hoàn thành sự cố</h2>
                <ol>
                  <li>
                    <strong>Kiểm tra sự cố</strong>
                    <p>Xem thông tin tủ, lý do và hướng dẫn xử lý.</p>
                  </li>
                  <li>
                    <strong>Khắc phục và ghi nhận</strong>
                    <p>Bắt đầu công việc, sửa chữa thực tế và tải ảnh minh chứng.</p>
                  </li>
                  <li>
                    <strong>Đóng sự cố và gửi báo cáo</strong>
                    <p>Xác nhận đã kiểm tra thực tế để gửi người quản lý duyệt.</p>
                  </li>
                </ol>
                <p className="dashboard-data-note">
                  Kỹ thuật viên chỉ phụ trách sự cố kỹ thuật; không thực hiện nạp hoa cho shop.
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
