'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PayosCheckout from '@/shared/components/PayosCheckout';
import { validatePayosCheckoutUrl } from '@/shared/lib/payos-checkout';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  ClipboardList,
  ChevronDown,
  Search,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Flower2,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import {
  canSendPreorderPickupOtp,
  matchesOrderFilter,
  orderClosed,
  orderNextStep,
  orderStage,
  sellerOrderActionLabel,
  customerOrderActionLabel,
  customerOrderHint,
  sellerOrderHint,
  statusName,
  money,
  when,
} from './orders.utils';
import type { OrderFilter, Page, SendPreorderPickupOtpResponse, WebOrder } from './orders.types';
import styles from './seller-orders.module.css';
import customerStyles from './customer-orders.module.css';
import './admin-preorders.css';
import { CustomerQuoteDetails, CustomerPaymentReturn } from './CustomerQuoteDetails';
import CustomerPickupGuide from './CustomerPickupGuide';
import CustomerOrderChat from './CustomerOrderChat';
import { readSellerQueue, sellerQueueKey, SELLER_RESULT_SIZE } from './seller-queue';
import { rememberPreorderPayment } from './payment-return';

const sellerFilters: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'attention', label: 'Cần xử lý' },
  { value: 'requested', label: 'Chờ báo giá' },
  { value: 'quoted', label: 'Chờ xác nhận' },
  { value: 'payment', label: 'Chờ thanh toán' },
  { value: 'preparing', label: 'Đang chuẩn bị' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'closed', label: 'Đã kết thúc' },
];
const pickupDate = (value: string) =>
  new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const pickupClock = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });
const pickupDayKey = (value: string) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const searchable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN');

