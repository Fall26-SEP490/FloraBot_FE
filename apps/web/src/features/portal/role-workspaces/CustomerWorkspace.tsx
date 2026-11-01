'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, MessageSquare, Package, RotateCcw, User } from '@florabot/ui';
import { sessionQuery } from '@/shared/lib/api';
import { getCustomerUnreadCount } from '@/features/chat/api';
import '../workspace-styles.css';
import './customer-account-shell.css';

const MemberAccount = dynamic(() => import('../../customer-account/MemberAccount'), {
  loading: () => <p role="status">Đang tải thông tin tài khoản…</p>,
});

const PersonalProfile = dynamic(() => import('../../profile/PersonalProfile'), {
  loading: () => <p role="status">Đang tải hồ sơ cá nhân…</p>,
});

const CustomerKioskOnboarding = dynamic(
  () => import('../../kiosk-onboarding/CustomerKioskOnboarding'),
  {
    loading: () => <p role="status">Đang tải đăng ký thuê kiosk…</p>,
  },
);

export default function CustomerWorkspace({
  screen,
}: {
  screen: 'member' | 'profile' | 'thue-kiosk';
}) {
  const session = useQuery(sessionQuery);
  const unread = useQuery({
    queryKey: ['member-chats-unread-count', session.data?.id],
    queryFn: ({ signal }) => getCustomerUnreadCount(signal),
    enabled: session.data?.role === 'CUSTOMER',
    refetchInterval: 15_000,
  });
  const searchParams = useSearchParams();
  const [hash, setHash] = useState('');
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  if (screen === 'thue-kiosk') return <CustomerKioskOnboarding />;
  if (screen === 'profile' && !['CUSTOMER', 'SELLER'].includes(session.data?.role ?? '')) {
    return <PersonalProfile />;
  }

  const items = [
    { href: '/tai-khoan#overview', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/tai-khoan#web-orders', label: 'Đơn đặt trước', icon: Package },
    ...(session.data?.role === 'CUSTOMER'
      ? [{ href: '/tai-khoan#member-chats', label: 'Tin nhắn', icon: MessageSquare }]
      : []),
    { href: '/tai-khoan#member-orders', label: 'Lịch sử mua', icon: RotateCcw },
    { href: '/ho-so', label: 'Hồ sơ cá nhân', icon: User },
  ];
  const current =
    screen === 'profile'
      ? '/ho-so'
      : `/tai-khoan${searchParams.get('chat') ? '#member-chats' : hash || '#overview'}`;

  return (
    <div className="customer-account-shell">
      <aside className="customer-account-sidebar">
        <div className="customer-account-sidebar-heading">
          <strong>Tài khoản của tôi</strong>
        </div>
        <nav aria-label="Điều hướng tài khoản" className="customer-account-navigation">
          {items.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} aria-current={current === href ? 'page' : undefined}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {href === '/tai-khoan#member-chats' && unread.data != null && unread.data > 0 && (
                <span
                  className="account-navigation-badge"
                  aria-label={`${unread.data} tin chưa đọc`}
                >
                  {unread.data > 99 ? '99+' : unread.data}
                </span>
              )}
            </a>
          ))}
        </nav>
      </aside>
      <div className="customer-account-content">
        {screen === 'member' ? <MemberAccount /> : <PersonalProfile embedded />}
      </div>
    </div>
  );
}
