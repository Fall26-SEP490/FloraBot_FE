import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Flower2, MessageSquare, Store, Users } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { ApiError, request, type Session } from '@/shared/lib/api';
import type { OrderPage } from '../orders/orders.types';
import {
  needsOrderAction,
  orderClosed,
  sellerOrderActionLabel,
  statusName,
} from '../orders/orders.utils';
import { readSellerQueue, sellerQueueKey } from '../orders/seller-queue';
import { getSellerChats } from '../chat/api';
import { fetchProducts } from '../product-management/product.api';
import styles from './styles/seller-overview.module.css';
import SellerRevenue from './SellerRevenue';

const currency = (value: number | string | null | undefined) =>
  value == null
    ? '—'
    : Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const pickupTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
type Staff = { id: string; status: string };
export default function SellerOverview({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const options = { enabled: !!session.sellerId };
  const orders = useQuery({
    ...options,
    refetchInterval: 60_000,
    queryKey: sellerQueueKey(`${base}/preorders`),
    queryFn: ({ signal }) =>
      readSellerQueue((page) => request<OrderPage>(`${base}/preorders?page=${page}`), 50, signal),
  });
  const products = useQuery({
    ...options,
    queryKey: ['dashboard-products', session.id, base],
    queryFn: async () => {
      const data = await fetchProducts();
      if (!Array.isArray(data)) throw new Error('Invalid product response');
      return data;
    },
  });
  const channel = useQuery({
    ...options,
    queryKey: ['seller-payment-channel', session.sellerId],
    queryFn: async () => {
      try {
        return await request<components['schemas']['SellerPaymentChannelResponse']>(
          `${base}/payment-channel`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const staff = useQuery({
    ...options,
    queryKey: ['dashboard-seller-staff', session.id, session.sellerId],
    queryFn: async () => {
      const data = await request<Staff[] | { items: Staff[] }>(`${base}/staff/accounts`);
      const items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items)) throw new Error('Invalid staff response');
      return items;
    },
  });
  const inbox = useQuery({
    ...options,
    refetchInterval: 60_000,
    queryKey: ['seller-inbox-summary', session.id, session.sellerId],
    queryFn: async ({ signal }) => {
      const unread = new Map<string, number>();
      let hasMore = true;
      for (let page = 1; hasMore && page <= 50; page++) {
        signal.throwIfAborted();
        const result = await getSellerChats(session.sellerId!, page);
        signal.throwIfAborted();
        if (!Array.isArray(result.items) || typeof result.hasMore !== 'boolean')
          throw new Error('Invalid chat page');
        const before = unread.size;
        for (const row of result.items) {
          const count = Number(row.unreadCount ?? 0);
          if (!Number.isFinite(count) || count < 0) throw new Error('Invalid unread count');
          unread.set(row.id, count);
        }
        if (result.hasMore && before === unread.size)
          throw new Error('Chat pagination did not advance');
        hasMore = result.hasMore;
      }
      return { conversations: [...unread.values()].filter((count) => count > 0).length, hasMore };
    },
  });
  const [view, setView] = useState<'attention' | 'all'>('attention');
  const queries = [orders, products, channel, staff, inbox];
  const busy = queries.some((query) => query.isFetching);
  const items = orders.data?.items ?? [];
  const actionItems = items.filter((row) => needsOrderAction(row, 'seller'));
  const visibleItems = (view === 'attention' ? actionItems : items).slice(0, 5);
  const activeProducts = products.data?.filter((item) => item.status === 'ACTIVE').length ?? 0;
  const shopStatus =
    (
      {
        ACTIVE: 'Đang hoạt động',
        PAST_DUE: 'Quá hạn gói thuê',
        PENDING: 'Chờ duyệt',
        APPROVED: 'Đã duyệt',
        SUSPENDED: 'Tạm ngưng',
        CLOSED: 'Đã đóng',
      } as Record<string, string>
    )[session.sellerStatus ?? ''] ?? 'Chưa xác định';

  if (!session.sellerId)
    return (
      <p role="status">
        Chưa xác định được shop của tài khoản. Thử đăng nhập lại hoặc liên hệ đội ngũ vận hành.
      </p>
    );
  const activeStaffCount = staff.isSuccess
    ? staff.data.filter((item) => item.status === 'ACTIVE').length
    : 0;

  return (
    <div className={styles.overview}>
      {queries.some((query) => query.isError) && (
        <p role="alert" className={styles.error}>
          Một số dữ liệu chưa tải được.{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => queries.forEach((query) => void query.refetch())}
          >
            {busy ? 'Đang tải…' : 'Thử lại'}
          </button>
        </p>
      )}
      {channel.isSuccess && channel.data?.state !== 'ACTIVE' && (
        <aside
          className={styles.paymentNotice}
          role="status"
          aria-label="Kênh nhận tiền cần thiết lập"
        >
          <div>
            <strong>
              {!channel.data
                ? 'Chưa thiết lập kênh nhận tiền'
                : channel.data.state === 'PAUSED'
                  ? 'Kênh nhận tiền đang tạm dừng'
                  : 'Kênh nhận tiền chưa được kích hoạt'}
            </strong>
            <p>Kiểm tra PayOS để khách có thể thanh toán đơn hoa.</p>
          </div>
          <Link href="/seller/commerce#seller-channel-title">
            Thiết lập nhận tiền <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      )}

      <div className={styles.layout}>
        <SellerRevenue sellerId={session.sellerId} />
        <section
          className={`${styles.card} ${styles.ordersCard}`}
          aria-labelledby="seller-orders-title"
        >
          <div className={styles.heading}>
            <h2 id="seller-orders-title">Đơn cần theo dõi</h2>
            <Link href="/seller/orders">
              Tất cả đơn <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.tabs} role="group" aria-label="Lọc đơn đặt hoa">
            <button aria-pressed={view === 'attention'} onClick={() => setView('attention')}>
              Cần xử lý <span>{orders.isSuccess ? actionItems.length : '—'}</span>
            </button>
            <button aria-pressed={view === 'all'} onClick={() => setView('all')}>
              Gần đây
            </button>
          </div>
          <div
            className={styles.orderSheet}
            role="region"
            aria-label="Bảng đơn cần theo dõi"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Allows keyboard users to scroll the order sheet.
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Mã đơn</th>
                  <th scope="col">Mẫu hoa</th>
                  <th scope="col">Kiosk</th>
                  <th scope="col">Lịch nhận</th>
                  <th scope="col" className={styles.price}>
                    Giá
                  </th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className={styles.action}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.isPending ? (
                  <tr>
                    <td colSpan={7}>
                      <p className={styles.empty} role="status">
                        Đang tải danh sách theo dõi…
                      </p>
                    </td>
                  </tr>
                ) : orders.isError ? (
                  <tr>
                    <td colSpan={7}>
                      <p className={styles.empty}>
                        Chưa tải được đơn đặt hoa. Chọn “Thử lại” ở thông báo phía trên.
                      </p>
                    </td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.empty} role="status">
                        <Check size={20} aria-hidden="true" />
                        <strong>
                          {view === 'attention'
                            ? orders.data?.hasMore
                              ? 'Không có đơn cần xử lý trong các trang đã tải'
                              : 'Không có đơn cần xử lý'
                            : 'Chưa có yêu cầu đặt hoa'}
                        </strong>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {visibleItems.map((row) => (
                      <tr key={row.id}>
                        <td className={styles.orderCode}>
                          {row.orderCode || `#${row.id.slice(0, 8)}`}
                        </td>
                        <td className={styles.productName}>
                          <Link
                            href={`/seller/orders?page=${row.overviewPage}&requestId=${encodeURIComponent(row.id)}`}
                          >
                            {row.productName || 'Hoa theo yêu cầu'}
                          </Link>
                        </td>
                        <td>{row.kioskName || 'Tủ nhận'}</td>
                        <td>
                          <time dateTime={row.pickupAt}>{pickupTime(row.pickupAt)}</time>
                        </td>
                        <td className={styles.price}>
                          {row.quotedPrice == null ? 'Chưa báo giá' : currency(row.quotedPrice)}
                        </td>
                        <td>
                          <span
                            className={styles.badge}
                            data-closed={orderClosed(row)}
                            data-status={row.orderStatus || row.state}
                          >
                            {statusName(row)}
                          </span>
                        </td>
                        <td className={styles.action}>
                          <Link
                            className={styles.openOrder}
                            href={`/seller/orders?page=${row.overviewPage}&requestId=${encodeURIComponent(row.id)}`}
                          >
                            {sellerOrderActionLabel(row)}{' '}
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <p className={styles.footnote}>Hiển thị tối đa 5 đơn đặt trước gần nhất.</p>
        </section>

        <section
          className={`${styles.resourcesCard} ${styles.teamCard}`}
          aria-labelledby="seller-team-title"
        >
          <h2 id="seller-team-title">Cửa hàng của tôi</h2>
          <Link href="/seller/staff" className={styles.resourceRow}>
            <Users size={17} aria-hidden="true" />
            <span>Nhân viên hoạt động</span>
            <strong>
              {staff.isError
                ? '—'
                : staff.isPending
                  ? '…'
                  : `${activeStaffCount}/${staff.data.length}`}
            </strong>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/seller/products" className={styles.resourceRow}>
            <Flower2 size={17} aria-hidden="true" />
            <span>Mẫu hoa đang bán</span>
            <strong>
              {products.isError
                ? '—'
                : products.isPending
                  ? '…'
                  : `${activeProducts}/${products.data.length}`}
            </strong>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/seller/subscriptions" className={styles.resourceRow}>
            <Store size={17} aria-hidden="true" />
            <span>Trạng thái cửa hàng</span>
            <strong>{shopStatus}</strong>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/seller/chats" className={styles.resourceRow}>
            <MessageSquare size={16} aria-hidden="true" />
            <span className={styles.orderInfo}>
              Tin nhắn khách hàng
              <small>
                {inbox.isError
                  ? 'Chưa tải được tin nhắn'
                  : inbox.isPending
                    ? 'Đang kiểm tra…'
                    : `${inbox.data.hasMore ? 'Ít nhất ' : ''}${inbox.data.conversations} cuộc trò chuyện chưa đọc`}
              </small>
            </span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
