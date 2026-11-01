'use client';

import { useEffect, useState } from 'react';
import './styles/member.css';
import './styles/member-dashboard.css';
import './styles/account-home.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Button, Flower2, MessageSquare, Store } from '@florabot/ui';
import WebRequests from '../orders/WebRequests';
import CustomerPendingOrders from './CustomerPendingOrders';
import { preorderPaymentReturn } from '../orders/payment-return';
import { CustomerChatSection } from '@/features/chat/CustomerChatSection';
import { getCustomerUnreadCount } from '@/features/chat/api';
import { sessionQuery } from '@/shared/lib/api';
import { fetchMemberProfile, fetchMemberHistory } from './customer-account.api';
import {
  type TabKey,
  type CustomerHistoryItem,
  TAB_HASH_MAP,
  ORDER_STATUS_LABELS,
} from './customer-account.types';

export default function MemberAccount() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get('chat') || null;
  const session = useQuery(sessionQuery);
  const isCustomer = session.data?.role === 'CUSTOMER';
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash && TAB_HASH_MAP[hash]) return TAB_HASH_MAP[hash];
      if (window.location.search.includes('chat=')) return 'chats';
    }
    return 'overview';
  });

  useEffect(() => {
    const syncFromUrl = () => {
      const paymentReturn = preorderPaymentReturn(window.location.search);
      if (paymentReturn) {
        setActiveTab('orders');
        router.replace(paymentReturn);
        return;
      }
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
        setActiveTab('overview');
      }
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [router, session.data, initialChatId, searchParams]);

  const profile = useQuery({
    queryKey: ['member-profile', session.data?.id],
    queryFn: fetchMemberProfile,
  });

  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['member-history', session.data?.id, page],
    queryFn: () => fetchMemberHistory(page),
    enabled: activeTab === 'history',
  });

  const recentHistory = useQuery({
    queryKey: ['member-history', session.data?.id, 1],
    queryFn: () => fetchMemberHistory(1),
    enabled: activeTab === 'overview',
  });

  const chatsQuery = useQuery({
    queryKey: ['member-chats-unread-count', session.data?.id],
    queryFn: ({ signal }) => getCustomerUnreadCount(signal),
    enabled: isCustomer,
    refetchInterval: 15000,
  });

  const unreadChatsCount = chatsQuery.isSuccess ? chatsQuery.data : undefined;
  // A conversation link takes precedence immediately, including same-route navigation.
  const requestedTab = initialChatId ? 'chats' : activeTab;
  const visibleTab = requestedTab === 'chats' && !isCustomer ? 'overview' : requestedTab;

  return (
    <main id="main" className="member-page">
      {visibleTab === 'overview' && (
        <div className="account-home">
          <header className="account-home-heading">
            <div>
              <h1>Tổng quan</h1>
              <p>Xin chào, {session.data?.name || 'bạn'}. Cùng xem hoạt động gần đây của bạn.</p>
            </div>
            <Link href="/dat-hoa" className="button button-primary">
              Khám phá hoa <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </header>
          {isCustomer && <CustomerPendingOrders />}
          <div className="account-home-status">
            <div className="account-home-points">
              <Flower2 size={20} aria-hidden="true" />
              <div>
                <span>Điểm tích lũy</span>
                <strong>
                  {profile.isSuccess ? profile.data.loyaltyPoints.toLocaleString('vi-VN') : '—'}
                </strong>
              </div>
              {profile.isError && (
                <Button variant="outline" onClick={() => void profile.refetch()}>
                  Thử lại
                </Button>
              )}
            </div>
            {isCustomer && (
              <div className="account-home-inbox">
                <MessageSquare size={20} aria-hidden="true" />
                <div>
                  <strong>
                    {chatsQuery.isPending
                      ? 'Đang tải tin nhắn…'
                      : chatsQuery.isError
                        ? 'Chưa tải được tin nhắn'
                        : unreadChatsCount
                          ? unreadChatsCount + ' tin nhắn chưa đọc'
                          : 'Không có tin nhắn chưa đọc'}
                  </strong>
                  <span>Trao đổi và nhận cập nhật từ shop.</span>
                </div>
                {chatsQuery.isError ? (
                  <Button variant="outline" onClick={() => void chatsQuery.refetch()}>
                    Thử lại
                  </Button>
                ) : (
                  <a href="/tai-khoan#member-chats">
                    Mở hộp thư <ArrowRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
          <section className="account-home-recent" aria-labelledby="recent-purchases-title">
            <div className="account-home-section-heading">
              <h2 id="recent-purchases-title">Lần mua gần đây</h2>
              <a href="/tai-khoan#member-orders">
                Xem tất cả <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            {recentHistory.isPending ? (
              <p role="status">Đang tải các lần mua gần đây…</p>
            ) : recentHistory.isError ? (
              <div role="alert">
                <p>Chưa tải được lịch sử mua.</p>
                <Button variant="outline" onClick={() => void recentHistory.refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : recentHistory.data.items.length ? (
              <ul className="account-home-purchases">
                {recentHistory.data.items.slice(0, 3).map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>{order.shopName}</strong>
                      <span>
                        {order.orderCode} · {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <span className="account-home-order-status">
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                    <strong>{Number(order.totalAmount).toLocaleString('vi-VN')} đ</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="account-home-empty">
                <Flower2 size={30} aria-hidden="true" />
                <h3>Chưa có lần mua nào</h3>
                <p>Khi bạn mua hoa, thông tin đơn sẽ xuất hiện ở đây.</p>
                <a href="/tai-khoan#web-orders">
                  Đang chờ nhận hoa? Xem đơn đặt trước <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            )}
          </section>
          {isCustomer && (
            <div className="account-home-partner">
              <Store size={18} aria-hidden="true" />
              <span>Bạn muốn mở shop trên FloraBot?</span>
              <Link href="/thue-kiosk">
                Tìm hiểu thuê kiosk <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Chats */}
      {visibleTab === 'chats' && (
        <section id="member-chats">
          <header className="account-section-heading">
            <h1>Tin nhắn</h1>
            <p>Trao đổi với shop về đơn hoa của bạn.</p>
          </header>
          <CustomerChatSection key={initialChatId ?? 'inbox'} initialChatId={initialChatId} />
        </section>
      )}

      {/* Tab 3: Preorders */}
      {visibleTab === 'orders' && <WebRequests mode="member" />}

      {/* Tab 4: History */}
      {visibleTab === 'history' && (
        <section id="member-orders" className="account-section-card">
          <header className="account-section-heading">
            <h1>Lịch sử mua</h1>
            <p>Xem lại những lần mua hoa và trạng thái xử lý.</p>
          </header>
          {history.isPending ? (
            <p role="status">Đang tải đơn hàng…</p>
          ) : history.isError ? (
            <>
              <p role="alert">Chưa tải được lịch sử.</p>
              <Button onClick={() => void history.refetch()}>Tải lại lịch sử</Button>
            </>
          ) : (
            <>
              {history.data.items.length ? (
                <ul className="account-history-list">
                  {history.data.items.map((order: CustomerHistoryItem) => (
                    <li key={order.id}>
                      <div className="account-history-row">
                        <h2>{order.shopName}</h2>
                        <span className="account-history-status">
                          {ORDER_STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <p className="account-history-meta">
                        {order.orderCode} ·{' '}
                        <time dateTime={order.createdAt}>
                          {new Date(order.createdAt).toLocaleString('vi-VN')}
                        </time>
                      </p>
                      <div className="account-history-row">
                        <p>{order.items.join(', ') || 'Hoa đặt theo yêu cầu'}</p>
                        <strong>{Number(order.totalAmount).toLocaleString('vi-VN')} đ</strong>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="member-empty">
                  <span className="member-empty-icon">
                    <Flower2 size={24} aria-hidden="true" />
                  </span>
                  <h3>{page > 1 ? 'Chưa có đơn ở trang này' : 'Chưa có lịch sử mua hoa'}</h3>
                  <p>Các đơn mua bằng tài khoản này sẽ được lưu ở đây.</p>
                  {page === 1 && (
                    <Link className="button button-outline" href="/dat-hoa">
                      Khám phá hoa <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
              {(page > 1 || history.data.hasMore) && (
                <nav className="stock-actions" aria-label="Phân trang lịch sử">
                  <Button
                    variant="outline"
                    disabled={page === 1 || history.isFetching}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Trang trước
                  </Button>
                  <span>Trang {page}</span>
                  <Button
                    variant="outline"
                    disabled={!history.data.hasMore || history.isFetching}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Trang sau
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
