import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'FloraBot - Đặt hoa và quản lý cửa hàng',
  description: 'Đặt hoa, theo dõi đơn hàng và quản lý cửa hàng FloraBot.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
