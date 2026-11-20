'use client';
import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import { Modal, ConfirmDialog } from '@/shared/components/Modal';
import { createPortal } from 'react-dom';
import '../../styles/seller-rental.css';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CheckCircle2, MapPin } from '@florabot/ui';
import { ApiError, request, type Session } from '@/shared/lib/api';
import PayosCheckout from '@/shared/components/PayosCheckout';
import { validatePayosCheckoutUrl } from '@/shared/lib/payos-checkout';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';

import type { SellerKioskItem } from '../../../kiosk-management/kiosk-management.types';

import { rentalMoney } from '../../../kiosk-pricing/kiosk-pricing';
import { rememberPaymentReturn } from '../../../orders/payment-return';
import '../../styles/commerce-subscriptions.css';

type SubscriptionOverviewResponse = components['schemas']['SubscriptionOverviewResponse'];
type SubscriptionResponse = components['schemas']['SubscriptionResponse'];

type KioskRenewalResponse = components['schemas']['KioskRenewalResponse'];
type RenewalPaymentLinkResponse = components['schemas']['PaymentLinkResponse'];

const kioskStatusLabel: Record<string, string> = {
  ONLINE: 'Đang hoạt động',
  OFFLINE: 'Ngoại tuyến',
  MAINTENANCE: 'Đang bảo trì',
};

const subscriptionStatusLabel: Record<string, string> = {
  ACTIVE: 'Đang hiệu lực',
  PENDING_PAYMENT: 'Chờ thanh toán',
  EXPIRED: 'Hết hạn',
  PAST_DUE: 'Quá hạn',
  CANCELLED: 'Đã hủy',
  TERMINATED: 'Đã chấm dứt',
};

