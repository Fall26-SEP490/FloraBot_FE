import type { ReactNode } from 'react';
import './auth.css';
import Link from 'next/link';
import { Flower2 } from '@florabot/ui';
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
      <main id="main" className="auth-layout">
        <section className="auth-form-panel" aria-labelledby="auth-title">
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
            <h2>{staff ? 'Cùng chăm chút từng bó hoa.' : 'Gửi thương bằng hoa.'}</h2>
          </div>
          <img src={bouquet} alt="" width={960} height={960} />
        </aside>
      </main>
    </div>
  );
}
