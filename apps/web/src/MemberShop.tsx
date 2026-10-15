'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, Boxes, ArrowRight, RefreshCw } from '@florabot/ui';
import { ApiError, request, sessionQuery } from './api';
import type { KioskApplicationResponse } from './kioskApplicationTypes';
import { KIOSK_STATUS_LABELS } from './kioskApplicationTypes';

export default function MemberShop() {
  const session = useQuery(sessionQuery);

  const currentApp = useQuery({
    queryKey: ['current-kiosk-application', session.data?.id],
    queryFn: async () => {
      try {
        return await request<KioskApplicationResponse>('/member/kiosk-applications/current');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!session.data,
  });

  return (
    <section id="member-shop" aria-labelledby="member-shop-title">
      <h2 id="member-shop-title">Cùng FloraBot mở shop hoa</h2>

      {session.isPending || (!!session.data && currentApp.isLoading) ? (
        <p role="status">
          <RefreshCw className="spin" size={16} aria-hidden="true" /> Đang kiểm tra thông tin shop…
        </p>
      ) : session.isError ? (
        <>
          <p role="alert">Chưa kiểm tra được shop của bạn.</p>
          <Button onClick={() => void session.refetch()}>Thử lại</Button>
        </>
      ) : session.data.sellerId ? (
        <div className="member-shop-existing">
          <p>Bạn có thể mua hoa và quản lý shop bằng tài khoản này.</p>
          <Link href="/seller" className="button button-primary">
            Vào shop của bạn
          </Link>
        </div>
      ) : currentApp.isError ? (
        <>
          <p role="alert">Chưa tải được hồ sơ thuê kiosk từ máy chủ.</p>
          <Button onClick={() => void currentApp.refetch()}>Thử lại</Button>
        </>
      ) : currentApp.data &&
        currentApp.data.status !== 'CANCELLED' &&
        currentApp.data.status !== 'REJECTED' &&
        currentApp.data.status !== 'REFUNDED' ? (
        <div className="member-shop-in-progress">
          <p>
            Bạn đang có một hồ sơ đăng ký thuê kiosk hoa:{' '}
            <strong>{currentApp.data.shopName}</strong> ( Gói: {currentApp.data.packageName}).
          </p>
          <p>
            Trạng thái hiện tại:{' '}
            <strong>{KIOSK_STATUS_LABELS[currentApp.data.status] || currentApp.data.status}</strong>
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link href="/thue-kiosk" className="button button-primary">
              <ArrowRight size={18} aria-hidden="true" />
              Xem tiến độ hồ sơ thuê kiosk
            </Link>
          </div>
        </div>
      ) : (
        <div className="member-shop-cta-box">
          <p>
            Trở thành Chủ shop hoa FloraBot thông qua mô hình kiosk thông minh 2 phân vùng (vãng lai
            và đặt trước). Trọn gói thuê tính theo năm, bắt đầu từ ngày nghiệm thu bàn giao thực tế
            tại điểm đặt.
          </p>
          <ul className="member-shop-perks">
            <li>
              <Boxes size={18} aria-hidden="true" />
              <span>
                Các gói Trial (2 ô), Pro (8 ô), Max (12 ô) với chi phí trọn gói hàng năm minh bạch.
              </span>
            </li>
            <li>
              <span>
                Giữ nguyên tài khoản thành viên, lịch sử mua hoa và điểm tích lũy của bạn.
              </span>
            </li>
            <li>
              <span>
                Kỹ thuật viên FloraBot trực tiếp khảo sát, lắp ráp và bàn giao tủ tại điểm.
              </span>
            </li>
          </ul>
          <div style={{ marginTop: '1.25rem' }}>
            <Link
              href="/thue-kiosk"
              className="button button-primary"
              id="open-kiosk-application-link"
            >
              Khám phá các gói & Nộp hồ sơ thuê kiosk
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
