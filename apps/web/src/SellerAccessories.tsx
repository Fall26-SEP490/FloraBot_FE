import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Button, CheckCircle2, MapPin, Package, RefreshCw } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, request, type Session } from './api';

type Accessory = components['schemas']['SellerAccessoryResponse'];
const kioskStatuses: Record<string, string> = {
  ONLINE: 'Tủ đang trực tuyến',
  OFFLINE: 'Tủ đang mất kết nối',
  MAINTENANCE: 'Tủ đang bảo trì',
};

function Restock({
  item,
  sellerId,
  refresh,
}: {
  item: Accessory;
  sellerId: string;
  refresh: () => Promise<unknown>;
}) {
  const [quantity, setQuantity] = useState('');
  const [review, setReview] = useState<number>();
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const qty = Number(quantity);
  const valid = /^\d+$/.test(quantity) && Number.isSafeInteger(qty) && qty > 0 && qty <= 2147483647;
  async function submit() {
    if (review === undefined || sending.current || uncertain) return;
    sending.current = true;
    setPending(true);
    setError('');
    try {
      await request(
        `/sellers/${sellerId}/flows/restock_accessory`,
        {
          p_accessory: item.id,
          p_qty: review,
        } satisfies components['schemas']['RestockAccessoryRequest'],
        false,
      );
      setMessage(`Đã bổ sung ${review} phụ kiện ${item.name}.`);
      setQuantity('');
      setReview(undefined);
    } catch (cause) {
      const rejected =
        cause instanceof ApiError && [400, 401, 403, 404, 409, 422, 429].includes(cause.status);
      setUncertain(!rejected);
      setError(
        rejected
          ? cause.message
          : 'Chưa xác định được lần bổ sung này đã ghi nhận chưa. Làm mới tồn và nhờ đội ngũ đối chiếu lịch sử trước khi bổ sung tiếp. Không gửi lại cùng số lượng.',
      );
      setReview(undefined);
    } finally {
      setPending(false);
      sending.current = false;
      confirmation.current?.focus();
      await refresh();
    }
  }
  return (
    <li className="accessory-card">
      <div className="accessory-card-header">
        <div>
          <h3>{item.name}</h3>
          <p className="accessory-kiosk-info">
            <MapPin size={14} aria-hidden="true" />
            <span>
              {item.kioskName} · {item.kioskCode} · {item.kioskAddress}
            </span>
          </p>
        </div>
        <div className="accessory-meta-pills">
          <span className="accessory-stock-pill">
            Tồn hiện tại: <strong>{item.stockQuantity}</strong>
          </span>
          <span className="accessory-price-pill">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
              Number(item.price),
            )}
          </span>
        </div>
      </div>

      <p className="accessory-status-strip">
        <span className="accessory-pill" data-active={item.status === 'ACTIVE'}>
          {item.status === 'ACTIVE' ? 'Phụ kiện đang bật bán' : 'Phụ kiện đang tắt bán'}
        </span>
        {' · '}
        <span className="kiosk-status-pill" data-status={item.kioskStatus}>
          {kioskStatuses[item.kioskStatus] || `Trạng thái tủ: ${item.kioskStatus}`}
        </span>
      </p>

      <form
        className="accessory-restock-box"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || uncertain) return;
          setMessage('');
          if (!valid) {
            setError('Nhập số lượng nguyên từ 1 đến 2.147.483.647.');
            input.current?.focus();
            return;
          }
          setError('');
          setReview(qty);
          requestAnimationFrame(() => reviewPanel.current?.focus());
        }}
      >
        <label htmlFor={`accessory-${item.id}`}>Số lượng bổ sung cho {item.name}</label>
        {review === undefined && (
          <div className="accessory-restock-row">
            <input
              id={`accessory-${item.id}`}
              ref={input}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Nhập số lượng..."
              value={quantity}
              disabled={pending || uncertain}
              onChange={(event) => setQuantity(event.target.value)}
              aria-describedby={`accessory-notice-${item.id}`}
              aria-invalid={!!error && !valid}
            />
            <Button type="submit" disabled={pending || uncertain}>
              Kiểm tra số lượng
            </Button>
          </div>
        )}
        {review !== undefined && (
          <div ref={reviewPanel} tabIndex={-1} className="accessory-review-panel">
            <p>
              Bổ sung <strong>{review}</strong> {item.name} tại {item.kioskName} ({item.kioskCode}).
              Chỉ xác nhận sau khi đã đặt phụ kiện vào đúng tủ.
            </p>
            <div className="stock-actions">
              <Button type="button" disabled={pending} onClick={() => void submit()}>
                {pending ? 'Đang ghi nhận…' : 'Xác nhận bổ sung'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setReview(undefined);
                  requestAnimationFrame(() => input.current?.focus());
                }}
              >
                Sửa số lượng
              </Button>
            </div>
          </div>
        )}
        <p
          id={`accessory-notice-${item.id}`}
          role={error ? 'alert' : 'status'}
          ref={confirmation}
          tabIndex={-1}
          className={error ? 'error' : undefined}
        >
          {error || message}
        </p>
      </form>
    </li>
  );
}

