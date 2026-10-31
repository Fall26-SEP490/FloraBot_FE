'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  ClipboardList,
  CircleAlert,
  Package,
  Boxes,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Flower2,
} from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import {
  matchesOrderFilter,
  needsOrderAction,
  orderClosed,
  orderNextStep,
  orderStage,
  statusName,
  money,
  when,
} from './orders.utils';
import type { OrderFilter, Page, WebOrder } from './orders.types';
import styles from './seller-orders.module.css';

const sellerFilters: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'attention', label: 'Cần xử lý' },
  { value: 'requested', label: 'Chờ báo giá' },
  { value: 'quoted', label: 'Chờ xác nhận' },
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
  onReload,
}: {
  row: WebOrder;
  base: string;
  mode: 'member' | 'seller' | 'admin';
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
  const [checking, setChecking] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedField, setCopiedField] = useState<'' | 'orderId' | 'token'>('');
  const [link, setLink] = useState<string | null>(null);
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
  async function copyText(value: string, field: 'orderId' | 'token') {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(''), 2000);
    } catch {
      /* Clipboard permission may be unavailable in some contexts */
    }
  }
  async function send(kind: string, body: unknown) {
    if (sending.current || uncertain) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<{ checkoutUrl?: string }>(`${base}/${row.id}/${kind}`, body);
      if (kind === 'payment-link') {
        const url = new URL(result.checkoutUrl || '');
        if (
          url.protocol !== 'https:' ||
          url.hostname !== 'pay.payos.vn' ||
          url.username ||
          url.password
        )
          throw new Error('Liên kết thanh toán không hợp lệ.');
        setLink(url.href);
      } else {
        setAction(null);
        setConfirm(false);
        setNotice('Đã cập nhật yêu cầu.');
      }
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.status >= 500 || cause.status === 408) {
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
      sending.current = false;
      setBusy(false);
    }
  }
  const canCancel = !row.orderStatus
    ? ['REQUESTED', 'QUOTED'].includes(row.state)
    : row.orderStatus === 'AWAITING_PAYMENT' || (mode !== 'member' && row.orderStatus === 'PAID');
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
        {!(mode === 'seller' && orderClosed(row)) && <strong>Bước tiếp theo</strong>}
        <p>{orderNextStep(row, mode)}</p>
      </div>
      {mode !== 'seller' &&
        !orderClosed(row) &&
        !['DISPUTED', 'DISPENSE_FAILED'].includes(row.orderStatus ?? '') &&
        progress}
      {mode !== 'seller' && (
        <>
          <p>
            <strong>{row.productName}</strong> · {row.shopName}
          </p>
          <p>
            Tủ nhận: {row.kioskName || row.kioskId} · {row.address}
          </p>
          <p>{row.instructions || 'Mua bó hoa có sẵn tại tủ.'}</p>
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
      {mode === 'member' && row.orderStatus === 'PAID' && row.ready && (
        <p>
          Hoa đã ở trong tủ. Đến đúng tủ trong khung giờ hẹn, chọn “Nhận đơn đặt trước” và xác thực
          OTP qua SMS bằng số điện thoại đã lưu trong hồ sơ tài khoản đặt đơn. Giữ biên nhận để tra
          cứu hoặc dùng chức năng nhận bằng biên nhận khi cần.
        </p>
      )}
      {mode === 'member' && row.orderId && row.trackingToken && (
        <div className="order-pickup-credentials" aria-label="Thông tin nhận hoa tại Kiosk">
          <dl className="bank-summary">
            <div>
              <dt>ID biên nhận (nhận bằng biên nhận)</dt>
              <dd>
                <code>{row.orderId}</code>{' '}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyText(row.orderId!, 'orderId')}
                >
                  {copiedField === 'orderId' ? 'Đã chép ID' : 'Sao chép ID'}
                </Button>
              </dd>
            </div>
            <div>
              <dt>Mã biên nhận 8 ký tự</dt>
              <dd>
                <code>{row.trackingToken}</code>{' '}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyText(row.trackingToken!, 'token')}
                >
                  {copiedField === 'token' ? 'Đã chép mã' : 'Sao chép mã'}
                </Button>
              </dd>
            </div>
          </dl>
          <a
            href={`/receipt#order=${encodeURIComponent(row.orderId)}&token=${encodeURIComponent(row.trackingToken)}`}
            referrerPolicy="no-referrer"
          >
            Xem biên nhận, mã nhận hoa và hỗ trợ hoàn tiền
          </a>
        </div>
      )}
      {!action && (
        <div className="stock-actions">
          {mode === 'member' && row.state === 'QUOTED' && !row.orderId && (
            <Button
              disabled={
                busy ||
                uncertain ||
                (!!row.quoteExpiresAt && new Date(row.quoteExpiresAt).getTime() <= now)
              }
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
              disabled={
                busy || uncertain || (!!row.payBefore && new Date(row.payBefore).getTime() <= now)
              }
              onClick={() => void send('payment-link', {})}
            >
              Tạo liên kết thanh toán
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
          {canCancel && (
            <Button
              variant="outline"
              disabled={busy || uncertain}
              onClick={() => {
                setAction('cancel');
                setConfirm(false);
                setNote('');
              }}
            >
              Hủy yêu cầu
            </Button>
          )}
        </div>
      )}
      {row.payBefore && row.orderStatus === 'AWAITING_PAYMENT' && (
        <p>
          Thanh toán trước {when(row.payBefore)}. Hết hạn, yêu cầu thanh toán không còn hiệu lực.
        </p>
      )}
      {link && row.orderStatus === 'AWAITING_PAYMENT' && (
        <a className="button button-primary" href={link} target="_blank" rel="noopener noreferrer">
          Mở trang thanh toán payOS (tab mới)
        </a>
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
                Bạn đồng ý giá {money(reviewedQuote.price || 0)}, nhận từ{' '}
                {when(reviewedQuote.pickupAt)}. Nội dung: {reviewedQuote.note}. Bước tiếp theo là
                thanh toán; hoa chỉ được chuẩn bị sau khi thanh toán được xác nhận.
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
                <span>Tôi đã đối chiếu và xác nhận thông tin trên.</span>
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
                  disabled={busy}
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
                setLink(null);
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
  const params = useSearchParams();
  const initialPage = Number(params.get('page'));
  const initialFilter = params.get('filter');
  const filters: OrderFilter[] = [
    'all',
    'attention',
    'requested',
    'quoted',
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
  const [search, setSearch] = useState('');
  const [pickupDay, setPickupDay] = useState('');
  const base =
    mode === 'member'
      ? '/member/preorders'
      : mode === 'admin'
        ? '/admin/preorders'
        : `/sellers/${sellerId}/preorders`;
  const query = useQuery({
    queryKey: ['web-orders', base, page],
    queryFn: () => request<Page>(`${base}?page=${page}`),
    refetchInterval: (q) =>
      q.state.data?.items?.some((item) => item.orderStatus === 'AWAITING_PAYMENT') ? 5_000 : 30_000,
    enabled: mode !== 'seller' || Boolean(sellerId),
  });
  const items = query.data?.items ?? [];
  const Container = mode === 'seller' ? 'div' : 'section';
  const filtered = items.filter(
    (row) =>
      matchesOrderFilter(row, filter, mode) &&
      (mode !== 'seller' ||
        ((!search.trim() ||
          searchable(
            [row.orderCode, row.id, row.productName, row.kioskName, row.address]
              .filter(Boolean)
              .join(' '),
          ).includes(searchable(search.trim()))) &&
          (!pickupDay || pickupDayKey(row.pickupAt) === pickupDay))),
  );
  return (
    <Container
      id="web-orders"
      className={`web-orders ${mode === 'seller' ? styles.sellerOrders : ''}`}
      aria-labelledby="web-orders-title"
    >
      <h2 id="web-orders-title" className={mode === 'seller' ? 'sr-only' : undefined}>
        {mode === 'member' ? 'Đơn đặt trước' : 'Đơn đặt trước từ website'}
      </h2>
      {mode !== 'seller' && (
        <p>
          {mode === 'member'
            ? 'Theo dõi yêu cầu, duyệt báo giá và xem lịch nhận hoa của bạn.'
            : 'Đơn mẫu riêng cần báo giá, xác nhận thanh toán rồi nạp đúng bó hoa vào ô của shop.'}
        </p>
      )}
      {mode === 'seller' && (
        <>
          <div className={styles.summary} aria-label={`Thống kê đơn ở trang ${page}`}>
            {[
              { label: 'Yêu cầu trong trang', value: 'all' as OrderFilter, icon: ClipboardList },
              { label: 'Cần xử lý', value: 'attention' as OrderFilter, icon: CircleAlert },
              { label: 'Đang chuẩn bị', value: 'preparing' as OrderFilter, icon: Package },
              { label: 'Sẵn sàng tại tủ', value: 'ready' as OrderFilter, icon: Boxes },
            ].map(({ label, value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                <span className={styles.statIcon}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <small>{label}</small>
                  <strong>
                    {query.isError
                      ? '—'
                      : query.isPending
                        ? '…'
                        : items.filter((row) => matchesOrderFilter(row, value, mode)).length}
                  </strong>
                </span>
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <div className={styles.filterHeading}>
              <div>
                <h3>Danh sách yêu cầu</h3>
                <p>Thống kê, tìm kiếm và bộ lọc áp dụng trong trang {page}.</p>
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
            <div className={styles.tabs} aria-label="Lọc trạng thái đơn">
              {sellerFilters.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  {value === 'attention' && query.isSuccess && (
                    <span>
                      {items.filter((row) => matchesOrderFilter(row, value, mode)).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className={styles.searchBar}>
              <label className={styles.searchField}>
                <span>Tìm yêu cầu</span>
                <input
                  type="search"
                  value={search}
                  placeholder="Mã đơn, tên hoa hoặc kiosk…"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className={styles.dateField}>
                <span>Ngày bắt đầu nhận</span>
                <input
                  type="date"
                  value={pickupDay}
                  onInput={(event) => setPickupDay(event.currentTarget.value)}
                  onChange={(event) => setPickupDay(event.target.value)}
                />
              </label>
            </div>
          </div>
          {query.isSuccess && (
            <p className={styles.resultCount} role="status">
              Hiển thị {filtered.length} / {items.length} yêu cầu · Trang {page}
            </p>
          )}
        </>
      )}
      {mode !== 'seller' && query.data && (mode !== 'member' || items.length > 0) && (
        <div
          className="operations-metrics order-summary-strip"
          aria-label="Tóm tắt trang đơn đang xem"
        >
          <div className="operations-metric">
            <ClipboardList aria-hidden="true" />
            <span>{mode === 'member' ? 'Đơn đang xem' : 'Yêu cầu trong trang'}</span>
            <strong>{items.length}</strong>
            <small>{mode === 'member' ? `Trang ${page}` : 'Toàn bộ đơn hiển thị'}</small>
          </div>
          <div className="operations-metric">
            <CircleAlert aria-hidden="true" />
            <span>{mode === 'member' ? 'Cần phản hồi' : 'Cần theo dõi'}</span>
            <strong>{items.filter((row) => needsOrderAction(row, mode)).length}</strong>
            <small>{mode === 'member' ? 'Kiểm tra bước tiếp theo' : 'Chờ phản hồi / xử lý'}</small>
          </div>
          <div className="operations-metric">
            <Package aria-hidden="true" />
            <span>Đang chuẩn bị</span>
            <strong>
              {items.filter((row) => row.orderStatus === 'PAID' && !row.ready).length}
            </strong>
            <small>
              {mode === 'member' ? 'Shop đang chuẩn bị hoa' : 'Đã thanh toán · cần nạp'}
            </small>
          </div>
          <div className="operations-metric">
            <Boxes aria-hidden="true" />
            <span>Sẵn sàng tại tủ</span>
            <strong>{items.filter((row) => row.ready && row.orderStatus === 'PAID').length}</strong>
            <small>{mode === 'member' ? 'Bạn có thể đến nhận' : 'Khách có thể nhận hoa'}</small>
          </div>
        </div>
      )}
      {mode !== 'seller' && query.data && (mode !== 'member' || items.length > 0) && (
        <p className="quiet order-page-note">
          {mode === 'member'
            ? `Thống kê và bộ lọc tính trên ${items.length} đơn ở trang ${page}.`
            : `Thống kê và bộ lọc chỉ áp dụng cho ${items.length} đơn ở trang ${page}.`}
        </p>
      )}
      {mode !== 'seller' && (
        <div className="queue-filter-bar order-filter-bar">
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
              <option value="attention">Cần theo dõi</option>
              <option value="requested">Chờ báo giá</option>
              <option value="quoted">Chờ khách xác nhận</option>
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
            {query.isFetching ? 'Đang cập nhật…' : mode === 'member' ? 'Làm mới' : 'Làm mới'}
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
                  ? 'Không có yêu cầu phù hợp bộ lọc trong trang này.'
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
          <ul className={mode === 'seller' ? styles.orderList : 'member-orders'}>
            {filtered.map((row) => (
              <li key={row.id}>
                <details>
                  <summary className={mode === 'seller' ? styles.orderSummary : undefined}>
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
                    ) : (
                      <>
                        <strong>
                          {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`} ·{' '}
                          {row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn'}
                        </strong>
                        <span
                          className="order-status-pill"
                          data-status={row.orderStatus || row.state}
                        >
                          {statusName(row)}
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
                          <span className={styles.showDetails}>Xem chi tiết & thao tác</span>
                          <span className={styles.hideDetails}>Thu gọn chi tiết</span>
                          <ArrowRight size={15} aria-hidden="true" />
                        </span>
                      </>
                    )}
                  </summary>
                  <OrderActions
                    row={row}
                    base={base}
                    mode={mode}
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
          {(page > 1 || query.data.hasMore) && (
            <nav className="order-pagination" aria-label="Phân trang đơn đặt trước">
              <Button
                variant="outline"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Yêu cầu trước</span>
              </Button>
              <span className="order-page-indicator">Trang {page}</span>
              <Button
                variant="outline"
                disabled={!query.data.hasMore || query.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                <span>Yêu cầu sau</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </Container>
  );
}
