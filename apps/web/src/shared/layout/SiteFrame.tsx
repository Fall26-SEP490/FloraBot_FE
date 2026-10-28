'use client';

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Flower2,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Store,
  User,
  X,
} from '@florabot/ui';
import { getRoleLabel } from '@/features/portal/config/roleRoutes';
import { workspaceBase } from '@/features/portal/config/workspaceSections';
import { logoutSession, queryClient, sessionQuery } from '@/shared/lib/api';

const navigation = [
  ['/', 'Trang chủ'],
  ['/dat-hoa', 'Sản phẩm hoa'],
  ['/huong-dan-dat-hoa', 'Cách đặt & nhận hoa'],
  ['/tim-kiosk', 'Vị trí tủ'],
] as const;

const workspaceLabels: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  OPERATIONS_MANAGER: 'Điều hành vận hành',
  TECHNICIAN: 'Công việc kỹ thuật',
  SELLER_STAFF: 'Công việc tại shop',
  STAFF: 'Khu vực làm việc',
};

export function SiteBrand({ className = 'site-brand', href = '/' }) {
  return (
    <Link className={className} href={href} aria-label="FloraBot — trang chủ">
      <Flower2 size={27} aria-hidden="true" />
      FloraBot<span aria-hidden="true">.</span>
    </Link>
  );
}

