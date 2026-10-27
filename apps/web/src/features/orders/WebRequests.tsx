'use client';

import { useEffect, useRef, useState } from 'react';
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
} from '@florabot/ui';
import { ApiError, queryClient, request } from '../../api';
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
  const [confirm, setConfirm] = useState(false);
  const [reviewedQuote, setReviewedQuote] = useState<{
    price: number | null;
    pickupAt: string;
    note: string | null;
  } | null>(null);
  const slots = useQuery({
    queryKey: ['seller-kiosk-slots', row.sellerId, row.kioskId],
    queryFn: () =>
      request<components['schemas']['SellerSlotResponse'][]>(`/me/kiosks/${row.kioskId}/slots`),
    enabled: action === 'fulfill' && Boolean(row.kioskId),
  });
  const emptyKioskSlots =
    slots.data?.filter((item) => item.kioskId === row.kioskId && item.status === 'RENTED_EMPTY') ??
    [];
  const preorderSlots = emptyKioskSlots.filter(
    (item) => !item.slotCode.trim().toUpperCase().startsWith('W'),
  );
  const fulfillSlots = preorderSlots.length > 0 ? preorderSlots : emptyKioskSlots;
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
  return (
    <div className="web-order-actions">
      <div className="order-next-step" role="note">
        <strong>Bước tiếp theo</strong>
        <p>{orderNextStep(row, mode)}</p>
      </div>
      {!orderClosed(row) && !['DISPUTED', 'DISPENSE_FAILED'].includes(row.orderStatus ?? '') && (
        <ol className="order-progress" aria-label="Tiến độ đơn đặt hoa">
          {['Yêu cầu', 'Báo giá & thanh toán', 'Chuẩn bị', 'Sẵn sàng nhận', 'Hoàn tất'].map(
            (label, index) => (
              <li
                key={label}
                data-complete={index < orderStage(row)}
                aria-current={index === orderStage(row) ? 'step' : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                {label}
              </li>
            ),
          )}
        </ol>
      )}
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
      {row.quoteNote && <p className="incident-text">Shop ghi chú: {row.quoteNote}</p>}
      {mode === 'member' && row.orderStatus === 'PAID' && row.ready && (
        <p>
          Hoa đã ở trong tủ. Đến đúng tủ trong khung giờ hẹn và dùng mã trên biên nhận để nhận hoa.
        </p>
      )}
      {mode === 'member' && row.orderId && row.trackingToken && (
        <div className="order-pickup-credentials" aria-label="Thông tin nhận hoa tại Kiosk">
          <dl className="bank-summary">
            <div>
              <dt>ID biên nhận (nhập tại Kiosk)</dt>
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
        {mode === 'seller' && row.kind === 'CUSTOM' && row.orderStatus === 'PAID' && !row.ready && (
          <Button
            disabled={busy || uncertain}
            onClick={() => {
              setAction('fulfill');
              setConfirm(false);
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
          onSubmit={(event) => {
            event.preventDefault();
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
            <h3>
              {action === 'accept'
                ? 'Xác nhận mẫu, giá và lịch nhận'
                : action === 'quote'
                  ? 'Phản hồi yêu cầu đặt hoa'
                  : action === 'fulfill'
                    ? 'Xác nhận hoa đã nằm đúng ô'
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
                  Shop chưa thể nhận đơn này
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
            {action === 'fulfill' && (
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
                  <option value="">Chọn ô đã nạp</option>
                  {fulfillSlots.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.slotCode}
                    </option>
                  ))}
                </select>
                {slots.isError && <p role="alert">Chưa tải được ô. Đóng biểu mẫu rồi mở lại.</p>}
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
            {action === 'cancel' && row.orderStatus === 'PAID' && (
              <p>
                Đơn đã thanh toán sẽ tạo yêu cầu hoàn tiền để ADMIN xử lý; đây không phải hoàn tiền
                ngân hàng tự động.
              </p>
            )}
            <label className="payout-checkbox">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
                disabled={busy}
              />
              Tôi đã đối chiếu và xác nhận thông tin trên.
            </label>
            <div className="stock-actions">
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang gửi…' : 'Xác nhận gửi'}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>
                Quay lại hồ sơ
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
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<OrderFilter>('all');
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
  const filtered = items.filter((row) => matchesOrderFilter(row, filter, mode));
  return (
    <section id="web-orders" className="web-orders" aria-labelledby="web-orders-title">
      <h2 id="web-orders-title">
        {mode === 'member' ? 'Đơn đặt hoa của bạn' : 'Đơn đặt trước từ website'}
      </h2>
      <p>
        {mode === 'member'
          ? 'Theo dõi báo giá, thanh toán và thời điểm hoa sẵn sàng tại tủ.'
          : 'Đơn mẫu riêng cần báo giá, xác nhận thanh toán rồi nạp đúng bó hoa vào ô của shop.'}
      </p>
      <div
        className="operations-metrics order-summary-strip"
        aria-label="Tóm tắt trang đơn đang xem"
      >
        <div className="operations-metric">
          <ClipboardList aria-hidden="true" />
          <span>Yêu cầu trong trang</span>
          <strong>{items.length}</strong>
          <small>Toàn bộ đơn hiển thị</small>
        </div>
        <div className="operations-metric">
          <CircleAlert aria-hidden="true" />
          <span>Cần theo dõi</span>
          <strong>{items.filter((row) => needsOrderAction(row, mode)).length}</strong>
          <small>Chờ phản hồi / xử lý</small>
        </div>
        <div className="operations-metric">
          <Package aria-hidden="true" />
          <span>Đang chuẩn bị</span>
          <strong>{items.filter((row) => row.orderStatus === 'PAID' && !row.ready).length}</strong>
          <small>Đã thanh toán · cần nạp</small>
        </div>
        <div className="operations-metric">
          <Boxes aria-hidden="true" />
          <span>Sẵn sàng tại tủ</span>
          <strong>{items.filter((row) => row.ready && row.orderStatus === 'PAID').length}</strong>
          <small>Khách có thể nhận hoa</small>
        </div>
      </div>
      <p className="quiet">
        Số lượng và bộ lọc áp dụng cho trang hiện tại, không phải tổng toàn bộ đơn hàng.
      </p>
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
            <option value="all">Tất cả yêu cầu</option>
            <option value="attention">Cần theo dõi</option>
            <option value="preparing">Đang chuẩn bị</option>
            <option value="ready">Sẵn sàng tại tủ</option>
            <option value="closed">Đã kết thúc</option>
          </select>
        </div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw size={16} aria-hidden="true" className={query.isFetching ? 'spin' : ''} />
          {query.isFetching ? 'Đang cập nhật…' : 'Cập nhật đơn đặt trước'}
        </Button>
      </div>
      {query.isPending ? (
        <p role="status">Đang tải yêu cầu…</p>
      ) : query.isError ? (
        <p role="alert">Chưa tải được yêu cầu. Hãy chọn cập nhật để thử lại.</p>
      ) : (
        <>
          {!filtered.length && (
            <div className="operations-empty" role="status">
              <ClipboardList size={32} aria-hidden="true" />
              <h3>Chưa có đơn đặt trước</h3>
              <p>
                {items.length
                  ? 'Không có yêu cầu phù hợp bộ lọc trong trang này.'
                  : 'Chưa có yêu cầu ở trang này.'}
              </p>
            </div>
          )}
          <ul className="member-orders">
            {filtered.map((row) => (
              <li key={row.id}>
                <details>
                  <summary>
                    <strong>
                      {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`} ·{' '}
                      {row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn'}
                    </strong>
                    <span className="order-status-pill" data-status={row.orderStatus || row.state}>
                      {statusName(row)}
                    </span>
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
        </>
      )}
    </section>
  );
}
