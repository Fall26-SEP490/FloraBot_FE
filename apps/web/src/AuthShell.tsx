import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Flower2 } from '@florabot/ui';
import bouquet from '../../../packages/ui/assets/flowers/pastelBouquet-960.webp';

export default function AuthShell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'staff';
}) {
  const staff = mode === 'staff';
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link className="auth-brand" href="/" aria-label="FloraBot — trang chủ">
          <Flower2 aria-hidden="true" size={28} strokeWidth={1.8} />
          FloraBot<span aria-hidden="true">.</span>
        </Link>
        <Link className="auth-home" href="/">
          Về trang chủ <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </header>
      <main id="main" className="auth-layout">
        <section className="auth-form-panel" aria-labelledby="auth-title">
          {(mode === 'login' || mode === 'register') && (
            <nav className="auth-tabs" aria-label="Tài khoản FloraBot">
              <Link href="/dang-nhap" aria-current={mode === 'login' ? 'page' : undefined}>
                Đăng nhập
              </Link>
              <Link href="/dang-ky" aria-current={mode === 'register' ? 'page' : undefined}>
                Đăng ký
              </Link>
            </nav>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <Link className="auth-back" href="/dang-nhap">
              Trở về đăng nhập
            </Link>
          )}
          {children}
        </section>
        <aside
          className="auth-garden"
          aria-label={staff ? 'Vận hành FloraBot' : 'Cùng FloraBot gửi thương'}
        >
          <div className="auth-garden-copy">
            <Flower2 aria-hidden="true" size={36} strokeWidth={1.4} />
            <h2>
              {staff ? 'Chăm từng bó hoa. Trọn từng lần nhận.' : 'Một bó hoa. Cả một lời thương.'}
            </h2>
            <p>
              {staff
                ? 'Theo dõi tủ hoa, tiếp nhận sự cố và hoàn thành công việc được giao.'
                : 'Chọn hoa theo ý bạn, để shop chăm chút. Hẹn một lần nhận, gửi một điều thân thương.'}
            </p>
          </div>
          <img src={bouquet} alt="" width={960} height={960} />
          <p className="auth-garden-caption">
            {staff ? 'Cùng giữ trải nghiệm nhận hoa trọn vẹn.' : 'Hoa bạn chọn. Dịp của riêng bạn.'}
          </p>
        </aside>
      </main>
      <footer className="auth-footer">
        <span>FloraBot · Hoa và những dịp gửi thương</span>
        <Link href="/chinh-sach-rieng-tu">Chính sách riêng tư</Link>
        <Link href="/lien-he">Liên hệ & hỗ trợ</Link>
      </footer>
    </div>
  );
}
