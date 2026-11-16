import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from '@florabot/ui';
import { ApiError, request, sessionQuery } from '@/shared/lib/api';
import type { KioskApplicationResponse } from '../installations/installations.types';

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
  const app = application.data;
  if (app?.status !== 'AWAITING_PAYMENT') return null;
  return (
    <section
      className="account-rental"
      aria-labelledby="account-rental-title"
      aria-busy={application.isFetching}
    >
      <div className="account-rental-info">
        <h2 id="account-rental-title">Hồ sơ thuê kiosk</h2>
        <p>
          {app.shopName} · Chờ thanh toán phí thuê ·{' '}
          <strong>{Number(app.annualFee).toLocaleString('vi-VN')} đ</strong>
        </p>
      </div>
      <Link className="button button-primary" href="/thue-kiosk">
        Thanh toán thuê kiosk <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
