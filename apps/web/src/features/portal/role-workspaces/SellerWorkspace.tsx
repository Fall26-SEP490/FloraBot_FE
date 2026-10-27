'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Button } from '@florabot/ui';
import { ApiError, logoutSession, sessionQuery, type Session } from '../../../api';
import { accountPath } from '../../../roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../../../WorkspaceNavigation';
import { workspaceSections } from '../../../workspaceSections';
import { startPortalUpdates } from '../../../realtime';
import '../workspace-styles.css';
import '../../dashboard/styles/dashboard-overview.css';
import '../../../seller.css';

const DashboardOverview = dynamic(() => import('../../dashboard/DashboardOverview'), {
  loading: () => <p role="status">Đang tải tổng quan cửa hàng…</p>,
});

const WebRequests = dynamic(() => import('../../orders/WebRequests'), {
  loading: () => <p role="status">Đang tải danh sách đơn hàng…</p>,
});

const SellerChatSection = dynamic(
  () => import('../../../chat/SellerChatSection').then((mod) => mod.SellerChatSection),
  {
    loading: () => <p role="status">Đang tải tin nhắn…</p>,
  },
);

const StaffChatSection = dynamic(
  () => import('../../../chat/StaffChatSection').then((mod) => mod.StaffChatSection),
  {
    loading: () => <p role="status">Đang tải tin nhắn nhân viên…</p>,
  },
);

const Products = dynamic(() => import('../../product-management/ProductManagement'), {
  loading: () => <p role="status">Đang tải danh sách mẫu hoa…</p>,
});

const SellerKiosks = dynamic(() => import('../../kiosk-management/SellerKiosks'), {
  loading: () => <p role="status">Đang tải danh sách kiosk…</p>,
});

const Subscriptions = dynamic(
  () => import('../../finance/components/subscriptions/Subscriptions'),
  {
    loading: () => <p role="status">Đang tải gói dịch vụ…</p>,
  },
);

const SellerStock = dynamic(() => import('../../inventory/SellerStock'), {
  loading: () => <p role="status">Đang tải danh sách tồn kho…</p>,
});

const SellerAccessories = dynamic(() => import('../../inventory/SellerAccessories'), {
  loading: () => <p role="status">Đang tải danh mục phụ kiện…</p>,
});

const Wallet = dynamic(() => import('../../finance/components/wallet/Wallet'), {
  loading: () => <p role="status">Đang tải ví và giao dịch…</p>,
});

const StaffTasks = dynamic(() => import('../../task-management/TaskManagement'), {
  loading: () => <p role="status">Đang tải danh sách công việc…</p>,
});

const AccountManagement = dynamic(() => import('../../account-management/AccountManagement'), {
  loading: () => <p role="status">Đang tải quản lý nhân sự…</p>,
});

function SubscriptionBanner({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const status = session.sellerStatus || 'UNKNOWN';
  const expiry = session.packageExpiresAt
    ? new Date(`${session.packageExpiresAt}T00:00:00+07:00`)
    : null;
  const days = expiry ? (expiry.getTime() - now) / 86400000 : Infinity;
  if (status === 'ACTIVE' && days > 7) return null;
  const key =
    status === 'ACTIVE'
      ? 'EXPIRING'
      : ['PENDING', 'APPROVED', 'PAST_DUE', 'SUSPENDED', 'CLOSED'].includes(status)
        ? status
        : 'UNKNOWN';
  return (
    <aside
      className={`subscription-banner ${status === 'PAST_DUE' ? 'subscription-overdue' : ''}`}
      aria-label="Trạng thái gói"
      role="status"
    >
      <p>
        {t(`banner.${key}`, {
          date:
            expiry?.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) ||
            'chưa xác định',
        })}
      </p>
      {['APPROVED', 'PAST_DUE', 'ACTIVE'].includes(status) && (
        <Link
          href="/seller/subscriptions#subscriptions"
          onClick={(event) => {
            const target = document.getElementById('subscriptions');
            if (target) {
              event.preventDefault();
              target.focus();
              target.scrollIntoView({ block: 'start' });
            }
          }}
        >
          {status === 'APPROVED' ? 'Đăng ký gói' : 'Gia hạn gói thuê'}
        </Link>
      )}
    </aside>
  );
}

