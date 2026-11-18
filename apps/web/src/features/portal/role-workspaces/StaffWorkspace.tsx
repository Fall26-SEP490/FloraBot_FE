'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@florabot/ui';
import { isTransientSessionError, logoutSession, sessionQuery } from '@/shared/lib/api';
import { accountPath } from '@/features/portal/config/roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../components/WorkspaceNavigation';
import '../workspace-styles.css';
import '../../dashboard/styles/dashboard-overview.css';
import '../../account-management/styles/platform-workspace.css';
import '../../account-management/styles/platform-refresh.css';
import '../styles/workspace-role-parity.css';

const StaffChatSection = dynamic(
  () => import('@/features/chat/StaffChatSection').then((mod) => mod.StaffChatSection),
  {
    loading: () => <p role="status">Đang tải tin nhắn…</p>,
  },
);

const StaffTasks = dynamic(() => import('../../task-management/TaskManagement'), {
  loading: () => <p role="status">Đang tải công việc…</p>,
});

export default function StaffWorkspace({ section = 'tasks' }: { section?: string }) {
  const session = useQuery(sessionQuery);
  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      window.location.replace('/dang-nhap');
    },
  });
  if (session.isPending)
    return (
      <main id="main">
        <p role="status">Đang tải tài khoản nhân viên shop…</p>
      </main>
    );
  if (!session.data || (session.isError && !isTransientSessionError(session.error)))
    return (
      <main id="main" className="workspace">
        <h1>Không tải được phiên làm việc</h1>
        <p role="alert">Kiểm tra kết nối hoặc đăng nhập lại để tiếp tục.</p>
        <Button onClick={() => void session.refetch()}>Thử lại</Button>{' '}
        <Link href="/dang-nhap">Về đăng nhập tài khoản</Link>
      </main>
    );
  if (session.data.role !== 'SELLER_STAFF')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="SELLER_STAFF"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell staff-workspace">
        <WorkspaceNavigation workspaceRole="SELLER_STAFF" section={section} />
        <main id="main" className="workspace dashboard-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>{section === 'chats' ? 'Nhắn với chủ shop' : 'Công việc giao hoa'}</h1>
              <p>
                {section === 'chats'
                  ? 'Trao đổi yêu cầu công việc và chia sẻ ảnh trực tiếp với shop của bạn.'
                  : 'Chọn công việc để xem nơi giao và thao tác tiếp theo.'}
              </p>
            </div>
          </div>
          {section === 'chats' ? (
            <StaffChatSection
              key={`${session.data.id}:${session.data.sellerId}`}
              session={session.data}
            />
          ) : (
            <>
              <StaffTasks
                actorRole="SELLER_STAFF"
                mode="worker"
                actorId={session.data.id}
                sellerId={session.data.sellerId}
                apiBase="/staff/tasks"
                allowedKinds={['DELIVERY']}
              />
              <details id="staff-guide" className="dashboard-staff-guide" tabIndex={-1}>
                <summary>Cách làm công việc giao hoa</summary>
                <ol>
                  <li>
                    <strong>Kiểm tra yêu cầu</strong>
                    <p>Xem đúng tủ, địa chỉ và nội dung được phân công.</p>
                  </li>
                  <li>
                    <strong>Thao tác tại tủ</strong>
                    <p>Làm theo yêu cầu trong công việc đã mở.</p>
                  </li>
                  <li>
                    <strong>Gửi báo cáo</strong>
                    <p>Cập nhật kết quả nạp hoa để chủ shop theo dõi.</p>
                  </li>
                </ol>
                <p className="dashboard-data-note">
                  Bạn chỉ thao tác trong phạm vi công việc được giao của shop phụ trách.
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