function SiteHeader() {
  const pathname = usePathname();
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const [openedAccountPath, setOpenedAccountPath] = useState<string | null>(null);
  const expanded = openedPath === pathname;
  const accountMenuOpen = openedAccountPath === pathname;
  const toggle = useRef<HTMLButtonElement>(null);
  const accountToggle = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useQuery({
    ...sessionQuery,
    enabled: ![
      '/dang-nhap',
      '/dang-ky',
      '/quen-mat-khau',
      '/dat-lai-mat-khau',
      '/admin/login',
      '/receipt',
      '/lich-su-mua',
    ].includes(pathname),
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });
  const accountLinks = session.data
    ? session.data.role === 'SELLER'
      ? [
          { href: '/seller', label: 'Quản lý shop', icon: 'shop' as const },
          { href: '/tai-khoan', label: 'Hoạt động mua hoa', icon: 'purchase' as const },
        ]
      : session.data.role === 'CUSTOMER'
        ? [{ href: '/tai-khoan', label: 'Hoạt động mua hoa', icon: 'purchase' as const }]
        : [
            {
              href: workspaceBase(session.data.role),
              label: workspaceLabels[session.data.role] ?? 'Khu vực làm việc',
              icon: 'workspace' as const,
            },
          ]
    : [];

  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const measure = () =>
      document.documentElement.style.setProperty(
        '--header-height',
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    let focusFrame: number | undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (accountToggle.current?.getAttribute('aria-expanded') === 'true') {
        setOpenedAccountPath(null);
        accountToggle.current.focus();
        return;
      }
      if (toggle.current?.getAttribute('aria-expanded') !== 'true') return;
      setOpenedPath(null);
      toggle.current.focus();
    };
    const revealFocus = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        element.contains(target) ||
        !target.matches(':focus-visible')
      )
        return;
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        if (!target.isConnected) return;
        const bounds = target.getBoundingClientRect();
        if (bounds.top < element.getBoundingClientRect().bottom || bounds.bottom > innerHeight) {
          target.scrollIntoView({
            block: target.id === 'main' ? 'start' : 'center',
            behavior: 'instant',
          });
        }
      });
    };
    observer.observe(element);
    element.addEventListener('keydown', closeOnEscape);
    document.addEventListener('focusin', revealFocus);
    measure();
    return () => {
      observer.disconnect();
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      element.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('focusin', revealFocus);
      document.documentElement.style.removeProperty('--header-height');
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (accountMenu.current?.contains(event.target as Node)) return;
      setOpenedAccountPath(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [accountMenuOpen]);

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await logoutSession();
      window.location.replace('/dang-nhap');
    } catch {
      setError('Chưa đăng xuất được. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <header ref={header} className="site-header florabot-header navigation-ready">
      <SiteBrand />
      <button
        ref={toggle}
        type="button"
        className="site-menu"
        aria-label="Menu"
        aria-controls="main-navigation"
        aria-expanded={expanded}
        onClick={() => {
          setOpenedAccountPath(null);
          setOpenedPath(expanded ? null : pathname);
        }}
      >
        {expanded ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />} Menu
      </button>
      {expanded && (
        <div className="site-nav-backdrop" onClick={() => setOpenedPath(null)} aria-hidden="true" />
      )}
      <nav id="main-navigation" aria-label="Điều hướng chính" className={expanded ? 'is-open' : ''}>
        {navigation.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={pathname === href ? 'page' : undefined}
            onClick={() => setOpenedPath(null)}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div ref={accountMenu} className="site-account">
        {session.data ? (
          <>
            <button
              ref={accountToggle}
              className="site-user-trigger"
              type="button"
              aria-label={`Mở menu người dùng của ${session.data.name}`}
              aria-controls="site-user-menu"
              aria-expanded={accountMenuOpen}
              onClick={() => {
                setOpenedPath(null);
                setOpenedAccountPath(accountMenuOpen ? null : pathname);
              }}
            >
              <span className="site-user-avatar" aria-hidden="true">
                {session.data.name.trim().slice(0, 1).toLocaleUpperCase('vi-VN') || 'F'}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {accountMenuOpen && (
              <div id="site-user-menu" className="site-user-menu" aria-label="Menu người dùng">
                <div className="site-user-summary">
                  <strong>{session.data.name}</strong>
                  <span>{getRoleLabel(session.data.role)}</span>
                </div>
                <div className="site-user-menu-links">
                  {accountLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      onClick={() => setOpenedAccountPath(null)}
                    >
                      {item.icon === 'shop' ? (
                        <Store size={17} aria-hidden="true" />
                      ) : item.icon === 'purchase' ? (
                        <Flower2 size={17} aria-hidden="true" />
                      ) : (
                        <LayoutDashboard size={17} aria-hidden="true" />
                      )}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <Link
                    href="/ho-so"
                    prefetch={false}
                    aria-current={pathname === '/ho-so' ? 'page' : undefined}
                    onClick={() => setOpenedAccountPath(null)}
                  >
                    <User size={17} aria-hidden="true" />
                    <span>Hồ sơ cá nhân</span>
                  </Link>
                </div>
                <button
                  className="site-user-logout"
                  type="button"
                  disabled={busy}
                  onClick={() => void logout()}
                >
                  <LogOut size={17} aria-hidden="true" />
                  <span>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <Link className="site-account-link" href="/dang-nhap" prefetch={false}>
            <LogIn size={16} aria-hidden="true" />
            <span>Đăng nhập</span>
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="site-header-error">
          {error}
        </p>
      )}
    </header>
  );
}

const SiteFooter = memo(function SiteFooter() {
  return (
    <footer className="site-footer florabot-footer">
      <div className="footer-container">
        <div className="footer-col footer-col-brand">
          <SiteBrand />
          <p className="footer-brand-desc">
            Nền tảng kết nối shop hoa địa phương và hệ thống tủ kiosk thông minh tự phục vụ. Nhận
            hoa giả theo lịch hẹn, theo dõi đơn và trao đổi trực tiếp với shop.
          </p>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Khám phá</h3>
          <nav aria-label="Khám phá FloraBot">
            <Link href="/ve-florabot" prefetch={false}>
              Về FloraBot
            </Link>
            <Link href="/dat-hoa" prefetch={false}>
              Sản phẩm hoa
            </Link>
            <Link href="/tim-kiosk" prefetch={false}>
              Vị trí tủ
            </Link>
            <a href="/kiosk/?preview=1">Xem thử màn hình kiosk</a>
          </nav>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Hỗ trợ</h3>
          <nav aria-label="Hỗ trợ khách hàng">
            <Link href="/huong-dan-dat-hoa" prefetch={false}>
              Cách đặt & nhận hoa
            </Link>
            <Link href="/lien-he" prefetch={false}>
              Liên hệ & hỗ trợ
            </Link>
            <Link href="/chinh-sach-rieng-tu" prefetch={false}>
              Chính sách riêng tư
            </Link>
            <Link href="/lich-su-mua" prefetch={false}>
              Biên nhận đã lưu
            </Link>
          </nav>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Dành cho shop</h3>
          <nav aria-label="Dành cho đối tác shop">
            <Link href="/tai-khoan" prefetch={false}>
              Tài khoản của bạn
            </Link>
            <Link href="/thue-kiosk" prefetch={false}>
              Thuê tủ kiosk
            </Link>
            <Link href="/seller" prefetch={false}>
              Kênh người bán
            </Link>
          </nav>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 FloraBot. Tươi mới từng khoảnh khắc.</p>
      </div>
    </footer>
  );
});

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const workspace =
    /^\/(admin|seller|staff|operations|technician|workspace)(\/|$)/.test(pathname) &&
    pathname !== '/admin/login';
  const frameClassName = ['site-frame', workspace ? 'site-frame-workspace' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={frameClassName}>
      <a className="skip-link" href="#main">
        Bỏ qua tới nội dung
      </a>
      {!workspace && <SiteHeader />}
      <div className="site-content">{children}</div>
      {!workspace && <SiteFooter />}
    </div>
  );
}

export default function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Frame>{children}</Frame>
    </QueryClientProvider>
  );
}
