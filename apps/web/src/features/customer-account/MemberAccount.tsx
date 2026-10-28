'use client';

import { useEffect, useState } from 'react';
import './styles/member.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Flower2,
  MapPin,
  MessageSquare,
  Package,
  RotateCcw,
  Store,
  User,
} from '@florabot/ui';
import WebRequests from '../orders/WebRequests';
import MemberShop from '../orders/MemberShop';
import { CustomerChatSection } from '@/features/chat/CustomerChatSection';
import { getCustomerChats } from '@/features/chat/api';
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
      if (hash && TAB_HASH_MAP[hash]) {
        setActiveTab(TAB_HASH_MAP[hash]);
      } else if (window.location.search.includes('chat=')) {
        setActiveTab('chats');
      }
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [router]);

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const hash = TAB_TO_HASH[tab];
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }

  const profile = useQuery({
    queryKey: ['member-profile'],
    queryFn: fetchMemberProfile,
  });

  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['member-history', page],
    queryFn: () => fetchMemberHistory(page),
  });

  const chatsQuery = useQuery({
    queryKey: ['member-chats-unread-count'],
    queryFn: () => getCustomerChats(1),
    refetchInterval: 15000,
  });

  const unreadChatsCount = (chatsQuery.data?.items ?? []).reduce<number>(
    (sum, c) => sum + Number(c.unreadCount ?? 0),
    0,
  );

  const initialLetter = (profile.data?.fullName || 'F').trim().charAt(0).toUpperCase();

  return (
    <main id="main" className="member-page">
      {/* Account Header */}
      <header className="account-hero-card">
        <Link
          href="/ho-so"
          className="account-avatar"
          aria-label="Xem hồ sơ cá nhân của bạn"
          title="Xem hồ sơ cá nhân"
        >
          {initialLetter}
        </Link>
        <div className="account-hero-info">
          <h1 className="account-hero-greeting">Góc nhỏ của {profile.data?.fullName || 'bạn'}</h1>
          <p className="account-hero-sub">
            Thông tin thành viên và những dịp bạn gửi trao yêu thương cùng FloraBot.
          </p>
          <div className="account-badges-row">
            {profile.data?.email && (
              <span className="account-badge-pill">
                <User size={13} aria-hidden="true" />
                <span>{profile.data.email}</span>
              </span>
            )}
            {profile.data?.loyaltyPoints !== undefined && (
              <span className="account-badge-pill">
                <Flower2 size={13} aria-hidden="true" />
                <span>
                  Điểm tích lũy: {profile.data.loyaltyPoints.toLocaleString('vi-VN')} điểm
                </span>
              </span>
            )}
            <span className="account-badge-pill">
              <span>Thành viên FloraBot</span>
            </span>
          </div>
        </div>
        <div className="account-hero-action">
          <Link href="/ho-so" className="button button-outline" style={{ fontSize: '0.85rem' }}>
            Chỉnh sửa hồ sơ
          </Link>
        </div>
      </header>

      {/* Account Navigation Tabs */}
      <div className="member-tabs-container">
        <nav className="member-tabs" aria-label="Trong tài khoản">
          <a
            href="#overview"
            className={`member-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            aria-current={activeTab === 'overview' ? 'page' : undefined}
            onClick={() => switchTab('overview')}
          >
            <span>Tổng quan</span>
          </a>
          <a
            href="#member-chats"
            className={`member-tab-btn ${activeTab === 'chats' ? 'is-active' : ''}`}
            aria-current={activeTab === 'chats' ? 'page' : undefined}
            onClick={() => switchTab('chats')}
          >
            <MessageSquare size={15} aria-hidden="true" />
            <span>Tin nhắn</span>
            {unreadChatsCount > 0 && (
              <span className="member-unread-pill" aria-label={`${unreadChatsCount} tin chưa đọc`}>
                {unreadChatsCount}
              </span>
            )}
          </a>
          <a
            href="#web-orders"
            className={`member-tab-btn ${activeTab === 'orders' ? 'is-active' : ''}`}
            aria-current={activeTab === 'orders' ? 'page' : undefined}
            onClick={() => switchTab('orders')}
          >
            <Package size={15} aria-hidden="true" />
            <span>Đơn đặt trước</span>
          </a>
          <a
            href="#member-orders"
            className={`member-tab-btn ${activeTab === 'history' ? 'is-active' : ''}`}
            aria-current={activeTab === 'history' ? 'page' : undefined}
            onClick={() => switchTab('history')}
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Lịch sử mua</span>
          </a>
          <a
            href="#member-kiosks"
            className={`member-tab-btn ${activeTab === 'kiosks' ? 'is-active' : ''}`}
            aria-current={activeTab === 'kiosks' ? 'page' : undefined}
            onClick={() => switchTab('kiosks')}
          >
            <MapPin size={15} aria-hidden="true" />
            <span>Điểm đặt kiosk</span>
          </a>
          <a
            href="#member-shop"
            className={`member-tab-btn ${activeTab === 'shop' ? 'is-active' : ''}`}
            aria-current={activeTab === 'shop' ? 'page' : undefined}
            onClick={() => switchTab('shop')}
          >
            <Store size={15} aria-hidden="true" />
            <span>Shop của bạn</span>
          </a>
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="account-overview-panel">
          <div className="overview-stats-grid">
            <div className="overview-stat-card">
              <span className="overview-stat-label">Điểm tích lũy</span>
              <span className="overview-stat-value">
                {profile.data?.loyaltyPoints?.toLocaleString('vi-VN') || 0}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#55725c' }}>
                Điểm thưởng dùng cho các đơn hoa kế tiếp
              </span>
            </div>
            <div className="overview-stat-card">
              <span className="overview-stat-label">Tin nhắn với các shop</span>
              <span className="overview-stat-value">{unreadChatsCount} chưa đọc</span>
              <Button
                variant="outline"
                onClick={() => switchTab('chats')}
                style={{ alignSelf: 'flex-start', marginTop: 'auto', fontSize: '0.8rem' }}
              >
                Mở hộp thư
              </Button>
            </div>
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

          {/* Quick shortcuts grid on Overview */}
          <div className="overview-shortcuts-grid">
            <div className="overview-shortcut-card">
              <div>
                <h3>Hồ sơ & Tài khoản Google</h3>
                <p>Quản lý thông tin định danh và liên kết tài khoản đăng nhập nhanh.</p>
              </div>
              <Link href="/ho-so" className="button button-outline">
                Vào hồ sơ cá nhân
              </Link>
            </div>
            <div className="overview-shortcut-card">
              <div>
                <h3>Bảo mật tài khoản</h3>
                <p>Cập nhật mật khẩu định kỳ để bảo vệ quyền lợi và điểm tích lũy.</p>
              </div>
              <Link href="/ho-so#security" className="button button-outline">
                Đổi mật khẩu
              </Link>
            </div>
            <div className="overview-shortcut-card">
              <div>
                <h3>Hợp tác mở shop hoa</h3>
                <p>Trở thành đối tác kinh doanh hoa cùng FloraBot qua mạng lưới kiosk tự động.</p>
              </div>
              <Button variant="outline" onClick={() => switchTab('shop')}>
                Khám phá mở shop
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Chats */}
      {activeTab === 'chats' && (
        <section id="member-chats">
          <CustomerChatSection initialChatId={initialChatId} />
        </section>
      )}

      {/* Tab 3: Preorders */}
      {activeTab === 'orders' && <WebRequests mode="member" />}

      {/* Tab 4: History */}
      {activeTab === 'history' && (
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

      {/* Tab 5: Kiosks */}
      {activeTab === 'kiosks' && (
        <section id="member-kiosks" className="account-section-card">
          <h2>Điểm đặt tủ kiosk</h2>
          <p>
            Hệ thống tủ kiosk thông minh của FloraBot được đặt tại các địa điểm trung tâm, trường
            đại học và khu dân cư cao cấp, giúp bạn chủ động nhận hoa tươi bất cứ lúc nào theo lịch
            hẹn.
          </p>
          <div style={{ marginBlock: '1.25rem' }}>
            <Link href="/tim-kiosk" className="button button-primary">
              Tìm kiosk gần bạn nhất
            </Link>
          </div>
        </section>
      )}

      {/* Tab 6: Shop */}
      {activeTab === 'shop' && <MemberShop />}
    </main>
  );
}
