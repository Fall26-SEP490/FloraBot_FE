'use client';

import { useEffect, useState } from 'react';
import './styles/member.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button, MessageSquare, Package, RotateCcw, User } from '@florabot/ui';
import WebRequests from '../orders/WebRequests';
import { CustomerChatSection } from '@/features/chat/CustomerChatSection';
import { getCustomerUnreadCount } from '@/features/chat/api';
import { sessionQuery } from '@/shared/lib/api';
import { fetchMemberProfile, fetchMemberHistory } from './customer-account.api';
import {
  type TabKey,
  type CustomerHistoryItem,
  TAB_HASH_MAP,
  TAB_TO_HASH,
  ORDER_STATUS_LABELS,
} from './customer-account.types';

export default function MemberAccount() {
  const router = useRouter();
  const session = useQuery(sessionQuery);
  const isCustomer = session.data?.role === 'CUSTOMER';
  const [initialChatId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('chat');
    }
    return null;
  });

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
      if (hash && TAB_HASH_MAP[hash]) {
        setActiveTab(TAB_HASH_MAP[hash]);
      } else if (window.location.search.includes('chat=')) {
        setActiveTab('chats');
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
  }, [router, session.data]);

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const hash = TAB_TO_HASH[tab];
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }

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

  const chatsQuery = useQuery({
    queryKey: ['member-chats-unread-count', session.data?.id],
    queryFn: ({ signal }) => getCustomerUnreadCount(signal),
    enabled: isCustomer,
    refetchInterval: 15000,
  });

  const unreadChatsCount = chatsQuery.isSuccess ? chatsQuery.data : undefined;
  const visibleTab = activeTab === 'chats' && !isCustomer ? 'overview' : activeTab;

  const initialLetter = (profile.data?.fullName || 'F').trim().charAt(0).toUpperCase();

  return (
    <main id="main" className="member-page">
      {/* Account Header */}
      <header className="account-hero-card">
        <span className="account-avatar" aria-hidden="true">
          {initialLetter}
        </span>
        <div className="account-hero-info">
          <h1 className="account-hero-greeting">Góc nhỏ của {profile.data?.fullName || 'bạn'}</h1>
          <p className="account-hero-sub">
            Theo dõi đơn đặt hoa, lịch sử mua và điểm tích lũy của bạn.
          </p>
          <div className="account-badges-row">
            {profile.data?.email && (
              <span className="account-badge-pill">
                <User size={13} aria-hidden="true" />
                <span>{profile.data.email}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {profile.isPending && <p role="status">Đang tải thông tin mua hoa…</p>}
      {profile.isError && (
        <div role="alert">
          <p>Chưa tải được thông tin mua hoa và điểm tích lũy.</p>
          <Button variant="outline" onClick={() => void profile.refetch()}>
            Thử lại thông tin
          </Button>
        </div>
      )}

      {/* Account Navigation Tabs */}
      <div className="member-tabs-container">
        <nav className="member-tabs" aria-label="Trong tài khoản">
          <a
            href="#overview"
            className={`member-tab-btn ${visibleTab === 'overview' ? 'is-active' : ''}`}
            aria-current={visibleTab === 'overview' ? 'page' : undefined}
            onClick={() => switchTab('overview')}
          >
            <span>Tổng quan</span>
          </a>
          {isCustomer && (
            <a
              href="#member-chats"
              className={`member-tab-btn ${visibleTab === 'chats' ? 'is-active' : ''}`}
              aria-current={visibleTab === 'chats' ? 'page' : undefined}
              onClick={() => switchTab('chats')}
            >
              <MessageSquare size={15} aria-hidden="true" />
              <span>Tin nhắn</span>
              {unreadChatsCount !== undefined && unreadChatsCount > 0 && (
                <span
                  className="member-unread-pill"
                  aria-label={`${unreadChatsCount} tin chưa đọc`}
                >
                  {unreadChatsCount}
                </span>
              )}
            </a>
          )}
          <a
            href="#web-orders"
            className={`member-tab-btn ${visibleTab === 'orders' ? 'is-active' : ''}`}
            aria-current={visibleTab === 'orders' ? 'page' : undefined}
            onClick={() => switchTab('orders')}
          >
            <Package size={15} aria-hidden="true" />
            <span>Đơn đặt trước</span>
          </a>
          <a
            href="#member-orders"
            className={`member-tab-btn ${visibleTab === 'history' ? 'is-active' : ''}`}
            aria-current={visibleTab === 'history' ? 'page' : undefined}
            onClick={() => switchTab('history')}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Lịch sử mua</span>
          </a>
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {visibleTab === 'overview' && (
        <div className="account-overview-panel">
          <div className="overview-stats-grid">
            <div className="overview-stat-card">
              <span className="overview-stat-label">Điểm tích lũy</span>
              <span className="overview-stat-value">
                {profile.isSuccess ? profile.data.loyaltyPoints.toLocaleString('vi-VN') : '—'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#55725c' }}>
                Điểm thưởng dùng cho các đơn hoa kế tiếp
              </span>
            </div>
            {isCustomer && (
              <div className="overview-stat-card">
                <span className="overview-stat-label">Tin nhắn với các shop</span>
                {chatsQuery.isError ? (
                  <div role="alert">
                    <p>Chưa tải được số tin chưa đọc.</p>
                    <Button variant="outline" onClick={() => void chatsQuery.refetch()}>
                      Thử lại tin nhắn
                    </Button>
                  </div>
                ) : chatsQuery.isPending ? (
                  <p role="status">Đang tải số tin chưa đọc…</p>
                ) : (
                  <span className="overview-stat-value">{unreadChatsCount} chưa đọc</span>
                )}
                <Button
                  variant="outline"
                  onClick={() => switchTab('chats')}
                  style={{ alignSelf: 'flex-start', marginTop: 'auto', fontSize: '0.8rem' }}
                >
                  Mở hộp thư
                </Button>
              </div>
            )}
            <div className="overview-stat-card">
              <span className="overview-stat-label">Đơn đặt trước</span>
              <span className="overview-stat-value">Quản lý</span>
              <Button
                variant="outline"
                onClick={() => switchTab('orders')}
                style={{ alignSelf: 'flex-start', marginTop: 'auto', fontSize: '0.8rem' }}
              >
                Xem đơn đặt trước
              </Button>
            </div>
          </div>

          {isCustomer && (
            <div className="account-section-card">
              <h2>Hồ sơ thuê kiosk / Mở shop</h2>
              <p>Đăng ký mở shop hoặc theo dõi tiến độ hồ sơ thuê kiosk của bạn.</p>
              <Link href="/thue-kiosk" className="button button-outline">
                Xem hồ sơ thuê kiosk
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Chats */}
      {visibleTab === 'chats' && (
        <section id="member-chats">
          <CustomerChatSection initialChatId={initialChatId} />
        </section>
      )}

      {/* Tab 3: Preorders */}
      {visibleTab === 'orders' && <WebRequests mode="member" />}

      {/* Tab 4: History */}
      {visibleTab === 'history' && (
        <section id="member-orders" className="account-section-card">
          <h2>Lịch sử mua hoa</h2>
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
                <ul className="member-orders">
                  {history.data.items.map((order: CustomerHistoryItem) => (
                    <li key={order.id}>
                      <h3>
                        {order.shopName} · {order.orderCode}
                      </h3>
                      <p>
                        {ORDER_STATUS_LABELS[order.status] || order.status} ·{' '}
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <p>{order.items.join(', ') || 'Hoa đặt theo yêu cầu'}</p>
                      <strong>{Number(order.totalAmount).toLocaleString('vi-VN')} đ</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="member-empty">
                  <h3>Một dịp tặng hoa đang đợi bạn</h3>
                  <p>Các đơn mua bằng tài khoản này sẽ được lưu ở đây.</p>
                  <Link href="/dat-hoa">Khám phá hoa và đặt theo yêu cầu</Link>
                </div>
              )}
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
            </>
          )}
        </section>
      )}
    </main>
  );
}
