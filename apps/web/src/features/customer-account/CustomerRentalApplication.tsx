import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Button, Store } from '@florabot/ui';
import { ApiError, request, sessionQuery } from '@/shared/lib/api';
import type { KioskApplicationResponse } from '../installations/installations.types';
import { KIOSK_STATUS_LABELS } from '../installations/installations.constants';

export default function CustomerRentalApplication() {
  const session = useQuery(sessionQuery);
  const application = useQuery({
    queryKey: ['current-kiosk-application', session.data?.id],
    enabled: session.data?.role === 'CUSTOMER' && Boolean(session.data.id),
    queryFn: async () => {
      try {
        return await request<KioskApplicationResponse>('/member/kiosk-applications/current');
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  if (application.isSuccess && !application.data) {
    return (
      <div className="account-home-partner">
        <Store size={18} aria-hidden="true" />
        <span>Bạn muốn mở shop trên FloraBot?</span>
        <Link href="/thue-kiosk">
          Tìm hiểu thuê kiosk <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }
  const app = application.data;
  const awaitingPayment = app?.status === 'AWAITING_PAYMENT';
  return (
    <section
      className="account-rental"
      aria-labelledby="account-rental-title"
      aria-busy={application.isFetching}
    >
      <div className="account-rental-info">
        <h2 id="account-rental-title">Hồ sơ thuê kiosk</h2>
        {application.isPending ? (
          <p role="status">Đang kiểm tra hồ sơ thuê kiosk…</p>
        ) : application.isError ? (
          <div role="alert">
            <p>Chưa tải được hồ sơ thuê kiosk. Mở trang thuê kiosk hoặc thử lại.</p>
            <Button variant="outline" onClick={() => void application.refetch()}>
              Tải lại hồ sơ thuê
            </Button>
          </div>
        ) : app ? (
          <>
            <strong className="account-rental-shop">{app.shopName}</strong>
            <p>
              {KIOSK_STATUS_LABELS[app.status] || 'Xem trạng thái trong hồ sơ'}
              {awaitingPayment && (
                <>
                  {' '}
                  · <strong>{Number(app.annualFee).toLocaleString('vi-VN')} đ</strong>
                </>
              )}
            </p>
            {awaitingPayment && (
              <p className="account-rental-hint">
                Phí thuê kiosk cho shop, riêng với đơn mua hoa. Nếu đã trả tiền, mở hồ sơ để kiểm
                tra thanh toán.
              </p>
            )}
          </>
        ) : null}
      </div>
      <Link
        className={`button ${awaitingPayment ? 'button-primary' : 'button-outline'}`}
        href="/thue-kiosk"
      >
        {awaitingPayment ? 'Thanh toán thuê kiosk' : 'Xem hồ sơ thuê kiosk'}{' '}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
