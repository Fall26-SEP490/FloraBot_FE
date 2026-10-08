'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import '@florabot/ui/tokens.css';
import './fonts.css';
import './landing.css';
import './gallery.css';
const portal = '';
const navigation = [
  { href: '/', label: 'Trang chủ' },
  { href: '/ve-florabot', label: 'Về chúng tôi' },
  { href: '/dat-hoa', label: 'Sản phẩm hoa' },
  { href: '/huong-dan-dat-hoa', label: 'Cách đặt & nhận hoa' },
  { href: '/#vi-tri', label: 'Vị trí tủ' },
  { href: '/lien-he', label: 'Liên hệ' },
];
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const currentPath = usePathname();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = container.current?.querySelector<HTMLElement>('.site-header');
    const toggle = header?.querySelector<HTMLButtonElement>('.navigation-toggle');
    if (!header || !toggle) return;
    toggle.hidden = false;
    header.classList.add('navigation-ready');
    const close = () => toggle.setAttribute('aria-expanded', 'false');
    const click = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest('.navigation-toggle'))
        toggle.setAttribute(
          'aria-expanded',
          String(toggle.getAttribute('aria-expanded') !== 'true'),
        );
      else if (target.closest('nav a')) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        close();
        toggle.focus();
      }
    };
    const measure = () =>
      document.documentElement.style.setProperty(
        '--header-height',
        `${header.getBoundingClientRect().height}px`,
      );
    const revealFocus = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        header.contains(target) ||
        !target.matches(':focus-visible')
      )
        return;
      const bounds = target.getBoundingClientRect();
      if (bounds.top < header.getBoundingClientRect().bottom || bounds.bottom > innerHeight) {
        target.scrollIntoView({
          block: target.id === 'main' ? 'start' : 'center',
          behavior: 'instant',
        });
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    header.addEventListener('click', click);
    header.addEventListener('keydown', key);
    document.addEventListener('focusin', revealFocus);
    return () => {
      observer.disconnect();
      header.removeEventListener('click', click);
      header.removeEventListener('keydown', key);
      document.removeEventListener('focusin', revealFocus);
    };
  }, []);
  return (
    <div ref={container} className="marketing-site">
      <a className="skip-link" href="#main">
        Bỏ qua tới nội dung
      </a>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="FloraBot — trang chủ">
          FloraBot<span className="brand-dot" aria-hidden="true"></span>
        </a>
        <button
          className="navigation-toggle"
          type="button"
          aria-expanded="false"
          aria-controls="main-navigation"
          hidden
        >
          Menu{' '}
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        <nav id="main-navigation" aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.href === currentPath ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-account">
          <a className="shop-entry" href="/#goi-thue">
            Dành cho shop
          </a>
          <a href={`${portal}/dang-nhap`} className="header-cta">
            Đăng nhập
          </a>
        </div>
      </header>
      {children}

      <footer className="site-footer">
        <div>
          <a className="wordmark" href="/">
            FloraBot<span className="brand-dot" aria-hidden="true"></span>
          </a>
          <p>Chọn hoa theo ý bạn. Nhận tại tủ theo lịch hẹn.</p>
          <a href="/ve-florabot">Tìm hiểu về FloraBot</a>
        </div>
        <div>
          <a href={`${portal}/dat-hoa`}>Sản phẩm hoa</a>
          <a href="/huong-dan-dat-hoa">Hướng dẫn đặt & nhận hoa</a>
          <a href="/lien-he">Liên hệ & hỗ trợ</a>
          <a href="/chinh-sach-rieng-tu">Chính sách riêng tư</a>
          <a href="/#dang-ky">Tư vấn dành cho shop</a>
          <a href={`${portal}/dang-nhap`}>Cổng quản lý shop</a>
          <a href="/lich-su-mua">Biên nhận đã lưu</a>
        </div>
        <div className="footer-note">
          <span className="context-label">FloraBot · Hoa và những dịp gửi thương</span>
        </div>
      </footer>
    </div>
  );
}
