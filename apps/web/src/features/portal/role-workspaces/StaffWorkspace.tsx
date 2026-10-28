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
  const session = useQuery({ ...sessionQuery, refetchInterval: 60_000 });
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
  if (session.isError)
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
      <div className="dashboard-shell">
        <WorkspaceNavigation workspaceRole="SELLER_STAFF" section={section} />
        <main id="main" className="workspace dashboard-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>{section === 'chats' ? 'Nhắn với chủ shop' : `Chào ${session.data.name}`}</h1>
              <p>
                {section === 'chats'
                  ? 'Trao đổi yêu cầu công việc và chia sẻ ảnh trực tiếp với shop của bạn.'
                  : 'Nhận việc, nạp hoa vào ô tủ và gửi báo cáo cho shop.'}
              </p>
            </div>
            <span className="dashboard-context">Nhân viên shop</span>
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
              <section
                id="staff-guide"
                className="dashboard-staff-guide"
                tabIndex={-1}
                aria-labelledby="staff-guide-title"
              >
                <h2 id="staff-guide-title">Từ nhận việc đến hoàn thành</h2>
                <ol>
                  <li>
                    <strong>Kiểm tra yêu cầu</strong>
                    <p>Xem đúng tủ, địa chỉ và nội dung được phân công.</p>
                  </li>
                  <li>
                    <strong>Nạp hoa vào ô</strong>
                    <p>Bắt đầu công việc, chọn ô trống, quét mã QR và xác nhận.</p>
                  </li>
                  <li>
                    <strong>Gửi báo cáo</strong>
                    <p>Cập nhật kết quả nạp hoa để chủ shop theo dõi.</p>
                  </li>
                </ol>
                <p className="dashboard-data-note">
                  Bạn chỉ thao tác trong phạm vi công việc được giao của shop phụ trách.
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
