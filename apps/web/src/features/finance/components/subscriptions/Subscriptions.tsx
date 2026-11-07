'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MapPin } from '@florabot/ui';
import { ApiError, request, type Session } from '@/shared/lib/api';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import type { KioskApplicationResponse } from '../../../installations/installations.types';
import type { SellerKioskItem } from '../../../kiosk-management/kiosk-management.types';
import { ApplicationRentalSummary } from '../../../kiosk-pricing/ApplicationRentalSummary';
import { rentalMoney } from '../../../kiosk-pricing/kiosk-pricing';
import '../../styles/commerce-subscriptions.css';

type SubscriptionOverviewResponse = components['schemas']['SubscriptionOverviewResponse'];
type SubscriptionResponse = components['schemas']['SubscriptionResponse'];

interface KioskRenewalResponse {
  subscriptionId: string;
  kioskId: string;
  sellerId: string;
  amount: number;
  periodFrom: string;
  periodTo: string;
  status: string;
  paymentLinkPath: string;
}

interface RenewalPaymentLinkResponse {
  checkoutUrl?: string | null;
  status?: string;
}

const kioskStatusLabel: Record<string, string> = {
  ONLINE: 'Đang hoạt động',
  OFFLINE: 'Ngoại tuyến',
  MAINTENANCE: 'Đang bảo trì',
};

function KioskRenewalCard({
  kiosk,
  sellerId,
  subscriptions = [],
}: {
  kiosk: SellerKioskItem;
  sellerId: string;
  subscriptions?: SubscriptionResponse[];
}) {
  const [renewal, setRenewal] = useState<KioskRenewalResponse | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const activeSub = subscriptions.find((s) => s.kioskId === kiosk.id && s.status === 'ACTIVE');

  const createRenewal = useMutation({
    mutationFn: () =>
      request<KioskRenewalResponse>(`/me/kiosks/${kiosk.id}/renewals`, {}, true, 'POST'),
    onSuccess: (data) => {
      setRenewal(data);
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError ? err.message : 'Chưa tạo được yêu cầu gia hạn cho kiosk này.',
      );
    },
  });

  const createPaymentLink = useMutation({
    mutationFn: (subscriptionId: string) =>
      request<RenewalPaymentLinkResponse>(
        `/sellers/${sellerId}/subscriptions/${subscriptionId}/payment-link`,
        {},
        true,
        'POST',
      ),
    onSuccess: (data) => {
      setError('');
      if (data.checkoutUrl) {
        setCheckoutUrl(data.checkoutUrl);
      }
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError ? err.message : 'Chưa tạo được liên kết thanh toán gia hạn.',
      );
    },
  });

  return (
    <article className="subscription-kiosk-card">
      <div className="subscription-kiosk-main">
        <div className="subscription-kiosk-badges">
          <span className="subscription-kiosk-code">{kiosk.code}</span>
          <span className="subscription-kiosk-status" data-status={kiosk.status}>
            {kioskStatusLabel[kiosk.status] || kiosk.status}
          </span>
          {typeof kiosk.slotCount === 'number' && (
            <span className="subscription-kiosk-slots">{kiosk.slotCount} ô tủ</span>
          )}
        </div>
        <h3>{kiosk.name}</h3>
        {kiosk.address && (
          <p className="subscription-kiosk-address">
            <MapPin size={14} aria-hidden="true" />
            <span>{kiosk.address}</span>
          </p>
        )}
        {activeSub && (
          <p
            className="subscription-kiosk-contract-info"
            style={{ marginTop: '0.35rem', fontSize: '0.84rem', color: '#2d5a3f' }}
          >
            Hạn kỳ hiện tại:{' '}
            <strong>
              {new Date(activeSub.periodFrom).toLocaleDateString('vi-VN')} –{' '}
              {new Date(activeSub.periodTo).toLocaleDateString('vi-VN')}
            </strong>{' '}
            ({rentalMoney(activeSub.price)})
          </p>
        )}
      </div>

      <div className="subscription-kiosk-action">
        {!renewal ? (
          <Button
            type="button"
            variant="outline"
            disabled={createRenewal.isPending}
            onClick={() => createRenewal.mutate()}
          >
            {createRenewal.isPending ? 'Đang tạo kỳ gia hạn…' : 'Gia hạn thêm 12 tháng'}
          </Button>
        ) : (
          <div className="subscription-renewal-box">
            <div className="subscription-renewal-meta">
              <span>
                Kỳ mới:{' '}
                <strong>
                  {new Date(renewal.periodFrom).toLocaleDateString('vi-VN')} –{' '}
                  {new Date(renewal.periodTo).toLocaleDateString('vi-VN')}
                </strong>
              </span>
              <strong className="subscription-renewal-amount">{rentalMoney(renewal.amount)}</strong>
            </div>
            <div className="subscription-renewal-buttons">
              <Button
                type="button"
                disabled={createPaymentLink.isPending}
                onClick={() => createPaymentLink.mutate(renewal.subscriptionId)}
              >
                {createPaymentLink.isPending ? 'Đang tạo link…' : 'Thanh toán qua PayOS'}
              </Button>
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button-outline"
                >
                  Mở cổng PayOS ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="error subscription-kiosk-error">
          {error}
        </p>
      )}
    </article>
  );
}

