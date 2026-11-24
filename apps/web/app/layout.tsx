import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteFrame from '../src/shared/layout/SiteFrame';
import '@florabot/ui/tokens.css';
import '../src/features/marketing/fonts.css';
import '../src/shared/styles/site.css';
import '../src/shared/styles/interactions.css';

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
