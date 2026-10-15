import type { Metadata } from 'next';
import CustomerKioskLocator from '../../src/CustomerKioskLocator';

export const metadata: Metadata = {
  title: 'Tìm kiosk nhận hoa | FloraBot',
  description: 'Tìm kiếm tủ kiosk FloraBot gần bạn nhất để nhận hoa tiện lợi và nhanh chóng.',
};

export default function TimKioskPage() {
  return <CustomerKioskLocator />;
}
