import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from './api';
import type { components } from '../../../packages/contracts/src/generated/api';

export type WebOrder = {
  id: string;
  kind: 'CUSTOM' | 'STOCK';
  state: string;
  productId: string;
  kioskId: string;
  sellerId: string;
  instructions: string;
  pickupAt: string;
  pickupBefore: string;
  quotedPrice: number | null;
  quoteNote: string | null;
  quoteExpiresAt: string | null;
  orderId: string | null;
  checkoutId: string | null;
  orderCode: string | null;
  orderStatus: string | null;
  trackingToken: string | null;
  ready: boolean;
  payBefore: string | null;
  productName?: string | null;
  shopName?: string | null;
  kioskName?: string | null;
  address?: string | null;
};
type Page = { items: WebOrder[]; page: number; hasMore: boolean };
const money = (value: number) => value.toLocaleString('vi-VN') + ' đ';
const when = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const orderStates: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Shop đang chuẩn bị',
  DISPENSING: 'Đang nhận hoa tại tủ',
  COMPLETED: 'Đã nhận hoa',
  EXPIRED: 'Hết hạn thanh toán',
  CANCELLED: 'Đã hủy',
  DISPENSE_FAILED: 'Chờ xử lý hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang xử lý phản ánh',
};
const requestStates: Record<string, string> = {
  REQUESTED: 'Chờ shop báo giá',
  QUOTED: 'Đã có báo giá',
  REJECTED: 'Shop chưa thể nhận đơn',
  CANCELLED: 'Đã hủy',
  ORDERED: 'Đã tạo đơn',
};
export const statusName = (row: WebOrder) =>
  row.orderStatus === 'PAID' && row.ready
    ? 'Hoa đã sẵn sàng tại tủ'
    : row.orderStatus
      ? orderStates[row.orderStatus] || row.orderStatus
      : requestStates[row.state] || row.state;

function OrderActions({
  row,
  base,
  mode,
}: {
  row: WebOrder;
  base: string;
  mode: 'member' | 'seller' | 'admin';
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [action, setAction] = useState<'quote' | 'fulfill' | 'cancel' | 'accept' | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
    queryKey: ['seller-slots', row.sellerId],
    queryFn: () =>
      request<components['schemas']['SellerSlotResponse'][]>(`/sellers/${row.sellerId}/slots`),
    enabled: action === 'fulfill',
  });
  async function send(kind: string, body: unknown) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<{ checkoutUrl?: string }>(`${base}/${row.id}/${kind}`, body);
      if (kind === 'payment-link') {
        const url = new URL(result.checkoutUrl || '');
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new Error('Liên kết thanh toán không hợp lệ.');
        setLink(url.href);
      } else {
        setAction(null);
        setConfirm(false);
        setNotice('Đã cập nhật yêu cầu.');
      }
    } catch (cause) {
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
        <a
          href={`/receipt#order=${encodeURIComponent(row.orderId)}&token=${encodeURIComponent(row.trackingToken)}`}
          referrerPolicy="no-referrer"
        >
          Xem biên nhận, mã nhận hoa và hỗ trợ hoàn tiền
        </a>
      )}
      <div className="stock-actions">
        {mode === 'member' && row.state === 'QUOTED' && !row.orderId && (
          <Button
            disabled={
              busy || (!!row.quoteExpiresAt && new Date(row.quoteExpiresAt).getTime() <= now)
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
            disabled={busy || (!!row.payBefore && new Date(row.payBefore).getTime() <= now)}
            onClick={() => void send('payment-link', {})}
          >
            Tạo liên kết thanh toán
          </Button>
        )}
        {mode === 'seller' && ['REQUESTED', 'QUOTED'].includes(row.state) && (
          <Button
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
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
                {action === 'cancel' ? 'Lý do hủy' : 'Mô tả mẫu hoa, điều kiện hoặc lý do từ chối'}
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
                Chỉ xác nhận sau khi đã nạp bó hoa theo yêu cầu. Thao tác này giữ ô riêng cho khách,
                chưa mở cửa nhận hoa.
              </p>
              <label htmlFor={`order-slot-${row.id}`}>Ô trống tại tủ nhận</label>
              <select
                id={`order-slot-${row.id}`}
                required
                value={slot}
                onChange={(event) => setSlot(event.target.value)}
              >
                <option value="">Chọn ô đã nạp</option>
                {slots.data
                  ?.filter((item) => item.kioskId === row.kioskId && item.status === 'RENTED_EMPTY')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.slotCode}
                    </option>
                  ))}
              </select>
              {slots.isError && <p role="alert">Chưa tải được ô. Đóng biểu mẫu rồi mở lại.</p>}
              <label htmlFor={`order-qr-${row.id}`}>Mã QR của bó hoa</label>
              <input
                id={`order-qr-${row.id}`}
                required
                maxLength={120}
                value={qr}
                onChange={(event) => setQr(event.target.value)}
              />
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
        </form>
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
  const base =
    mode === 'member'
      ? '/member/preorders'
      : mode === 'admin'
        ? '/admin/preorders'
        : `/sellers/${sellerId}/preorders`;
  const query = useQuery({
    queryKey: ['web-orders', base, page],
    queryFn: () => request<Page>(`${base}?page=${page}`),
    refetchInterval: 30_000,
  });
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
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
        Cập nhật đơn đặt trước
      </Button>
      {query.isPending ? (
        <p role="status">Đang tải yêu cầu…</p>
      ) : query.isError ? (
        <p role="alert">Chưa tải được yêu cầu. Hãy chọn cập nhật để thử lại.</p>
      ) : (
        <>
          {!query.data.items.length && <p>Chưa có yêu cầu ở trang này.</p>}
          <ul className="member-orders">
            {query.data.items.map((row) => (
              <li key={row.id}>
                <details>
                  <summary>
                    <strong>
                      {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`} ·{' '}
                      {row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn'}
                    </strong>
                    <span>{statusName(row)}</span>
                  </summary>
                  <OrderActions row={row} base={base} mode={mode} />
                </details>
              </li>
            ))}
          </ul>
          <nav className="stock-actions" aria-label="Phân trang đơn đặt trước">
            <Button
              variant="outline"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Yêu cầu trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!query.data.hasMore || query.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Yêu cầu sau
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
