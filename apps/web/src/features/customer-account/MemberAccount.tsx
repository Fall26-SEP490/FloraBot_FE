'use client';

import { useEffect, useState } from 'react';
import './styles/member.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Button,
  Flower2,
  Lock,
  MapPin,
  MessageSquare,
  Package,
  RotateCcw,
  Store,
  User,
} from '@florabot/ui';
import { ApiError, queryClient } from '@/shared/lib/api';
import { passwordRule } from '../auth/auth.schemas';
import WebRequests from '../orders/WebRequests';
import MemberShop from '../orders/MemberShop';
import GoogleAccountLink from '../auth/GoogleAccountLink';
import { CustomerChatSection } from '@/features/chat/CustomerChatSection';
import { getCustomerChats } from '@/features/chat/api';
import MemberBasicProfileForm from './components/MemberBasicProfileForm';
import {
  fetchMemberProfile,
  changeMemberPassword,
  fetchMemberHistory,
} from './customer-account.api';
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
  }, []);

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

  const passwords = useForm<{ currentPassword: string; newPassword: string; confirm: string }>({
    mode: 'onBlur',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function save(body: unknown, password = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await changeMemberPassword(body);
      if (password) {
        passwords.reset();
        queryClient.clear();
        setNotice('Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
        router.push('/dang-nhap');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['member-profile'] });
        setNotice('Đã cập nhật tên của bạn.');
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được thay đổi. Hãy tải lại để kiểm tra.',
      );
    } finally {
      setBusy(false);
    }
  }

  const initialLetter = (profile.data?.fullName || 'F').trim().charAt(0).toUpperCase();

  return (
    <>
      <main id="main" className="member-page">
        {/* Account Header */}
        <header className="account-hero-card">
          <div className="account-avatar" aria-hidden="true">
            {initialLetter}
          </div>
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
            <button
              type="button"
              className="button button-outline"
              style={{ fontSize: '0.85rem' }}
              onClick={() => switchTab('profile')}
            >
              Chỉnh sửa hồ sơ
            </button>
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
              href="#member-profile"
              className={`member-tab-btn ${activeTab === 'profile' ? 'is-active' : ''}`}
              aria-current={activeTab === 'profile' ? 'page' : undefined}
              onClick={() => switchTab('profile')}
            >
              <User size={15} aria-hidden="true" />
              <span>Hồ sơ cá nhân</span>
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
                <span
                  className="member-unread-pill"
                  aria-label={`${unreadChatsCount} tin chưa đọc`}
                >
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
              href="#member-security"
              className={`member-tab-btn ${activeTab === 'security' ? 'is-active' : ''}`}
              aria-current={activeTab === 'security' ? 'page' : undefined}
              onClick={() => switchTab('security')}
            >
              <Lock size={15} aria-hidden="true" />
              <span>Bảo mật</span>
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

        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

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
                <Button variant="outline" onClick={() => switchTab('profile')}>
                  Vào hồ sơ cá nhân
                </Button>
              </div>
              <div className="overview-shortcut-card">
                <div>
                  <h3>Bảo mật tài khoản</h3>
                  <p>Cập nhật mật khẩu định kỳ để bảo vệ quyền lợi và điểm tích lũy.</p>
                </div>
                <Button variant="outline" onClick={() => switchTab('security')}>
                  Đổi mật khẩu
                </Button>
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

        {/* Tab 2: Profile */}
        {activeTab === 'profile' && (
          <section id="member-profile" className="account-section-card">
            <h2>Hồ sơ cá nhân</h2>
            {profile.isPending ? (
              <p role="status">Đang tải hồ sơ…</p>
            ) : profile.isError ? (
              <>
                <p role="alert">Chưa tải được hồ sơ.</p>
                <Button onClick={() => void profile.refetch()}>Tải lại hồ sơ</Button>
              </>
            ) : (
              <>
                <MemberBasicProfileForm defaultFullName={profile.data.fullName} />
                <GoogleAccountLink email={profile.data.email} />
                <div
                  style={{
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e1ebe0',
                  }}
                >
                  <Link
                    href="/ho-so"
                    className="button button-outline"
                    style={{ fontSize: '0.85rem' }}
                  >
                    Xem và cập nhật hồ sơ cá nhân
                  </Link>
                </div>
              </>
            )}
          </section>
        )}

        {/* Tab 3: Chats */}
        {activeTab === 'chats' && (
          <section id="member-chats">
            <CustomerChatSection initialChatId={initialChatId} />
          </section>
        )}

        {/* Tab 4: Preorders */}
        {activeTab === 'orders' && <WebRequests mode="member" />}

        {/* Tab 5: History */}
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

        {/* Tab 6: Kiosks */}
        {activeTab === 'kiosks' && (
          <section id="member-kiosks" className="account-section-card">
            <h2>Điểm đặt tủ kiosk</h2>
            <p>
              Hệ thống tủ kiosk thông minh của FloraBot được đặt tại các địa điểm trung tâm, trường
              đại học và khu dân cư cao cấp, giúp bạn chủ động nhận hoa tươi bất cứ lúc nào theo
              lịch hẹn.
            </p>
            <div style={{ marginBlock: '1.25rem' }}>
              <Link href="/tim-kiosk" className="button button-primary">
                Tìm kiosk gần bạn nhất
              </Link>
            </div>
          </section>
        )}

        {/* Tab 7: Security */}
        {activeTab === 'security' && (
          <section id="member-security" className="account-section-card">
            <h2>Đổi mật khẩu</h2>
            <p>Sau khi đổi, bạn cần đăng nhập lại trên các thiết bị để đảm bảo tính an toàn.</p>
            <form
              noValidate
              onSubmit={passwords.handleSubmit(({ currentPassword, newPassword }) =>
                save({ currentPassword, newPassword }, true),
              )}
            >
              {(['currentPassword', 'newPassword', 'confirm'] as const).map((field, index) => (
                <div key={field}>
                  <label htmlFor={`security-${field}`}>
                    {['Mật khẩu hiện tại', 'Mật khẩu mới', 'Nhập lại mật khẩu mới'][index]}
                  </label>
                  <input
                    id={`security-${field}`}
                    type="password"
                    autoComplete={index === 0 ? 'current-password' : 'new-password'}
                    {...passwords.register(field, {
                      required: 'Nhập mật khẩu.',
                      validate:
                        index === 1
                          ? passwordRule
                          : index === 2
                            ? (value) =>
                                value === passwords.getValues('newPassword') ||
                                'Hai mật khẩu chưa khớp.'
                            : undefined,
                    })}
                    aria-describedby={`security-${field}-error`}
                    aria-invalid={!!passwords.formState.errors[field]}
                  />
                  <p id={`security-${field}-error`} className="error">
                    {passwords.formState.errors[field]?.message}
                  </p>
                </div>
              ))}
              <Button type="submit" disabled={busy}>
                Đổi mật khẩu và đăng nhập lại
              </Button>
            </form>
          </section>
        )}

        {/* Tab 8: Shop */}
        {activeTab === 'shop' && <MemberShop />}
      </main>
    </>
  );
}
