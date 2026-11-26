'use client';

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ClipboardList, Flower2, LogIn, MapPin, Menu, Store, X } from '@florabot/ui';
import { SiteSupport } from './SiteSupport';
import FormFeedback from '@/shared/components/FormFeedback';
import { workspaceBase } from '@/features/portal/config/workspaceSections';
import { getRoleLabel } from '@/features/portal/config/roleRoutes';
import {
  sellerShopProfileQuery,
  shopAccountName,
} from '@/features/profile/seller-shop-profile.api';
import { UserMenu, type UserMenuLink } from '@/shared/components/UserMenu';
import { logoutSession, queryClient, sessionQuery } from '@/shared/lib/api';

const navigation = [
  ['/', 'Trang chủ', Store],
  ['/dat-hoa', 'Hoa đặt trước', Flower2],
  ['/huong-dan-dat-hoa', 'Cách đặt & nhận hoa', ClipboardList],
  ['/tim-kiosk', 'Vị trí tủ', MapPin],
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
      <Image src="/flora-rose-logo.webp" alt="" width={54} height={64} unoptimized />
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
  const header = useRef<HTMLElement>(null);
  function currentPage(href: string) {
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
      ? 'page'
      : undefined;
  }
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
      '/phan-anh',
      '/lich-su-mua',
    ].includes(pathname),
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });
  const shop = useQuery(sellerShopProfileQuery(session.data));
  const accountLinks: UserMenuLink[] = session.data
    ? [
        {
          href: '/ho-so',
          label: session.data.role === 'CUSTOMER' ? 'Hồ sơ' : 'Hồ sơ cá nhân',
          icon: 'profile',
        },
        ...(session.data.role === 'SELLER'
          ? [{ href: '/seller', label: 'Quản lý shop', icon: 'shop' as const }]
          : session.data.role === 'CUSTOMER'
            ? []
            : [
                {
                  href: workspaceBase(session.data.role),
                  label: workspaceLabels[session.data.role] ?? 'Khu vực làm việc',
                  icon: 'workspace' as const,
                },
              ]),
        ...(session.data.role === 'CUSTOMER'
          ? [
              { href: '/tai-khoan#web-orders', label: 'Đơn hàng', icon: 'orders' as const },
              { href: '/tai-khoan#member-chats', label: 'Tin nhắn', icon: 'chats' as const },
            ]
          : []),
      ]
    : [];

  useEffect(() => {
    if (!expanded && !accountMenuOpen) return;
    const handleScroll = () => {
      setOpenedPath(null);
      setOpenedAccountPath(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [expanded, accountMenuOpen]);

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
      if (event.key !== 'Escape' || toggle.current?.getAttribute('aria-expanded') !== 'true')
        return;
      setOpenedPath(null);
      toggle.current.focus();
    };
    const revealFocus = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        element.contains(target) ||
        target.closest('[aria-modal="true"]') ||
        !target.matches(':focus-visible')
      )
        return;
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        if (!target.isConnected) return;
        const bounds = target.getBoundingClientRect();
        const viewportBottom = innerHeight;
        if (bounds.top < element.getBoundingClientRect().bottom || bounds.bottom > viewportBottom) {
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
      {/* Tầng 1: Dải thông báo đen sang trọng phong cách Laflora */}
      <div className="site-announcement-bar" role="region" aria-label="Thông báo đầu trang">
        <span>FloraBot · Đặt hoa từ shop, nhận tại kiosk</span>
      </div>

      {/* Tầng 2: Main Bar với Logo bên trái, Menu ở giữa, Tài khoản bên phải (ngang hàng) */}
      <div className="site-header-main">
        <div className="site-header-left">
          <SiteBrand />
        </div>

        {/* Menu danh mục ngang - nằm giữa trên Desktop */}
        <nav
          id="main-navigation"
          aria-label="Điều hướng chính"
          className={expanded ? 'is-open' : ''}
        >
          <div className="site-nav-inner">
            {navigation.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-current={currentPage(href)}
                onClick={() => setOpenedPath(null)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="site-header-right">
          {session.data ? (
            <UserMenu
              className="site-account"
              menuId="site-user-menu"
              name={shopAccountName(session.data, shop.data)}
              roleLabel={getRoleLabel(session.data.role)}
              links={accountLinks}
              busy={busy}
              onLogout={() => void logout()}
              open={accountMenuOpen}
              onOpen={() => setOpenedPath(null)}
              onOpenChange={(open) => setOpenedAccountPath(open ? pathname : null)}
            />
          ) : (
            <div className="site-account">
              <Link className="site-account-link" href="/dang-nhap" prefetch={false}>
                <LogIn size={15} aria-hidden="true" />
                <span>Đăng nhập</span>
              </Link>
            </div>
          )}

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
            {expanded ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}{' '}
            <span className="site-menu-label">Menu</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="site-nav-backdrop" onClick={() => setOpenedPath(null)} aria-hidden="true" />
      )}

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
            hoa theo lịch hẹn, theo dõi đơn và trao đổi trực tiếp với shop.
          </p>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Khám phá</h3>
          <nav aria-label="Khám phá FloraBot">
            <Link href="/ve-florabot" prefetch={false}>
              Về FloraBot
            </Link>
            <Link href="/dat-hoa" prefetch={false}>
              Hoa đặt trước
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
              Chính sách bảo mật
            </Link>
          </nav>
        </div>
        <div className="footer-col">
          <h3 className="footer-heading">Dành cho shop</h3>
          <nav aria-label="Dành cho đối tác shop">
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
  const authSurface = ['/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau'].includes(
    pathname,
  );
  const workspace =
    /^\/(admin|seller|staff|operations|technician|workspace)(\/|$)/.test(pathname) &&
    pathname !== '/admin/login';
  const customerSurface =
    pathname === '/ho-so' || pathname === '/tai-khoan' || pathname.startsWith('/dat-hoa/');
  const frameClassName = [
    'site-frame',
    workspace ? 'site-frame-workspace' : '',
    customerSurface ? 'site-frame-customer' : '',
    ['/', '/dat-hoa', '/tim-kiosk'].includes(pathname) || pathname.startsWith('/dat-hoa/cua-hang/')
      ? 'site-frame-botanical'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={frameClassName}>
      <a className="skip-link" href="#main">
        Bỏ qua tới nội dung
      </a>
      {!workspace &&
        (authSurface ? (
          <header className="auth-frame-header">
            <SiteBrand />
            <Link href="/">Về trang chủ</Link>
          </header>
        ) : (
          <SiteHeader />
        ))}
      <div className="site-content">{children}</div>
      {!workspace &&
        (authSurface ? (
          <footer className="auth-frame-footer">
            <Link href="/lien-he">Cần hỗ trợ?</Link>
            <Link href="/chinh-sach-rieng-tu">Chính sách bảo mật</Link>
          </footer>
        ) : (
          <SiteFooter />
        ))}
      <SiteSupport />
    </div>
  );
}

export default function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FormFeedback />
      <Frame>{children}</Frame>
    </QueryClientProvider>
  );
}