function PortalUpdates() {
  useEffect(startPortalUpdates, []);
  return null;
}

export default function SellerWorkspace({ section = 'overview' }: { section?: string }) {
  const { t } = useTranslation();
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
        <Link href="/dang-nhap">Về đăng nhập</Link>
      </main>
    );
  if (session.data.role !== 'SELLER')
    return (
      <main id="main">
        <h1>Bạn không có quyền vào khu vực này</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="SELLER"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell seller-workspace">
        <WorkspaceNavigation key={section} workspaceRole="SELLER" section={section} />
        <main id="main" className="workspace dashboard-content">
          <PortalUpdates />
          <SubscriptionBanner session={session.data} />
          <div className="dashboard-page-heading">
            <div>
              <h1>
                {section === 'overview'
                  ? 'Tổng quan cửa hàng'
                  : workspaceSections['SELLER'].find(([key]) => key === section)?.[1]}
              </h1>
              <p>
                {section === 'overview'
                  ? `Chào ${session.data.name}, cùng theo dõi hoạt động kiosk hôm nay.`
                  : workspaceSections['SELLER'].find(([key]) => key === section)?.[2]}
              </p>
            </div>
            <span className="dashboard-context">
              {section === 'overview'
                ? 'Chủ shop'
                : workspaceSections['SELLER']?.find(([key]) => key === section)?.[1] || 'Cửa hàng'}
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
                    <dd>Chủ shop</dd>
                  </div>
                  <div>
                    <dt>Trạng thái shop</dt>
                    <dd>
                      {t(`status.${session.data.sellerStatus}`, {
                        defaultValue: 'Chưa xác định',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày hết hạn gói</dt>
                    <dd>
                      {session.data.packageExpiresAt
                        ? new Date(
                            `${session.data.packageExpiresAt}T00:00:00+07:00`,
                          ).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                        : 'Chưa có kỳ thuê đang hoạt động'}
                    </dd>
                  </div>
                </dl>
              </details>
            </>
          )}
          {section === 'orders' && (
            <WebRequests mode="seller" sellerId={session.data.sellerId || undefined} />
          )}
          {section === 'chats' && <SellerChatSection session={session.data} />}
          {section === 'staff-chats' && (
            <StaffChatSection
              key={`${session.data.id}:${session.data.sellerId}`}
              session={session.data}
            />
          )}
          {section === 'products' && <Products session={session.data} />}
          {section === 'kiosks' && <SellerKiosks session={session.data} />}
          {section === 'subscriptions' && <Subscriptions session={session.data} />}
          {section === 'stock' && <SellerStock session={session.data} />}
          {section === 'accessories' && <SellerAccessories session={session.data} />}
          {section === 'wallet' && <Wallet session={session.data} />}
          {section === 'tasks' && session.data.sellerId && (
            <StaffTasks
              actorRole="SELLER"
              mode="manager"
              actorId={session.data.id}
              sellerId={session.data.sellerId}
              apiBase={`/sellers/${session.data.sellerId}/staff-tasks`}
              directoryEndpoint={`/sellers/${session.data.sellerId}/staff`}
              deliveryScopesEndpoint={`/sellers/${session.data.sellerId}/staff-delivery-scopes`}
              allowedKinds={['DELIVERY']}
              canAssign
              canReassign
            />
          )}
          {section === 'staff' && (
            <AccountManagement
              actorRole="SELLER"
              targetRole="SELLER_STAFF"
              title="Quản lý Nhân viên shop"
              eyebrow="Vận hành shop"
              description="Tạo tài khoản và quản lý trạng thái hoạt động của nhân viên shop."
              createLabel="Thêm nhân viên shop"
              itemName="nhân viên shop"
              apiBase={`/sellers/${session.data.sellerId}/staff`}
              listEndpoint={`/sellers/${session.data.sellerId}/staff/accounts`}
              sellerId={session.data.sellerId}
            />
          )}
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
