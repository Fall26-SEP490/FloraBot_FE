'use client';

import { useEffect, useState } from 'react';
import './styles/member.css';
import './styles/member-dashboard.css';
import './styles/account-home.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import WebRequests from '../orders/WebRequests';
import CustomerRentalApplication from './CustomerRentalApplication';
import { findPaymentReturn, validPaymentCode } from '../orders/payment-return';
import { CustomerChatSection } from '@/features/chat/CustomerChatSection';
import { sessionQuery } from '@/shared/lib/api';
import { type TabKey, TAB_HASH_MAP } from './customer-account.types';

export default function MemberAccount() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get('chat') || null;
  const session = useQuery(sessionQuery);
  const isCustomer = session.data?.role === 'CUSTOMER';
  const returningCode = validPaymentCode(searchParams.get('orderCode'));
  const checkoutReturn = useQuery({
    queryKey: ['payment-return-target', session.data?.id, session.data?.role, returningCode],
    enabled: Boolean(session.data && returningCode),
    queryFn: () => findPaymentReturn(returningCode!, session.data!.id, session.data!.role),
    staleTime: 0,
  });
  useEffect(() => {
    if (returningCode && checkoutReturn.data) router.replace(checkoutReturn.data);
  }, [returningCode, checkoutReturn.data, router]);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash && TAB_HASH_MAP[hash]) return TAB_HASH_MAP[hash];
      if (window.location.search.includes('chat=')) return 'chats';
    }
    return 'orders';
  });

  useEffect(() => {
    const syncFromUrl = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'member-profile' || hash === 'profile') {
        router.replace('/ho-so');
        return;
      }
      if (hash === 'member-security' || hash === 'security') {
        router.replace('/ho-so#security');
        return;
      }
      if (hash === 'member-kiosks') {
        router.replace('/tim-kiosk');
        return;
      }
      if (hash === 'member-shop' && session.data) {
        router.replace(session.data.role === 'SELLER' ? '/seller' : '/thue-kiosk');
        return;
      }
      if (session.data?.role === 'SELLER' && !returningCode) {
        router.replace('/ho-so');
        return;
      }
      if (new URLSearchParams(window.location.search).get('chat')) {
        setActiveTab('chats');
        if (window.location.hash !== '#member-chats') {
          const url = new URL(window.location.href);
          url.hash = 'member-chats';
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        }
      } else if (hash && TAB_HASH_MAP[hash]) {
        setActiveTab(TAB_HASH_MAP[hash]);
      } else {
        setActiveTab('orders');
      }
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [router, session.data, initialChatId, searchParams, returningCode]);

  const requestedTab = initialChatId ? 'chats' : activeTab;
  const visibleTab = requestedTab === 'chats' && isCustomer ? 'chats' : 'orders';

  if (returningCode) {
    return (
      <main id="main" className="member-page">
        <div className="account-home">
          <h1>Kết quả thanh toán</h1>
          {checkoutReturn.isSuccess && !checkoutReturn.data && !checkoutReturn.isFetching ? (
            <>
              <p role="alert">
                Trình duyệt này chưa lưu giao dịch. Hãy mở mục theo dõi bên dưới để kiểm tra. Nếu đã
                chuyển khoản, đừng thanh toán lại.
              </p>
              <div className="stock-actions">
                <Button onClick={() => void checkoutReturn.refetch()}>Kiểm tra lại</Button>
                <Link href={isCustomer ? '/tai-khoan#web-orders' : '/seller/subscriptions'}>
                  {isCustomer ? 'Xem đơn đặt trước' : 'Xem kỳ thuê kiosk'}
                </Link>
                <Link href="/thue-kiosk">Xem hồ sơ thuê kiosk</Link>
              </div>
            </>
          ) : (
            <p role="status">Đang tìm giao dịch để mở trang theo dõi…</p>
          )}
        </div>
      </main>
    );
  }

  if (!isCustomer)
    return (
      <main id="main" className="member-page">
        <p role="status">Đang mở hồ sơ cá nhân…</p>
      </main>
    );

  return (
    <main id="main" className="member-page">
      {visibleTab === 'chats' ? (
        <section id="member-chats">
          <header className="account-section-heading">
            <h1>Tin nhắn</h1>
          </header>
          <CustomerChatSection key={initialChatId ?? 'inbox'} initialChatId={initialChatId} />
        </section>
      ) : (
        <>
          <CustomerRentalApplication />
          <WebRequests mode="member" />
        </>
      )}
    </main>
  );
}
