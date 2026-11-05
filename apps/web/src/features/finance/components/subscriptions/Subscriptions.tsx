'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import type { KioskApplicationResponse } from '../../../installations/installations.types';
import { ApplicationRentalSummary } from '../../../kiosk-pricing/ApplicationRentalSummary';

export default function Subscriptions({ session }: { session: Session }) {
  const application = useQuery({
    queryKey: ['current-kiosk-application', session.id],
    queryFn: () => request<KioskApplicationResponse>('/member/kiosk-applications/current'),
  });
  return (
    <section id="subscriptions" tabIndex={-1}>
      <h2>Thuê kiosk</h2>
      <p>
        Phí thuê tính theo số ô Walk-in và Pre-order. Kỳ thuê 12 tháng bắt đầu từ ngày bàn giao.
      </p>
      {application.isPending && <p role="status">Đang tải hồ sơ thuê…</p>}
      {application.isError && (
        <div role="alert">
          <p>Chưa tải được hồ sơ thuê hiện tại.</p>
          <Button onClick={() => void application.refetch()}>Tải lại hồ sơ</Button>
        </div>
      )}
      {application.data && (
        <>
          <h3>Hồ sơ gần nhất</h3>
          <ApplicationRentalSummary application={application.data} />
        </>
      )}
      <Link href="/thue-kiosk" className="button button-primary">
        Xem hồ sơ hoặc thuê thêm kiosk
      </Link>{' '}
      <Link href="/seller/kiosks" className="button button-outline">
        Các kiosk của shop
      </Link>
      <p>
        Loại ô đã chốt được giữ cố định. Chưa hỗ trợ gia hạn trực tuyến; liên hệ FloraBot khi cần hỗ
        trợ kỳ thuê.
      </p>
    </section>
  );
}
