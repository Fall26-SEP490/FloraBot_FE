import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = {
  title: 'Đăng ký thuê Kiosk hoa | FloraBot',
  description:
    'Đăng ký thuê kiosk hoa thông minh trọn gói hàng năm với 2 phân vùng ô vãng lai và đặt trước.',
};

export default function ThueKioskPage() {
  return <PortalClient screen="thue-kiosk" />;
}