function OrderActions({
  row,
  base,
  mode,
  role,
  page,
  filter,
  onReload,
}: {
  row: WebOrder;
  base: string;
  mode: 'member' | 'seller' | 'admin';
  role?: string;
  page: number;
  filter: OrderFilter;
  onReload: () => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [action, setAction] = useState<'quote' | 'fulfill' | 'cancel' | 'accept' | null>(null);
  const [busy, setBusy] = useState(false);
  const uncertaintyKey = `florabot-web-order-uncertain:${base}:${row.id}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem(uncertaintyKey) === '1';
    } catch {
      return false;
    }
  });
  const [paymentLink, setPaymentLink] = useState<
    components['schemas']['PaymentLinkResponse'] | null
  >(null);
  const [checking, setChecking] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [price, setPrice] = useState(String(row.quotedPrice || ''));
  const [note, setNote] = useState('');
  const [reject, setReject] = useState(false);
  const [pickup, setPickup] = useState(() => {
    const date = new Date(row.pickupAt);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [slot, setSlot] = useState('');
  const [qr, setQr] = useState('');
  const [fulfillStep, setFulfillStep] = useState<1 | 2>(1);
  const [confirm, setConfirm] = useState(false);
  const [reviewedQuote, setReviewedQuote] = useState<{
    price: number | null;
    pickupAt: string;
    note: string | null;
  } | null>(null);
  const reviewedQuoteChanged = Boolean(
    reviewedQuote &&
    (reviewedQuote.price !== row.quotedPrice ||
      reviewedQuote.pickupAt !== row.pickupAt ||
      reviewedQuote.note !== row.quoteNote),
  );
  const [otpSending, setOtpSending] = useState(false);
  const otpSendingRef = useRef(false);
  const [otpHasSent, setOtpHasSent] = useState(false);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);
  const otpRemainingSeconds =
    otpCooldownUntil && otpCooldownUntil > now ? Math.ceil((otpCooldownUntil - now) / 1000) : 0;

  async function sendPickupOtp() {
    if (otpSendingRef.current || busy || uncertain || otpRemainingSeconds > 0) return;
    otpSendingRef.current = true;
    setOtpSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/me/preorders/${encodeURIComponent(row.id)}/pickup-otp`, {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<
        SendPreorderPickupOtpResponse & {
          detail?: string;
          title?: string;
          message?: string;
        }
      >;

      if (!response.ok) {
        const serverDetail = data.detail || data.title || data.message;
        if (response.status === 401) {
          setError(
            serverDetail ||
              'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng kiểm tra phiên đăng nhập và đăng nhập lại.',
          );
        } else if (response.status === 403) {
          setError(
            serverDetail ||
              'Chỉ Chủ shop (Seller) sở hữu đơn mới được gửi mã nhận hoa. Vui lòng kiểm tra quyền truy cập và phiên đăng nhập.',
          );
        } else if (response.status === 404) {
          setError(serverDetail || 'Không tìm thấy đơn đặt trước thuộc shop của bạn.');
        } else if (response.status === 409) {
          setError(
            serverDetail ||
              'Trạng thái đơn đặt trước đã thay đổi. Đang tải lại trạng thái mới nhất từ máy chủ.',
          );
          await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
        } else if (response.status === 429) {
          if (typeof data.resendAfterSeconds === 'number' && data.resendAfterSeconds > 0) {
            setOtpCooldownUntil(Date.now() + data.resendAfterSeconds * 1000);
          }
          setError(
            serverDetail || 'Bạn đã gửi mã quá giới hạn cho phép. Vui lòng chờ trước khi gửi lại.',
          );
        } else if (response.status === 503 || response.status >= 500) {
          setError(
            serverDetail ||
              'Chưa xác nhận gửi mã thành công do dịch vụ tạm thời gián đoạn. Hệ thống không tự gửi lại; vui lòng kiểm tra trước khi bấm gửi lại.',
          );
        } else {
          setError(serverDetail || `Gửi mã thất bại (${response.status}).`);
        }
        return;
      }

      const masked = data.recipientMasked || 'email đăng nhập của khách';
      const cooldownSec =
        typeof data.resendAfterSeconds === 'number' && data.resendAfterSeconds > 0
          ? data.resendAfterSeconds
          : 60;
      setOtpHasSent(true);
      setOtpCooldownUntil(Date.now() + cooldownSec * 1000);
      setNotice(`Đã gửi mã nhận hoa tới ${masked}. Khách vui lòng kiểm tra hộp thư và thư rác.`);
    } catch {
      setError(
        'Chưa xác nhận gửi mã thành công do lỗi kết nối mạng. Hệ thống không tự gửi lại; vui lòng kiểm tra trước khi thử lại.',
      );
    } finally {
      otpSendingRef.current = false;
      setOtpSending(false);
    }
  }
  const quoteExpired = Boolean(row.quoteExpiresAt && new Date(row.quoteExpiresAt).getTime() <= now);
  const paymentExpired = Boolean(row.payBefore && new Date(row.payBefore).getTime() <= now);
  const hasQuotedPrice = row.quotedPrice != null && Number.isFinite(row.quotedPrice);
  const slots = useQuery({
    queryKey: ['seller-kiosk-slots', row.sellerId, row.kioskId],
    queryFn: () =>
      request<(components['schemas']['SellerSlotResponse'] & { zone?: string | null })[]>(
        `/me/kiosks/${row.kioskId}/slots`,
      ),
    enabled: action === 'fulfill' && Boolean(row.kioskId),
  });
  const emptyKioskSlots =
    slots.data?.filter(
      (item) => item.kioskId === row.kioskId && item.status === 'RENTED_EMPTY' && !item.bouquetId,
    ) ?? [];
  const fulfillSlots = emptyKioskSlots.filter((item) => item.zone === 'PREORDER');
  async function send(kind: string, body: unknown) {
    if (mode === 'admin') return;
    if (sending.current || uncertain) return;
    if (
      mode === 'member' &&
      kind === 'accept' &&
      (!hasQuotedPrice ||
        reviewedQuoteChanged ||
        (row.quoteExpiresAt && new Date(row.quoteExpiresAt).getTime() <= Date.now()))
    ) {
      setError(
        'Báo giá đã hết hạn hoặc chưa có số tiền hợp lệ. Làm mới đơn và liên hệ shop để kiểm tra.',
      );
      return;
    }
    if (
      mode === 'member' &&
      kind === 'payment-link' &&
      row.payBefore &&
      new Date(row.payBefore).getTime() <= Date.now()
    ) {
      setError('Đã hết hạn thanh toán. Làm mới để kiểm tra trạng thái của đơn.');
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<components['schemas']['PaymentLinkResponse']>(
        `${base}/${row.id}/${kind}`,
        body,
      );
      if (kind === 'payment-link') {
        const validation = validatePayosCheckoutUrl(result.checkoutUrl || '');
        const amount = Number(result.amount);
        const orderCode = Number(result.orderCode);
        if (
          !validation.valid ||
          !validation.url ||
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          !Number.isSafeInteger(orderCode) ||
          orderCode <= 0
        )
          throw new Error('Liên kết thanh toán không hợp lệ.');
        rememberPreorderPayment(row.id, page, orderCode);
        setPaymentLink({ ...result, checkoutUrl: validation.url });
      } else {
        setAction(null);
        setConfirm(false);
        setNotice('Đã cập nhật yêu cầu.');
      }
    } catch (cause) {
      if (
        !(cause instanceof ApiError) ||
        ((cause.status >= 500 || cause.status === 408) &&
          !(
            kind === 'payment-link' &&
            ['missing_seller_channel', 'seller_channel_unavailable'].includes(cause.code ?? '')
          ))
      ) {
        setUncertain(true);
        try {
          sessionStorage.setItem(uncertaintyKey, '1');
        } catch {
          /* Keep the in-memory lock. */
        }
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được kết quả. Chọn cập nhật để kiểm tra trước khi gửi lại.',
      );
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      if (mode === 'seller' && kind === 'fulfill') {
        await queryClient.invalidateQueries({ queryKey: ['products'] });
      }
      sending.current = false;
      setBusy(false);
    }
  }
  const canCancel =
    mode !== 'admin' &&
    (!row.orderStatus
      ? ['REQUESTED', 'QUOTED'].includes(row.state)
      : row.orderStatus === 'AWAITING_PAYMENT' ||
        (mode !== 'member' && row.orderStatus === 'PAID'));
  function openCancellation() {
    setAction('cancel');
    setConfirm(false);
    setNote('');
  }

  const progress = (
    <ol className="order-progress" aria-label="Tiến độ đơn đặt hoa">
      {['Yêu cầu', 'Báo giá & thanh toán', 'Chuẩn bị', 'Sẵn sàng nhận', 'Hoàn tất'].map(
        (label, index) => (
          <li
            key={label}
            data-complete={
              index < orderStage(row) || (mode === 'seller' && row.orderStatus === 'COMPLETED')
            }
            aria-current={index === orderStage(row) ? 'step' : undefined}
          >
            <span aria-hidden="true">
              {mode === 'seller' && (index < orderStage(row) || row.orderStatus === 'COMPLETED')
                ? '✓'
                : index + 1}
            </span>
            <div>
              {label}
              {mode === 'seller' && (
                <span className="sr-only">
                  {index < orderStage(row) || row.orderStatus === 'COMPLETED'
                    ? ' — đã hoàn thành'
                    : index === orderStage(row)
                      ? ' — hiện tại'
                      : ' — chưa đến'}
                </span>
              )}
            </div>
          </li>
        ),
      )}
    </ol>
  );
  return (
    <div className="web-order-actions">
      {mode === 'seller' &&
        (!orderClosed(row) || row.orderStatus === 'COMPLETED') &&
        !['DISPUTED', 'DISPENSE_FAILED'].includes(row.orderStatus ?? '') &&
        progress}
      <div
        className={mode === 'seller' && orderClosed(row) ? 'order-closed-note' : 'order-next-step'}
        role="note"
      >
        {!(mode === 'seller' && orderClosed(row)) && (
          <strong>{mode === 'admin' ? 'Tình trạng xử lý' : 'Bước tiếp theo'}</strong>
        )}
        <p>{mode === 'member' ? customerOrderHint(row) : orderNextStep(row, mode)}</p>
      </div>
      {mode === 'member' &&
        !(
          mode === 'member' &&
          ((!row.orderId && row.state === 'QUOTED') || row.orderStatus === 'AWAITING_PAYMENT')
        ) &&
        !orderClosed(row) &&
        !['DISPUTED', 'DISPENSE_FAILED'].includes(row.orderStatus ?? '') &&
        progress}
      {mode === 'member' && <CustomerQuoteDetails row={row} now={now} />}
      {mode === 'member' &&
        row.orderStatus === 'AWAITING_PAYMENT' &&
        !paymentExpired &&
        paymentLink && (
          <PayosCheckout
            checkoutUrl={paymentLink.checkoutUrl}
            qrCode={paymentLink.qrCode}
            amount={paymentLink.amount}
            orderCode={paymentLink.orderCode}
            recipientName={paymentLink.recipientName}
            recipientAccountMasked={paymentLink.recipientAccountMasked}
            title="Thanh toán đơn hoa"
            description={[
              row.shopName || 'Đơn đặt hoa',
              money(Number(paymentLink.amount)),
              paymentLink.recipientAccountMasked
                ? [
                    'Tài khoản nhận của shop',
                    paymentLink.recipientName,
                    paymentLink.recipientAccountMasked,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onClose={(result) => {
              setPaymentLink(null);
              setNotice(
                result === 'success'
                  ? 'Đang cập nhật trạng thái thanh toán từ hệ thống. Nếu đã trả tiền, chờ xác nhận trước khi thanh toán lại.'
                  : 'Đã đóng màn hình thanh toán. Xem trạng thái đơn bên dưới.',
              );
              void onReload();
            }}
            onRefresh={() => void onReload()}
            onRetryQr={() => void send('payment-link', {})}
            isLoadingQr={busy || uncertain}
            qrError={error}
          />
        )}
      {mode === 'admin' && (
        <>
          {row.address && (
            <p>
              <strong>Địa chỉ tủ:</strong> {row.address}
            </p>
          )}
          {row.instructions && (
            <p>
              <strong>Yêu cầu của khách:</strong> {row.instructions}
            </p>
          )}
          {row.quoteNote && (
            <p>
              <strong>Ghi chú:</strong> {row.quoteNote}
            </p>
          )}
          <dl className="bank-summary">
            <div>
              <dt>Nhận từ</dt>
              <dd>{when(row.pickupAt)}</dd>
            </div>
            <div>
              <dt>Hạn nhận</dt>
              <dd>{when(row.pickupBefore)}</dd>
            </div>
            {row.quotedPrice != null && (
              <div>
                <dt>{row.kind === 'CUSTOM' ? 'Giá shop xác nhận' : 'Giá đơn hàng'}</dt>
                <dd>{money(row.quotedPrice)}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {mode === 'seller' && (row.instructions || row.quoteNote) && (
        <div className="order-notes-box">
          {row.instructions && (
            <p className="order-instructions">
              <strong>Yêu cầu của khách:</strong> {row.instructions}
            </p>
          )}
          {row.quoteNote && (
            <p className="incident-text">
              <strong>Shop ghi chú:</strong> {row.quoteNote}
            </p>
          )}
        </div>
      )}
      {mode === 'member' && <CustomerPickupGuide row={row} now={now} />}
      {mode === 'member' && row.orderId && row.trackingToken && (
        <a
          href={`/receipt#order=${encodeURIComponent(row.orderId)}&token=${encodeURIComponent(row.trackingToken)}`}
          referrerPolicy="no-referrer"
        >
          Xem biên nhận và hỗ trợ hoàn tiền
        </a>
      )}
      {mode === 'member' && role === 'CUSTOMER' && !action && !uncertain && (
        <CustomerOrderChat row={row} page={page} filter={filter} />
      )}
      {!action && mode !== 'admin' && (
        <div className="stock-actions">
          {mode === 'member' && row.state === 'QUOTED' && !row.orderId && (
            <Button
              disabled={busy || uncertain || !hasQuotedPrice || quoteExpired}
              onClick={() => {
                setReviewedQuote({
                  price: row.quotedPrice,
                  pickupAt: row.pickupAt,
                  note: row.quoteNote,
                });
                setAction('accept');
                setConfirm(false);
              }}
            >
              Kiểm tra báo giá
            </Button>
          )}
          {mode === 'member' && row.orderStatus === 'AWAITING_PAYMENT' && (
            <Button
              aria-busy={busy}
              disabled={busy || uncertain || paymentExpired}
              onClick={() => void send('payment-link', {})}
            >
              {busy ? 'Đang mở thanh toán…' : 'Thanh toán ngay'}
            </Button>
          )}
          {mode === 'seller' && ['REQUESTED', 'QUOTED'].includes(row.state) && (
            <Button
              disabled={busy || uncertain}
              onClick={() => {
                setAction('quote');
                setConfirm(false);
              }}
            >
              Báo giá hoặc từ chối
            </Button>
          )}
          {mode === 'seller' &&
            row.kind === 'CUSTOM' &&
            row.orderStatus === 'PAID' &&
            !row.ready && (
              <Button
                disabled={busy || uncertain}
                onClick={() => {
                  setAction('fulfill');
                  setConfirm(false);
                  setFulfillStep(1);
                  setError('');
                }}
              >
                Nạp hoa cho đơn này
              </Button>
            )}
          {mode === 'seller' && canSendPreorderPickupOtp(row, role, now) && (
            <Button
              type="button"
              disabled={busy || uncertain || otpSending || otpRemainingSeconds > 0}
              onClick={() => void sendPickupOtp()}
            >
              {otpSending
                ? 'Đang gửi mã…'
                : otpRemainingSeconds > 0
                  ? `Gửi lại mã (${otpRemainingSeconds}s)`
                  : otpHasSent
                    ? 'Gửi lại mã'
                    : 'Gửi mã nhận hoa'}
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" disabled={busy || uncertain} onClick={openCancellation}>
              Hủy yêu cầu
            </Button>
          )}
        </div>
      )}
      {mode !== 'member' && row.payBefore && row.orderStatus === 'AWAITING_PAYMENT' && (
        <p>
          Thanh toán trước {when(row.payBefore)}. Hết hạn, yêu cầu thanh toán không còn hiệu lực.
        </p>
      )}
      {action && (
        <form
          className={`order-action-card ${action === 'fulfill' ? 'fulfill-wizard' : ''}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (
              action === 'fulfill' &&
              (fulfillStep !== 2 || !fulfillSlots.some((item) => item.id === slot) || !qr.trim())
            ) {
              setError('Chọn ô Pre-order trống và nhập mã QR trước khi xác nhận.');
              setFulfillStep(1);
              return;
            }
            if (!confirm) {
              setError('Đọc lại thông tin và đánh dấu xác nhận trước khi gửi.');
              return;
            }
            if (action === 'accept') void send('accept', reviewedQuote);
            if (action === 'quote')
              void send('quote', {
                price: reject ? 0 : Number(price),
                pickupAt: new Date(pickup).toISOString(),
                note,
                reject,
              });
            if (action === 'fulfill') void send('fulfill', { slotId: slot, qrCode: qr });
            if (action === 'cancel') void send('cancel', { reason: note });
          }}
        >
          <fieldset className="order-action-fields" disabled={busy || uncertain}>
            {action === 'fulfill' && (
              <ol className="fulfill-steps" aria-label="Các bước nạp hoa">
                <li
                  aria-current={fulfillStep === 1 ? 'step' : undefined}
                  data-complete={fulfillStep > 1}
                >
                  <span>1</span>
                  <div>
                    <strong>Chọn ô và mã hoa</strong>
                    <small>Thông tin bó hoa</small>
                  </div>
                </li>
                <li aria-current={fulfillStep === 2 ? 'step' : undefined}>
                  <span>2</span>
                  <div>
                    <strong>Kiểm tra và xác nhận</strong>
                    <small>Hoàn tất nạp hoa</small>
                  </div>
                </li>
              </ol>
            )}
            <h3>
              {action === 'accept'
                ? 'Xác nhận mẫu, giá và lịch nhận'
                : action === 'quote'
                  ? 'Phản hồi yêu cầu đặt hoa'
                  : action === 'fulfill'
                    ? fulfillStep === 1
                      ? 'Chọn ô nhận hoa'
                      : 'Kiểm tra trước khi xác nhận'
                    : 'Kiểm tra trước khi hủy'}
            </h3>
            {action === 'accept' && reviewedQuote && (
              <p>
                Kiểm tra báo giá ở trên, rồi đánh dấu đồng ý để xác nhận với shop. Bước này chưa trừ
                tiền; bạn sẽ thanh toán ở bước tiếp theo.
              </p>
            )}
            {action === 'accept' && reviewedQuoteChanged && (
              <p role="alert" className="error">
                Shop đã cập nhật báo giá trong lúc bạn xem. Đóng phần xác nhận rồi chọn Kiểm tra báo
                giá để xem lại.
              </p>
            )}
            {action === 'quote' && (
              <>
                <label className="payout-checkbox">
                  <input
                    type="checkbox"
                    checked={reject}
                    onChange={(event) => setReject(event.target.checked)}
                  />
                  <span>Shop chưa thể nhận đơn này</span>
                </label>
                {!reject && (
                  <>
                    <label htmlFor={`quote-price-${row.id}`}>Giá trọn gói (đồng)</label>
                    <input
                      id={`quote-price-${row.id}`}
                      type="number"
                      min="1000"
                      max="100000000"
                      step="1000"
                      required
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                    />
                    <label htmlFor={`quote-pickup-${row.id}`}>Giờ bắt đầu nhận</label>
                    <input
                      id={`quote-pickup-${row.id}`}
                      type="datetime-local"
                      required
                      value={pickup}
                      onChange={(event) => setPickup(event.target.value)}
                    />
                  </>
                )}
              </>
            )}
            {(action === 'quote' || action === 'cancel') && (
              <>
                <label htmlFor={`order-note-${row.id}`}>
                  {action === 'cancel'
                    ? 'Lý do hủy'
                    : 'Mô tả mẫu hoa, điều kiện hoặc lý do từ chối'}
                </label>
                <textarea
                  id={`order-note-${row.id}`}
                  minLength={5}
                  maxLength={1000}
                  required
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </>
            )}
            {action === 'fulfill' && fulfillStep === 1 && (
              <>
                <p>
                  Chỉ xác nhận sau khi đã nạp bó hoa theo yêu cầu. Thao tác này giữ ô riêng cho
                  khách, chưa mở cửa nhận hoa.
                </p>
                <label htmlFor={`order-slot-${row.id}`}>Ô trống tại tủ nhận</label>
                <select
                  id={`order-slot-${row.id}`}
                  required
                  value={slot}
                  onChange={(event) => setSlot(event.target.value)}
                >
                  <option value="">Chọn ô Pre-order trống</option>
                  {fulfillSlots.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.slotCode}
                    </option>
                  ))}
                </select>
                {slots.isError && <p role="alert">Chưa tải được ô. Đóng biểu mẫu rồi mở lại.</p>}
                {!slots.isPending && !slots.isError && fulfillSlots.length === 0 && (
                  <p className="quiet">Chưa có ô Pre-order trống phù hợp tại tủ nhận.</p>
                )}
                <label htmlFor={`order-qr-${row.id}`}>Mã QR của bó hoa</label>
                <div className="field-action">
                  <input
                    id={`order-qr-${row.id}`}
                    required
                    maxLength={120}
                    value={qr}
                    onChange={(event) => setQr(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setQr(`BOUQUET-${(row.orderCode || row.id.slice(0, 8)).toUpperCase()}`)
                    }
                  >
                    Tạo mã tự động
                  </Button>
                </div>
              </>
            )}
            {action === 'fulfill' && fulfillStep === 2 && (
              <div className="fulfill-review">
                <p>
                  Chỉ xác nhận sau khi đã đặt đúng bó hoa vào ô. Thao tác này giữ ô cho khách, chưa
                  mở cửa nhận hoa.
                </p>
                <dl>
                  <div>
                    <dt>Tủ nhận</dt>
                    <dd>{row.kioskName || row.kioskId}</dd>
                  </div>
                  <div>
                    <dt>Ô Pre-order</dt>
                    <dd>
                      {fulfillSlots.find((item) => item.id === slot)?.slotCode ||
                        'Không còn phù hợp'}
                    </dd>
                  </div>
                  <div>
                    <dt>Mã QR bó hoa</dt>
                    <dd>{qr}</dd>
                  </div>
                </dl>
              </div>
            )}
            {action === 'cancel' && row.orderStatus === 'PAID' && (
              <div className="order-action-warning" role="alert">
                Đơn đã thanh toán sẽ tạo yêu cầu hoàn tiền để ADMIN xử lý; đây không phải hoàn tiền
                ngân hàng tự động.
              </div>
            )}
            {(action !== 'fulfill' || fulfillStep === 2) && (
              <label className="payout-checkbox">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(event) => setConfirm(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  {action === 'accept' && mode === 'member'
                    ? 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.'
                    : 'Tôi đã đối chiếu và xác nhận thông tin trên.'}
                </span>
              </label>
            )}
            <div className="stock-actions">
              {action === 'fulfill' && fulfillStep === 1 ? (
                <Button
                  type="button"
                  disabled={
                    !fulfillSlots.some((item) => item.id === slot) || !qr.trim() || slots.isFetching
                  }
                  onClick={() => {
                    setError('');
                    setConfirm(false);
                    setFulfillStep(2);
                  }}
                >
                  Tiếp tục kiểm tra
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    (mode === 'member' &&
                      action === 'accept' &&
                      (!confirm || quoteExpired || !hasQuotedPrice || reviewedQuoteChanged))
                  }
                  className={
                    action === 'cancel' || (action === 'quote' && reject)
                      ? 'management-danger-button'
                      : undefined
                  }
                >
                  {busy
                    ? 'Đang gửi…'
                    : action === 'cancel'
                      ? 'Xác nhận hủy đơn'
                      : action === 'quote' && reject
                        ? 'Xác nhận từ chối'
                        : action === 'fulfill'
                          ? 'Xác nhận nạp hoa'
                          : action === 'accept' && mode === 'member'
                            ? 'Đồng ý báo giá'
                            : 'Xác nhận gửi'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (action === 'fulfill' && fulfillStep === 2) {
                    setFulfillStep(1);
                    setConfirm(false);
                  } else {
                    setAction(null);
                  }
                  setError('');
                }}
              >
                {action === 'fulfill' && fulfillStep === 2 ? 'Quay lại' : 'Đóng'}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {uncertain && (
        <div className="order-uncertain" role="alert">
          <p>
            Chưa xác nhận được kết quả lần gửi trước. Các thao tác đang khóa để tránh gửi trùng; tải
            lại hồ sơ và đối chiếu trạng thái trước khi tiếp tục.
          </p>
          <Button
            variant="outline"
            disabled={checking || busy}
            onClick={async () => {
              setChecking(true);
              try {
                await onReload();
                try {
                  sessionStorage.removeItem(uncertaintyKey);
                } catch {
                  /* This tab can continue after review. */
                }
                setUncertain(false);
                setAction(null);
                setError('');
                setNotice(
                  'Đã tải lại hồ sơ từ máy chủ. Hãy đối chiếu trạng thái trước khi tạo thao tác mới.',
                );
              } catch {
                setError('Chưa đọc được trạng thái mới. Các thao tác vẫn được khóa.');
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? 'Đang kiểm tra…' : 'Kiểm tra kết quả từ máy chủ'}
          </Button>
        </div>
      )}
      <p role="alert" className="error">
        {error}
      </p>
      <p role="status">{notice}</p>
    </div>
  );
}

export default function WebRequests({
  mode,
  sellerId,
}: {
  mode: 'member' | 'seller' | 'admin';
  sellerId?: string;
}) {
  const session = useQuery(sessionQuery);
  const params = useSearchParams();
  const initialPage = Number(params.get('page'));
  const initialFilter = params.get('filter');
  const filters: OrderFilter[] = [
    'all',
    'attention',
    'requested',
    'quoted',
    'payment',
    'preparing',
    'ready',
    'closed',
  ];
  const [page, setPage] = useState(
    Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1,
  );
  const [filter, setFilter] = useState<OrderFilter>(
    filters.find((value) => value === initialFilter) ?? 'all',
  );
  const [resultPage, setResultPage] = useState<number | null>(null);
  const [queueLimit, setQueueLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [pickupDay, setPickupDay] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const base =
    mode === 'member'
      ? '/member/preorders'
      : mode === 'admin'
        ? '/admin/preorders'
        : `/sellers/${sellerId}/preorders`;
  const query = useQuery({
    queryKey: mode === 'seller' ? sellerQueueKey(base, queueLimit) : ['web-orders', base, page],
    queryFn: ({ signal }) =>
      mode === 'seller'
        ? readSellerQueue((next) => request<Page>(`${base}?page=${next}`), queueLimit, signal)
        : request<Page>(`${base}?page=${page}`),
    refetchInterval: (q) =>
      mode !== 'seller' &&
      q.state.data?.items?.some((item) => item.orderStatus === 'AWAITING_PAYMENT')
        ? 5_000
        : 30_000,
    placeholderData: (previous, previousQuery) =>
      mode === 'seller' && previousQuery?.queryKey[1] === base ? previous : undefined,
    enabled: mode !== 'seller' || Boolean(sellerId),
  });
  const items = query.data?.items ?? [];
  const returnedRequest = mode === 'member' || mode === 'seller' ? params.get('requestId') : null;
  const [readyNotice, setReadyNotice] = useState('');
  const previousReady = useRef<Map<string, boolean>>(new Map());
  const scrolledRequest = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== 'member' || !query.data) return;
    for (const row of query.data.items) {
      const ready = row.orderStatus === 'PAID' && row.ready;
      if (ready && previousReady.current.get(row.id) === false) {
        setReadyNotice(
          `Đơn ${row.orderCode || row.id}: hoa đã sẵn sàng tại ${row.kioskName || 'tủ nhận'}. Nhận từ ${when(row.pickupAt)} đến ${when(row.pickupBefore)}.`,
        );
      }
      previousReady.current.set(row.id, ready);
    }
  }, [query.data, mode]);
  useEffect(() => {
    if (returnedRequest && query.data && scrolledRequest.current !== returnedRequest) {
      const target = document.getElementById(`preorder-${returnedRequest}`);
      if (target) {
        target.scrollIntoView({ block: 'center' });
        if (mode === 'seller')
          target.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
        scrolledRequest.current = returnedRequest;
      }
    }
  }, [returnedRequest, query.data, mode]);
  const Container = mode === 'seller' ? 'div' : 'section';
  const filtered = items.filter(
    (row) =>
      matchesOrderFilter(row, filter, mode) &&
      (mode !== 'admin' ||
        !search.trim() ||
        searchable(
          [row.orderCode, row.id, row.productName, row.shopName, row.kioskName, row.address]
            .filter(Boolean)
            .join(' '),
        ).includes(searchable(search.trim()))) &&
      (mode !== 'seller' ||
        ((!search.trim() ||
          searchable(
            [row.orderCode, row.id, row.productName, row.kioskName, row.address]
              .filter(Boolean)
              .join(' '),
          ).includes(searchable(search.trim()))) &&
          (!pickupDay || pickupDayKey(row.pickupAt) === pickupDay))),
  );
  const targetIndex = returnedRequest
    ? filtered.findIndex((row) => row.id === returnedRequest)
    : -1;
  const totalResultPages = Math.max(1, Math.ceil(filtered.length / SELLER_RESULT_SIZE));
  const displayPage =
    mode === 'seller'
      ? Math.min(
          resultPage ?? (targetIndex >= 0 ? Math.floor(targetIndex / SELLER_RESULT_SIZE) + 1 : 1),
          totalResultPages,
        )
      : page;
  const displayItems =
    mode === 'seller'
      ? filtered.slice((displayPage - 1) * SELLER_RESULT_SIZE, displayPage * SELLER_RESULT_SIZE)
      : filtered;
  const interventionCount =
    mode === 'admin'
      ? items.filter((row) => matchesOrderFilter(row, 'attention', 'admin')).length
      : 0;
  const filterName = sellerFilters.find((item) => item.value === filter)?.label ?? 'Tất cả';
  return (
    <Container
      id="web-orders"
      className={`web-orders ${mode === 'seller' ? styles.sellerOrders : mode === 'admin' ? 'admin-preorders' : ''}`}
      aria-labelledby="web-orders-title"
    >
      {mode === 'member' ? (
        <h1 id="web-orders-title" className="account-orders-title">
          Đơn đặt trước
        </h1>
      ) : (
        <h2 id="web-orders-title" className={mode === 'seller' ? 'sr-only' : undefined}>
          {mode === 'admin' ? 'Danh sách đơn từ website' : 'Đơn đặt trước từ website'}
        </h2>
      )}
      {mode === 'member' && params.get('paymentReturn') === '1' && (
        <CustomerPaymentReturn
          row={items.find((row) => row.id === returnedRequest)}
          loading={query.isPending}
          failed={query.isError}
        />
      )}
      {mode === 'member' && (
        <p role="status" aria-live="polite">
          {readyNotice}
        </p>
      )}
      {mode === 'member' && <p>Theo dõi yêu cầu, duyệt báo giá và xem lịch nhận hoa của bạn.</p>}
      {mode === 'admin' && (
        <>
          <div className="admin-preorder-toolbar" role="group" aria-label="Bộ lọc đơn đặt trước">
            <label className="admin-preorder-search">
              <span>Tìm đơn trong trang</span>
              <span className="admin-preorder-search-input">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Mã đơn, tên shop hoặc tủ…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </span>
            </label>
            <label>
              <span>Trạng thái</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as OrderFilter)}
              >
                {sellerFilters.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {value === 'attention' ? 'Cần theo dõi' : label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {query.isFetching ? 'Đang cập nhật…' : 'Làm mới'}
            </Button>
          </div>
          {query.isSuccess && (
            <div className="admin-preorder-results">
              <p role="status">
                Trang {page} · {filtered.length}/{items.length} yêu cầu
              </p>
              {interventionCount > 0 && (
                <button
                  type="button"
                  className="admin-preorder-flag"
                  aria-pressed={filter === 'attention'}
                  onClick={() => setFilter(filter === 'attention' ? 'all' : 'attention')}
                >
                  Cần theo dõi <strong>{interventionCount}</strong>
                </button>
              )}
            </div>
          )}
        </>
      )}
      {mode === 'seller' && (
        <>
          <div className={styles.filters}>
            <div className={styles.filterHeading}>
              <div>
                <h3>Quản lý đơn đặt trước</h3>
                <p>Chọn trạng thái, tìm đơn rồi mở chi tiết để xử lý.</p>
              </div>
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {query.isFetching ? 'Đang cập nhật…' : 'Làm mới'}
              </Button>
            </div>
            <label className={styles.mobileStatus}>
              <span>Trạng thái đơn</span>
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as OrderFilter);
                  setResultPage(1);
                }}
              >
                {sellerFilters.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                    {query.isSuccess
                      ? ` (${items.filter((row) => matchesOrderFilter(row, value, mode)).length})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.tabs} role="group" aria-label="Lọc trạng thái đơn">
              {sellerFilters.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setResultPage(1);
                  }}
                >
                  {label}
                  {query.isSuccess && (
                    <span>
                      {items.filter((row) => matchesOrderFilter(row, value, mode)).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className={styles.searchBar}>
              <label className={styles.searchField}>
                <span>Tìm đơn của shop</span>
                <input
                  type="search"
                  value={search}
                  placeholder="Mã đơn, tên hoa hoặc kiosk…"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setResultPage(1);
                  }}
                />
              </label>
              <label className={styles.dateField}>
                <span>Lọc theo ngày nhận</span>
                <input
                  type="date"
                  value={pickupDay}
                  onInput={(event) => {
                    setPickupDay(event.currentTarget.value);
                    setResultPage(1);
                  }}
                  onChange={(event) => {
                    setPickupDay(event.target.value);
                    setResultPage(1);
                  }}
                />
              </label>
              <div className={styles.mobileDate}>
                <button
                  type="button"
                  aria-expanded={dateFilterOpen}
                  onClick={() => setDateFilterOpen((open) => !open)}
                >
                  {pickupDay
                    ? `Ngày nhận: ${pickupDate(`${pickupDay}T12:00:00+07:00`)}`
                    : 'Lọc theo ngày nhận'}
                </button>
                {dateFilterOpen && (
                  <label>
                    <span>Ngày nhận hoa</span>
                    <input
                      type="date"
                      value={pickupDay}
                      onChange={(event) => {
                        setPickupDay(event.target.value);
                        setResultPage(1);
                      }}
                    />
                  </label>
                )}
              </div>
              {(search || pickupDay || filter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setPickupDay('');
                    setFilter('all');
                    setResultPage(1);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>
          {query.isSuccess && (
            <p className={styles.resultCount} role="status">
              {filterName}: {filtered.length} yêu cầu
              {filtered.length > 0
                ? ` · Hiển thị ${(displayPage - 1) * SELLER_RESULT_SIZE + 1}–${Math.min(displayPage * SELLER_RESULT_SIZE, filtered.length)}`
                : ''}
              .{' '}
              {query.data.hasMore
                ? `Còn đơn chưa được tải; kết quả hiện tính trên ${items.length} yêu cầu đã tải.`
                : `Đã tìm trên ${items.length} yêu cầu của shop.`}
            </p>
          )}
        </>
      )}
      {mode === 'member' && query.data && items.length > 0 && (
        <>
          <div
            className={customerStyles.filters}
            role="group"
            aria-label="Tóm tắt trang đơn đang xem"
          >
            {(
              [
                { value: 'all', label: 'Tất cả' },
                { value: 'attention', label: 'Cần bạn xử lý' },
                { value: 'preparing', label: 'Đang chuẩn bị' },
                { value: 'ready', label: 'Chờ nhận hoa' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>
                  {items.filter((row) => matchesOrderFilter(row, value, 'member')).length}
                </span>
              </button>
            ))}
          </div>
          <p className="quiet order-page-note">
            Thống kê và bộ lọc tính trên {items.length} đơn ở trang {page}.
          </p>
        </>
      )}
      {mode === 'member' && (
        <div className={`queue-filter-bar order-filter-bar ${customerStyles.toolbar}`}>
          <div className="filter-group">
            <label htmlFor={`order-filter-${mode}`} className="sr-only">
              Lọc yêu cầu trong trang
            </label>
            <select
              id={`order-filter-${mode}`}
              aria-label="Lọc yêu cầu trong trang"
              value={filter}
              onChange={(event) => setFilter(event.target.value as OrderFilter)}
            >
              <option value="all">Tất cả yêu cầu trong trang</option>
              <option value="attention">Cần bạn phản hồi</option>
              <option value="requested">Chờ báo giá</option>
              <option value="quoted">Đã có báo giá</option>
              <option value="payment">Chờ thanh toán</option>
              <option value="preparing">Đang chuẩn bị</option>
              <option value="ready">Sẵn sàng tại tủ</option>
              <option value="closed">Đã kết thúc</option>
            </select>
          </div>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" className={query.isFetching ? 'spin' : ''} />
            {query.isFetching ? 'Đang cập nhật…' : 'Làm mới'}
          </Button>
        </div>
      )}
      {query.isPending ? (
        <p role="status">Đang tải yêu cầu…</p>
      ) : query.isError ? (
        <p role="alert">Chưa tải được yêu cầu. Hãy chọn cập nhật để thử lại.</p>
      ) : (
        <>
          {!filtered.length && (
            <div className="operations-empty" role="status">
              {mode === 'member' ? (
                <Flower2 size={32} aria-hidden="true" />
              ) : (
                <ClipboardList size={32} aria-hidden="true" />
              )}
              <h3>{items.length ? 'Không tìm thấy yêu cầu phù hợp' : 'Chưa có đơn đặt trước'}</h3>
              <p>
                {items.length
                  ? mode === 'seller'
                    ? 'Thử đổi trạng thái, từ khóa hoặc ngày nhận để tìm đơn.'
                    : mode === 'admin'
                      ? 'Thử đổi trạng thái hoặc từ khóa. Bộ lọc áp dụng cho trang đang xem.'
                      : 'Không có yêu cầu phù hợp bộ lọc trong trang này.'
                  : mode === 'member' && page === 1
                    ? 'Chọn một mẫu hoa bạn thích và gửi mong muốn cho shop. Đơn của bạn sẽ xuất hiện tại đây.'
                    : 'Chưa có yêu cầu ở trang này.'}
              </p>
              {mode === 'member' && items.length === 0 && page === 1 && (
                <Link href="/dat-hoa" className="button button-outline">
                  Khám phá hoa <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
          {mode === 'admin' && displayItems.length > 0 && (
            <div className="admin-preorder-columns" aria-hidden="true">
              <span>Đơn / mẫu hoa</span>
              <span>Shop / tủ nhận</span>
              <span>Lịch nhận / giá</span>
              <span>Trạng thái</span>
            </div>
          )}
          <ul
            className={
              mode === 'seller'
                ? styles.orderList
                : mode === 'member'
                  ? 'member-orders customer-order-list'
                  : 'admin-preorder-list'
            }
          >
            {displayItems.map((row) => (
              <li key={row.id}>
                <details id={`preorder-${row.id}`} open={row.id === returnedRequest || undefined}>
                  <summary
                    className={
                      mode === 'seller'
                        ? styles.orderSummary
                        : mode === 'member'
                          ? customerStyles.summary
                          : 'admin-preorder-row'
                    }
                  >
                    {mode === 'seller' ? (
                      <span className={styles.orderHeading}>
                        <strong>{row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}</strong>
                        <span className={styles.kind}>
                          {row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn'}
                        </span>
                        <span
                          className={styles.status}
                          data-status={
                            row.ready && row.orderStatus === 'PAID'
                              ? 'READY'
                              : row.orderStatus || row.state
                          }
                        >
                          {statusName(row)}
                        </span>
                      </span>
                    ) : mode === 'member' ? (
                      <span className={customerStyles.content}>
                        <span className={customerStyles.heading}>
                          <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
                          <span
                            className="order-status-pill"
                            data-status={
                              row.ready && row.orderStatus === 'PAID'
                                ? 'READY'
                                : row.orderStatus || row.state
                            }
                          >
                            {statusName(row)}
                          </span>
                        </span>
                        <span className={customerStyles.shop}>
                          {row.shopName || 'Shop nhận yêu cầu'} ·{' '}
                          {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}
                        </span>
                        <span className={customerStyles.facts}>
                          <span>
                            <small>Tủ nhận hoa</small>
                            <span>{row.kioskName || 'Xem địa điểm trong chi tiết'}</span>
                          </span>
                          <span>
                            <small>
                              Lịch nhận {row.state === 'REQUESTED' ? 'mong muốn' : 'dự kiến'}
                            </small>
                            <span>{when(row.pickupAt)}</span>
                          </span>
                          <span>
                            <small>Giá shop báo</small>
                            <strong>
                              {row.quotedPrice == null ? 'Chưa có báo giá' : money(row.quotedPrice)}
                            </strong>
                          </span>
                        </span>
                        <span className={customerStyles.next}>
                          <span>{customerOrderHint(row)}</span>
                          <span className={customerStyles.action}>
                            {customerOrderActionLabel(row)}{' '}
                            <ArrowRight size={16} aria-hidden="true" />
                          </span>
                        </span>
                      </span>
                    ) : (
                      <>
                        <span className="admin-preorder-cell">
                          <strong>{row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}</strong>
                          <small>
                            {row.productName ||
                              (row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn')}
                          </small>
                        </span>
                        <span className="admin-preorder-cell">
                          <strong>{row.shopName || 'Chưa rõ shop'}</strong>
                          <small>{row.kioskName || 'Chưa rõ tủ nhận'}</small>
                        </span>
                        <span className="admin-preorder-cell admin-preorder-schedule">
                          <span>{when(row.pickupAt)}</span>
                          <small>
                            {row.quotedPrice == null ? 'Chưa báo giá' : money(row.quotedPrice)}
                          </small>
                        </span>
                        <span className="admin-preorder-state">
                          <span
                            className="order-status-pill"
                            data-status={
                              row.ready && row.orderStatus === 'PAID'
                                ? 'READY'
                                : row.orderStatus || row.state
                            }
                          >
                            {statusName(row)}
                          </span>
                          <ChevronDown size={17} aria-hidden="true" />
                        </span>
                      </>
                    )}
                    {mode === 'seller' && (
                      <>
                        <span className={styles.orderBody}>
                          <span className={styles.product}>
                            <span className={styles.flowerIcon}>
                              <Flower2 size={24} aria-hidden="true" />
                            </span>
                            <span>
                              <small>Mẫu hoa</small>
                              <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
                            </span>
                          </span>
                          <span>
                            <small>Tủ nhận hoa</small>
                            <strong>{row.kioskName || row.kioskId}</strong>
                            {row.address && <span className={styles.address}>{row.address}</span>}
                          </span>
                          <span>
                            <small>Thời gian nhận</small>
                            <strong>{pickupDate(row.pickupAt)}</strong>
                            <span className={styles.address}>
                              {pickupClock(row.pickupAt)} –{' '}
                              {pickupDayKey(row.pickupAt) !== pickupDayKey(row.pickupBefore)
                                ? `${pickupDate(row.pickupBefore)} · `
                                : ''}
                              {pickupClock(row.pickupBefore)}
                            </span>
                          </span>
                          <span className={styles.price}>
                            <small>Giá xác nhận</small>
                            <strong>
                              {row.quotedPrice == null ? 'Chưa báo giá' : money(row.quotedPrice)}
                            </strong>
                          </span>
                        </span>
                        <span className={styles.disclosure}>
                          <span className={styles.nextTask}>{sellerOrderHint(row)}</span>
                          <span className={styles.showDetails}>
                            {sellerOrderActionLabel(row)}{' '}
                            <ArrowRight size={15} aria-hidden="true" />
                          </span>
                          <span className={styles.hideDetails}>Thu gọn chi tiết</span>
                        </span>
                      </>
                    )}
                  </summary>
                  <OrderActions
                    row={row}
                    base={base}
                    mode={mode}
                    role={session.data?.role}
                    page={page}
                    filter={filter}
                    onReload={async () => {
                      const fresh = await query.refetch();
                      if (fresh.isError || !fresh.data?.items.some((item) => item.id === row.id))
                        throw new Error('Order could not be reloaded.');
                    }}
                  />
                </details>
              </li>
            ))}
          </ul>
          {mode === 'seller' && query.data.hasMore && (
            <div className={styles.loadMore}>
              <p>Chưa tải hết đơn của shop. Tải thêm để tiếp tục tìm và thống kê.</p>
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => setQueueLimit((value) => value + 50)}
              >
                Tải thêm đơn của shop
              </Button>
            </div>
          )}
          {(mode === 'seller' ? totalResultPages > 1 : page > 1 || query.data.hasMore) && (
            <nav className="order-pagination" aria-label="Phân trang đơn đặt trước">
              <Button
                variant="outline"
                disabled={displayPage === 1 || query.isFetching}
                onClick={() =>
                  mode === 'seller' ? setResultPage(displayPage - 1) : setPage((value) => value - 1)
                }
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span>{mode === 'member' ? 'Yêu cầu trước' : 'Trang trước'}</span>
              </Button>
              <span className="order-page-indicator">
                Trang {displayPage}
                {mode === 'seller' ? ` / ${totalResultPages}` : ''}
              </span>
              <Button
                variant="outline"
                disabled={
                  (mode === 'seller' ? displayPage >= totalResultPages : !query.data.hasMore) ||
                  query.isFetching
                }
                onClick={() =>
                  mode === 'seller' ? setResultPage(displayPage + 1) : setPage((value) => value + 1)
                }
              >
                <span>{mode === 'member' ? 'Yêu cầu sau' : 'Trang sau'}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </Container>
  );
}