function KioskRenewalCard({
  kiosk,
  sellerId,
  userId,
  subscriptions = [],
  subscriptionsReady,
  returnedRenewalId,
  onRefresh,
}: {
  kiosk: SellerKioskItem;
  sellerId: string;
  userId: string;
  subscriptions?: SubscriptionResponse[];
  subscriptionsReady: boolean;
  returnedRenewalId: string | null;
  onRefresh: () => Promise<SubscriptionResponse[]>;
}) {
  const [payment, setPayment] = useState<{
    subscriptionId: string;
    data: RenewalPaymentLinkResponse;
  } | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<'confirmed' | 'cancelled' | null>(null);
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null);
  const [issuedRenewalIds, setIssuedRenewalIds] = useState<string[]>([]);
  const renewal = subscriptions.find(
    (s) => s.kioskId === kiosk.id && s.status === 'PENDING_PAYMENT',
  );
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNotice, setCancelNotice] = useState('');
  const cancelRenewal = useMutation({
    mutationFn: (id: string) =>
      request(`/sellers/${sellerId}/subscriptions/${id}/cancel`, undefined, false, 'POST'),
    onSuccess: async () => {
      setCancelOpen(false);
      setOpenPaymentId(null);
      setPayment(null);
      setCancelNotice('Đã hủy kỳ gia hạn. Kỳ thuê hiện tại giữ nguyên.');
      await onRefresh();
    },
    onError: async (cause: unknown) => {
      setCancelOpen(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Chưa xác nhận được việc hủy. Tải lại kỳ thuê để kiểm tra.',
      );
      await onRefresh().catch(() => undefined);
    },
  });

  const currentSub = subscriptions.find(
    (s) => s.kioskId === kiosk.id && (s.status === 'ACTIVE' || s.status === 'PAST_DUE'),
  );
  const activeReturn = subscriptions.find(
    (s) => s.kioskId === kiosk.id && s.id === returnedRenewalId,
  );
  const card = useRef<HTMLElement>(null);
  const showingPayment = Boolean(renewal && openPaymentId === renewal.id);
  const paymentWasOpen = useRef(false);
  const returned = Boolean(activeReturn);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returnDismissed, setReturnDismissed] = useState(false);
  useEffect(() => {
    if (returned) card.current?.focus();
  }, [returned]);
  useEffect(() => {
    if (paymentWasOpen.current && !showingPayment) card.current?.focus({ preventScroll: true });
    paymentWasOpen.current = showingPayment;
  }, [showingPayment]);

  const createRenewal = useMutation({
    mutationFn: () =>
      request<KioskRenewalResponse>(`/me/kiosks/${kiosk.id}/renewals`, undefined, true, 'POST'),
    onSuccess: async () => {
      setError('');
      await onRefresh();
    },
    onError: async (err: unknown) => {
      await onRefresh();
      setError(
        err instanceof ApiError ? err.message : 'Chưa tạo được yêu cầu gia hạn cho kiosk này.',
      );
    },
  });

  const createPaymentLink = useMutation({
    mutationFn: (subscriptionId: string) =>
      request<RenewalPaymentLinkResponse>(
        `/sellers/${sellerId}/subscriptions/${subscriptionId}/payment-link`,
        undefined,
        true,
        'POST',
      ),
    onSuccess: (data, subscriptionId) => {
      const validation = validatePayosCheckoutUrl(data.checkoutUrl || '');
      if (!validation.valid || !validation.url) {
        setError(
          validation.error || 'Chưa nhận được liên kết thanh toán hợp lệ. Vui lòng thử lại.',
        );
        return;
      }
      setError('');
      setPaymentOutcome(null);
      setIssuedRenewalIds((current) =>
        current.includes(subscriptionId) ? current : [...current, subscriptionId],
      );
      rememberPaymentReturn(userId, data.orderCode, {
        kind: 'renewal',
        resourceId: subscriptionId,
        kioskId: kiosk.id,
      });
      setPayment({ subscriptionId, data: { ...data, checkoutUrl: validation.url } });
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError ? err.message : 'Chưa tạo được liên kết thanh toán gia hạn.',
      );
    },
  });

  return (
    <>
      <tr
        className="rental-data-row"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            setDetailOpen(true);
          }
        }}
      >
        <td>
          <strong>{kiosk.name || kiosk.code}</strong>
          <small>Mã: {kiosk.code}</small>
        </td>
        <td>{kiosk.slotCount ?? '—'}</td>
        <td>
          {currentSub
            ? `${new Date(currentSub.periodTo).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
            : '—'}
        </td>
        <td>{currentSub ? rentalMoney(currentSub.price) : '—'}</td>
        <td>
          <span
            className="subscription-status"
            data-status={renewal ? 'PENDING_PAYMENT' : currentSub?.status}
          >
            {renewal
              ? 'Chờ thanh toán'
              : currentSub
                ? subscriptionStatusLabel[currentSub.status] || currentSub.status
                : 'Chưa có kỳ thuê'}
          </span>
        </td>
        <td>
          <button
            type="button"
            className="button button-outline"
            onClick={() => setDetailOpen(true)}
          >
            {renewal ? 'Thanh toán' : 'Gia hạn'}
          </button>
        </td>
      </tr>
      {(detailOpen || (returned && !returnDismissed)) &&
        createPortal(
          <Modal
            open
            title={`Kỳ thuê: ${kiosk.name || kiosk.code}`}
            size="lg"
            className="rental-detail-modal"
            closeDisabled={cancelRenewal.isPending}
            onClose={() => {
              setDetailOpen(false);
              setReturnDismissed(true);
            }}
          >
            <article
              id={`renewal-${kiosk.id}`}
              ref={card}
              tabIndex={-1}
              className="subscription-kiosk-card"
              aria-label={kiosk.name || kiosk.code}
            >
              <div className="subscription-kiosk-main">
                <h3>{kiosk.name || kiosk.code}</h3>
                <div className="subscription-kiosk-badges">
                  <span className="subscription-kiosk-code">Mã: {kiosk.code}</span>
                  <span className="subscription-kiosk-status" data-status={kiosk.status}>
                    {kioskStatusLabel[kiosk.status] || kiosk.status}
                  </span>
                  {typeof kiosk.slotCount === 'number' && (
                    <span className="subscription-kiosk-slots">{kiosk.slotCount} ô tủ</span>
                  )}
                </div>
                {activeReturn && (
                  <p role="status">
                    {activeReturn.status === 'ACTIVE' && (
                      <CheckCircle2 className="payos-confirmed-icon" size={16} aria-hidden="true" />
                    )}
                    {activeReturn.status === 'ACTIVE'
                      ? 'Đã thanh toán. Kỳ gia hạn của kiosk đã được cập nhật.'
                      : activeReturn.status === 'PENDING_PAYMENT'
                        ? 'Đang chờ xác nhận thanh toán gia hạn. Nếu đã chuyển khoản, đừng thanh toán lại.'
                        : 'Kỳ thuê này đã kết thúc hoặc không còn chờ thanh toán.'}
                  </p>
                )}
                {kiosk.address && (
                  <p className="subscription-kiosk-address">
                    <MapPin size={14} aria-hidden="true" />
                    <span>{kiosk.address}</span>
                  </p>
                )}
                {currentSub && (
                  <p
                    className="subscription-kiosk-contract-info"
                    style={{
                      marginTop: '0.35rem',
                      fontSize: '0.84rem',
                      color: currentSub.status === 'PAST_DUE' ? '#a81c1c' : '#2d5a3f',
                    }}
                  >
                    {currentSub.status === 'PAST_DUE'
                      ? 'Kỳ thuê đã hết hạn: '
                      : 'Hạn kỳ hiện tại: '}
                    <strong>
                      {new Date(currentSub.periodFrom).toLocaleDateString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}{' '}
                      –{' '}
                      {new Date(currentSub.periodTo).toLocaleDateString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </strong>{' '}
                    ({rentalMoney(currentSub.price)})
                  </p>
                )}
              </div>

              <div className="subscription-kiosk-action">
                {!subscriptionsReady && (
                  <IconActionButton
                    action="reload"
                    label="Tải lại kỳ thuê trong chi tiết"
                    onClick={onRefresh}
                  />
                )}
                {!renewal ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!subscriptionsReady || createRenewal.isPending}
                    onClick={() => createRenewal.mutate()}
                  >
                    {createRenewal.isPending ? 'Đang tạo kỳ gia hạn…' : 'Gia hạn thêm 12 tháng'}
                  </Button>
                ) : (
                  <div className="subscription-renewal-box">
                    <strong>Đang chờ thanh toán gia hạn</strong>
                    <div className="subscription-renewal-meta">
                      <span>
                        Kỳ mới:{' '}
                        <strong>
                          {new Date(renewal.periodFrom).toLocaleDateString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })}{' '}
                          –{' '}
                          {new Date(renewal.periodTo).toLocaleDateString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })}
                        </strong>
                      </span>
                      <strong className="subscription-renewal-amount">
                        {rentalMoney(renewal.price)}
                      </strong>
                    </div>
                    <div className="subscription-renewal-buttons">
                      <Button
                        type="button"
                        variant="outline"
                        className="rental-cancel-renewal"
                        disabled={
                          cancelRenewal.isPending ||
                          createPaymentLink.isPending ||
                          !subscriptionsReady
                        }
                        onClick={() => setCancelOpen(true)}
                      >
                        Hủy gia hạn
                      </Button>
                      <Button
                        type="button"
                        disabled={createPaymentLink.isPending || cancelRenewal.isPending}
                        onClick={() => {
                          setOpenPaymentId(renewal.id);
                          setPayment(null);
                          setError('');
                          createPaymentLink.mutate(renewal.id);
                        }}
                      >
                        {createPaymentLink.isPending ? 'Đang tải mã QR…' : 'Tiếp tục thanh toán'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {cancelNotice && <p role="status">{cancelNotice}</p>}
              {renewal && showingPayment && (
                <PayosCheckout
                  checkoutUrl={payment?.data.checkoutUrl}
                  qrCode={payment?.data.qrCode}
                  amount={payment?.data.amount ?? renewal.price}
                  title="Thanh toán gia hạn kiosk"
                  description={kiosk.name || kiosk.code}
                  recipientName={payment?.data.recipientName}
                  recipientAccountMasked={payment?.data.recipientAccountMasked}
                  onRetryQr={() => createPaymentLink.mutate(renewal.id)}
                  isLoadingQr={createPaymentLink.isPending}
                  qrError={error}
                  allowStatusCheck={issuedRenewalIds.includes(renewal.id)}
                  onClose={() => setOpenPaymentId(null)}
                  onRefresh={async () => {
                    const rows = await onRefresh();
                    const updated = rows.find((s) => s.id === renewal.id);
                    if (!updated) throw new Error('Renewal not found');
                    if (updated.status === 'ACTIVE') setPaymentOutcome('confirmed');
                    if (updated.status === 'CANCELLED') setPaymentOutcome('cancelled');
                    return updated.status !== 'PENDING_PAYMENT';
                  }}
                />
              )}
              {paymentOutcome &&
                (paymentOutcome === 'cancelled' || activeReturn?.id !== openPaymentId) && (
                  <p role="status">
                    {paymentOutcome === 'confirmed' ? (
                      <>
                        <CheckCircle2
                          className="payos-confirmed-icon"
                          size={16}
                          aria-hidden="true"
                        />
                        Đã thanh toán. Kỳ gia hạn của kiosk đã được cập nhật.
                      </>
                    ) : (
                      'Kỳ gia hạn đã bị hủy. Kiểm tra lịch sử nếu bạn đã chuyển khoản.'
                    )}
                  </p>
                )}
              {error && !showingPayment && (
                <p role="alert" className="error subscription-kiosk-error">
                  {error}
                </p>
              )}
            </article>
          </Modal>,
          document.body,
        )}
      {cancelOpen &&
        renewal &&
        createPortal(
          <ConfirmDialog
            open
            title="Hủy kỳ gia hạn?"
            description="Chỉ hủy kỳ gia hạn chưa thanh toán. Kỳ thuê hiện tại giữ nguyên. Nếu đã chuyển tiền, hãy kiểm tra thanh toán trước."
            confirmLabel="Hủy gia hạn"
            pending={cancelRenewal.isPending}
            onCancel={() => setCancelOpen(false)}
            onConfirm={() => cancelRenewal.mutate(renewal.id)}
          />,
          document.body,
        )}
    </>
  );
}

export default function Subscriptions({ session }: { session: Session }) {
  const returnedRenewalId = useSearchParams().get('renewalId');
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
    refetchInterval: (q) =>
      q.state.data?.subscriptions.some(
        (s) => s.id === returnedRenewalId && s.status === 'PENDING_PAYMENT',
      )
        ? 5_000
        : false,
  });

  const subList = subscriptionsQuery.data?.subscriptions ?? [];
  const nearestExpiry = subList
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => s.periodTo)
    .sort()[0];
  const expiryText = nearestExpiry
    ? new Date(nearestExpiry).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Theo từng tủ';

  return (
    <RefreshRegion className="seller-rental">
      <section id="subscriptions" className="subscriptions business-panel" tabIndex={-1}>
        <div className="subscription-hero">
          <div>
            <h2>Kỳ thuê kiosk</h2>
          </div>
          <div className="subscription-cta-group">
            <Link href="/thue-kiosk" className="button button-primary">
              Thuê thêm kiosk mới
            </Link>
            <IconActionButton
              action="reload"
              label="Làm mới danh sách kiosk"
              disabled={kiosks.isFetching || subscriptionsQuery.isFetching}
              onClick={() => Promise.all([kiosks.refetch(), subscriptionsQuery.refetch()])}
            />
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
            {subscriptionsQuery.isError && (
              <div role="alert">
                <p>Chưa tải được kỳ thuê hiện tại. Tải lại để tiếp tục gia hạn.</p>
                <IconActionButton
                  onClick={() => subscriptionsQuery.refetch()}
                  action="reload"
                  label="Tải lại kỳ thuê"
                />
              </div>
            )}
            {subscriptionsQuery.isPending && (
              <p role="status">Đang kiểm tra kỳ thuê và yêu cầu gia hạn…</p>
            )}
            {kiosks.data && kiosks.data.length > 0 && (
              <div className="business-table-scroll">
                <table className="business-table rental-data-table">
                  <thead>
                    <tr>
                      <th>Kiosk</th>
                      <th>Số ô</th>
                      <th>Ngày hết hạn</th>
                      <th>Phí kỳ thuê</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kiosks.data.map((kiosk) => (
                      <KioskRenewalCard
                        key={kiosk.id}
                        kiosk={kiosk}
                        sellerId={session.sellerId!}
                        userId={session.id}
                        subscriptions={subList}
                        subscriptionsReady={subscriptionsQuery.isSuccess}
                        returnedRenewalId={returnedRenewalId}
                        onRefresh={async () =>
                          (await subscriptionsQuery.refetch({ throwOnError: true })).data
                            ?.subscriptions ?? []
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
      {session.sellerId && subList.length > 0 && (
        <section className="business-panel subscription-history">
          <div className="subscription-section-head">
            <h2>Lịch sử kỳ thuê</h2>
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
                        {new Date(sub.periodFrom).toLocaleDateString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}{' '}
                        –{' '}
                        {new Date(sub.periodTo).toLocaleDateString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </td>
                      <td>{rentalMoney(sub.price)}</td>
                      <td>
                        <span className="subscription-status" data-status={sub.status}>
                          {subscriptionStatusLabel[sub.status] || sub.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </RefreshRegion>
  );
}
