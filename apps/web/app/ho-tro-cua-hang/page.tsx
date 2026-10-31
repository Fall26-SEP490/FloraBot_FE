import type { Metadata } from 'next';
import KioskShopSupport from '../../src/features/chat/KioskShopSupport';

export const metadata: Metadata = {
  title: 'Hỗ trợ cửa hàng hoa | FloraBot',
  robots: { index: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kiosk?: string | string[] }>;
}) {
  const { kiosk } = await searchParams;
  if (
    typeof kiosk !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kiosk)
  ) {
    return (
      <main id="main">
        <h1>Mã tủ chưa hợp lệ</h1>
        <p>Vui lòng quét lại QR hỗ trợ trên màn hình tủ.</p>
      </main>
    );
  }
  return <KioskShopSupport kioskId={kiosk} />;
}