export default function Subscriptions({ session }: { session: Session }) {
  const application = useQuery({
    queryKey: ['current-kiosk-application', session.id],
    queryFn: async () => {
      try {
        return await request<KioskApplicationResponse>('/member/kiosk-applications/current');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  const kiosks = useQuery({
    queryKey: ['seller-kiosks', session.sellerId],
    queryFn: async () => {
      try {
        return await request<SellerKioskItem[]>('/me/kiosks');
      } catch {
        return await request<SellerKioskItem[]>(`/sellers/${session.sellerId}/kiosks`);
      }
    },
    enabled: Boolean(session.sellerId),
  });

  const subscriptionsQuery = useQuery({
    queryKey: ['seller-subscriptions-overview', session.sellerId],
    queryFn: () =>
      request<SubscriptionOverviewResponse>(`/sellers/${session.sellerId}/subscriptions`),
    enabled: Boolean(session.sellerId),
  });

  const expiryText = session.packageExpiresAt
    ? new Date(`${session.packageExpiresAt}T00:00:00+07:00`).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : 'Theo từng tủ';

  const subList = subscriptionsQuery.data?.subscriptions ?? [];

  return (
    <section id="subscriptions" className="subscriptions business-panel" tabIndex={-1}>
      <div className="subscription-hero">
        <div>
          <h2>Gói thuê & gia hạn kiosk</h2>
          <p>
            Kỳ thuê 12 tháng tính theo tổng số ô của từng tủ. Bạn có thể gia hạn trực tuyến qua
            PayOS hoặc đăng ký thuê thêm kiosk mới.
          </p>
        </div>
        <div className="subscription-cta-group">
          <Link href="/thue-kiosk" className="button button-primary">
            Thuê thêm kiosk mới
          </Link>
          <Link href="/seller/kiosks" className="button button-outline">
            Quản lý vị trí tủ
          </Link>
        </div>
      </div>

      <div className="business-facts">
        <div>
          <span>Hạn kỳ thuê gần nhất</span>
          <strong>{expiryText}</strong>
        </div>
        <div>
          <span>Số kiosk đang vận hành</span>
          <strong>{kiosks.data ? `${kiosks.data.length} tủ` : '—'}</strong>
        </div>
        <div>
          <span>Chu kỳ gia hạn</span>
          <strong>12 tháng / kỳ</strong>
        </div>
      </div>

      {session.sellerId && (
        <div className="subscription-kiosk-section">
          <div className="subscription-section-head">
            <h3>Các kiosk đang thuê</h3>
            <span>Chọn tủ để khởi tạo kỳ gia hạn 12 tháng tiếp theo</span>
          </div>

          {kiosks.isPending && <p role="status">Đang tải danh sách kiosk của shop…</p>}
          {kiosks.isError && (
            <div role="alert" className="subscription-alert-box">
              <p>Chưa tải được danh sách kiosk của shop.</p>
              <Button variant="outline" onClick={() => void kiosks.refetch()}>
                Thử lại
              </Button>
            </div>
          )}
          {kiosks.data && kiosks.data.length === 0 && (
            <p className="seller-empty-state">Shop hiện chưa có kiosk nào đang hoạt động.</p>
          )}
          {kiosks.data && kiosks.data.length > 0 && (
            <div className="subscription-kiosk-list">
              {kiosks.data.map((kiosk) => (
                <KioskRenewalCard
                  key={kiosk.id}
                  kiosk={kiosk}
                  sellerId={session.sellerId!}
                  subscriptions={subList}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {session.sellerId && subList.length > 0 && (
        <div className="subscription-kiosk-section">
          <div className="subscription-section-head">
            <h3>Lịch sử hợp đồng thuê kiosk (Kỳ 12 tháng)</h3>
            <span>Hợp đồng năm gắn với từng kiosk đang vận hành</span>
          </div>
          <div className="business-table-scroll">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Kiosk</th>
                  <th>Kỳ thuê 12 tháng</th>
                  <th>Phí thuê</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {subList.map((sub) => {
                  const matchedKiosk = (kiosks.data ?? []).find((k) => k.id === sub.kioskId);
                  return (
                    <tr key={sub.id}>
                      <td>
                        <strong>
                          {matchedKiosk?.name || matchedKiosk?.code || sub.packageName || 'Kiosk'}
                        </strong>
                      </td>
                      <td>
                        {new Date(sub.periodFrom).toLocaleDateString('vi-VN')} –{' '}
                        {new Date(sub.periodTo).toLocaleDateString('vi-VN')}
                      </td>
                      <td>{rentalMoney(sub.price)}</td>
                      <td>
                        <span className="subscription-status" data-status={sub.status}>
                          {sub.status === 'ACTIVE'
                            ? 'Đang hiệu lực'
                            : sub.status === 'PENDING_PAYMENT'
                              ? 'Chờ thanh toán'
                              : sub.status === 'EXPIRED'
                                ? 'Hết hạn'
                                : sub.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {application.isError && (
        <div role="alert" className="subscription-alert-box">
          <p>Chưa tải được hồ sơ đăng ký thuê kiosk.</p>
          <Button variant="outline" onClick={() => void application.refetch()}>
            Tải lại hồ sơ
          </Button>
        </div>
      )}

      {application.data && (
        <div className="subscription-application-card">
          <h3>Hồ sơ đăng ký thuê gần nhất</h3>
          <ApplicationRentalSummary application={application.data} />
          <div style={{ marginTop: '0.85rem' }}>
            <Link href="/thue-kiosk" className="button button-outline">
              Xem hồ sơ hoặc thuê thêm kiosk
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
