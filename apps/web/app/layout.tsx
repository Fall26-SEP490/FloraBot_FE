import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteFrame from '../src/SiteFrame';
import '@florabot/ui/tokens.css';
import '../src/marketing/fonts.css';
import '../src/portal.css';
import '../src/member.css';
import '../src/workspace.css';
import '../src/dashboard-management.css';
import '../src/auth.css';
import '../src/marketing/landing.css';
import '../src/marketing/gallery.css';
import '../src/site.css';

export const metadata: Metadata = {
  title: 'FloraBot - Đặt hoa và quản lý cửa hàng',
  description: 'Đặt hoa, theo dõi đơn hàng và quản lý cửa hàng FloraBot.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
