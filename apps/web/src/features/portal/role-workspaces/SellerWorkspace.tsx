'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Button } from '@florabot/ui';
import { ApiError, logoutSession, sessionQuery, type Session } from '@/shared/lib/api';
import { accountPath } from '@/features/portal/config/roleRoutes';
import WorkspaceNavigation, { WorkspaceHeader } from '../components/WorkspaceNavigation';
import { findSellerNavHub } from '../components/SellerNavigation';
import SellerGuide from '../components/SellerGuide';
import { workspaceSections } from '@/features/portal/config/workspaceSections';
import { startPortalUpdates } from '@/shared/lib/realtime';
import '../workspace-styles.css';
import '../../dashboard/styles/dashboard-overview.css';
import '../styles/seller.css';
import '../../account-management/styles/platform-workspace.css';
import '../../account-management/styles/platform-refresh.css';
import '../styles/workspace-role-parity.css';
import '../../dashboard/styles/seller-overview.module.css';
import '../../orders/seller-orders.module.css';
import '../styles/seller-usability.css';
import '../styles/seller-flows.css';
import '../styles/seller-detail-flows.css';

const DashboardOverview = dynamic(() => import('../../dashboard/DashboardOverview'), {
  loading: () => <p role="status">Đang tải tổng quan cửa hàng…</p>,
});

const WebRequests = dynamic(() => import('../../orders/WebRequests'), {
  loading: () => <p role="status">Đang tải danh sách đơn hàng…</p>,
});

const SellerChatSection = dynamic(
  () => import('@/features/chat/SellerChatSection').then((mod) => mod.SellerChatSection),
  {
    loading: () => <p role="status">Đang tải tin nhắn…</p>,
  },
);

const StaffChatSection = dynamic(
  () => import('@/features/chat/StaffChatSection').then((mod) => mod.StaffChatSection),
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

const SellerCommerce = dynamic(
  () => import('../../finance/components/payment-channels/SellerCommerce'),
);
const SellerSeasonal = dynamic(() => import('../../product-management/components/SellerSeasonal'));
const SellerTerminations = dynamic(() =>
  import('../../kiosk-management/KioskTerminations').then((mod) => mod.SellerTerminations),
);
const SellerRefunds = dynamic(() => import('../../finance/components/refunds/SellerRefunds'));

const StaffTasks = dynamic(() => import('../../task-management/TaskManagement'), {
  loading: () => <p role="status">Đang tải danh sách công việc…</p>,
});

const AccountManagement = dynamic(() => import('../../account-management/AccountManagement'), {
  loading: () => <p role="status">Đang tải quản lý nhân sự…</p>,
});

function SubscriptionBanner({ session, section }: { session: Session; section?: string }) {
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
  const onSubscriptionsPage = section === 'subscriptions' || section === 'terminations';
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
      {!onSubscriptionsPage && ['APPROVED', 'PAST_DUE', 'ACTIVE'].includes(status) && (
        <Link href="/seller/subscriptions">Gia hạn ngay</Link>
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
  const currentSection = workspaceSections['SELLER'].find(([key]) => key === section);
  const activeHub = findSellerNavHub(section);
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
        <main id="main" className="workspace dashboard-content seller-content">
          <PortalUpdates />
          <nav className="seller-breadcrumb" aria-label="Vị trí hiện tại">
            {section === 'overview' ? (
              <span>Vận hành cửa hàng</span>
            ) : (
              <Link href="/seller">Tổng quan cửa hàng</Link>
            )}
          </nav>
          <div className="dashboard-page-heading">
            <div>
              <h1>{section === 'overview' ? 'Tổng quan cửa hàng' : currentSection?.[1]}</h1>
              {section !== 'overview' && currentSection?.[2] && <p>{currentSection[2]}</p>}
            </div>
          </div>
          {activeHub?.tabs && (
            <nav className="seller-stage-tabs" aria-label={`Phân mục ${activeHub.label}`}>
              {activeHub.tabs.map(([tabKey, tabLabel]) => (
                <Link
                  key={tabKey}
                  href={`/seller/${tabKey}`}
                  aria-current={section === tabKey ? 'page' : undefined}
                >
                  {tabLabel}
                </Link>
              ))}
            </nav>
          )}
          <SubscriptionBanner session={session.data} section={section} />
          {section === 'overview' && <DashboardOverview session={session.data} />}
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
          {section === 'commerce' && <SellerCommerce session={session.data} />}
          {section === 'seasonal' && <SellerSeasonal session={session.data} />}
          {section === 'terminations' && <SellerTerminations session={session.data} />}
          {section === 'refunds' && <SellerRefunds session={session.data} />}
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
          <SellerGuide key={section} section={section} />
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