export default function SellerAccessories({ session }: { session: Session }) {
  const [loaded, setLoaded] = useState(false);
  const inventory = useQuery({
    queryKey: ['seller-accessories', session.sellerId],
    queryFn: () => request<Accessory[]>(`/sellers/${session.sellerId}/accessories`),
    enabled: loaded && !!session.sellerId,
  });
  if (!session.sellerId) return null;
  return (
    <section className="seller-accessories" aria-labelledby="accessories-title">
      <div className="accessory-page-header">
        <div>
          <h2 id="accessories-title">Phụ kiện chỉ dành cho đơn đặt trước</h2>
          <p>
            Phụ kiện chỉ áp dụng cho đơn đặt trước. Xem tồn phụ kiện ở từng tủ và ghi nhận số lượng
            vừa bổ sung. Thao tác này chỉ cộng tồn, không tự bật bán phụ kiện hay mở cửa tủ.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={inventory.isFetching}
          onClick={() => {
            if (loaded) void inventory.refetch();
            else setLoaded(true);
          }}
        >
          <RefreshCw size={15} aria-hidden="true" className={inventory.isFetching ? 'spin' : ''} />
          {loaded ? 'Làm mới tồn phụ kiện' : 'Xem tồn phụ kiện'}
        </Button>
      </div>

      {loaded && inventory.data && inventory.data.length > 0 && (
        <div className="operations-metrics order-summary-strip" aria-label="Thống kê phụ kiện">
          <div className="operations-metric">
            <Package aria-hidden="true" />
            <span>Tổng loại phụ kiện</span>
            <strong>{inventory.data.length}</strong>
            <small>Đang quản lý ở các tủ</small>
          </div>
          <div className="operations-metric">
            <Boxes aria-hidden="true" />
            <span>Tổng tồn kho</span>
            <strong>
              {inventory.data.reduce((sum, item) => sum + Number(item.stockQuantity), 0)}
            </strong>
            <small>Số lượng thực tế ở tủ</small>
          </div>
          <div className="operations-metric">
            <CheckCircle2 aria-hidden="true" style={{ color: '#16a34a' }} />
            <span>Đang bật bán</span>
            <strong style={{ color: 'var(--color-status-success-ink)' }}>
              {inventory.data.filter((item) => item.status === 'ACTIVE').length}
            </strong>
            <small>Áp dụng cho đơn trước</small>
          </div>
        </div>
      )}

      {inventory.isFetching && <p role="status">Đang tải tồn phụ kiện…</p>}
      {inventory.isError && (
        <p role="alert" className="error">
          Chưa tải được tồn mới nhất. Chọn “Làm mới tồn phụ kiện” để thử lại.
        </p>
      )}
      {loaded && inventory.data?.length === 0 && (
        <p className="seller-empty-state">Shop chưa có phụ kiện được thiết lập tại tủ.</p>
      )}
      <ul className="admin-shop-list accessory-list">
        {inventory.data?.map((item) => (
          <Restock
            key={item.id}
            item={item}
            sellerId={session.sellerId!}
            refresh={inventory.refetch}
          />
        ))}
      </ul>
    </section>
  );
}
