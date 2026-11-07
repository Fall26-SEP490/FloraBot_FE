import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Banknote,
  Boxes,
  Check,
  ClipboardList,
  Flower2,
  RefreshCw,
  MessageSquare,
  Store,
  Users,
} from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { ApiError, request, type Session } from '@/shared/lib/api';
import type { OrderFilter, OrderPage, WebOrder } from '../orders/orders.types';
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
const shortcuts = [
  {
    href: '/seller/products',
    title: 'Mẫu hoa',
    detail: 'Tạo mẫu, thêm ảnh và điều chỉnh giá',
    icon: Flower2,
  },
  {
    href: '/seller/stock',
    title: 'Hoa tại tủ',
    detail: 'Kiểm tra ô và ghi nhận bó hoa',
    icon: Boxes,
  },
  {
    href: '/seller/tasks',
    title: 'Giao công việc',
    detail: 'Phân công giao hoa cho nhân viên',
    icon: ClipboardList,
  },
  {
    href: '/seller/kiosks',
    title: 'Vị trí kiosk',
    detail: 'Kiểm tra địa chỉ khách đến nhận',
    icon: Store,
  },
];

export default function SellerOverview({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const options = { enabled: !!session.sellerId, refetchInterval: 60_000 };
  const orders = useQuery({
    ...options,
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
  const sales = useQuery({
    ...options,
    queryKey: ['seller-direct-sales', session.sellerId],
    queryFn: () =>
      request<components['schemas']['SellerSalesReportResponse']>(`${base}/reports/sales`),
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
  const queries = [orders, products, sales, channel, staff, inbox];
  const busy = queries.some((query) => query.isFetching);
  const items = orders.data?.items ?? [];
  const actionItems = items.filter((row) => needsOrderAction(row, 'seller'));
  const visibleItems = (view === 'attention' ? actionItems : items).slice(0, 5);
  const activeProducts = products.data?.filter((item) => item.status === 'ACTIVE').length ?? 0;
  const metrics: {
    label: string;
    detail: string;
    filter: OrderFilter;
    match: (row: WebOrder) => boolean;
  }[] = [
    {
      label: 'Chờ báo giá',
      filter: 'requested',
      detail: 'Phản hồi yêu cầu mới',
      match: (row) => !row.orderStatus && row.state === 'REQUESTED',
    },
    {
      label: 'Chờ khách xác nhận',
      filter: 'quoted',
      detail: 'Theo dõi báo giá đã gửi',
      match: (row) => !row.orderStatus && row.state === 'QUOTED',
    },
    {
      label: 'Chờ thanh toán',
      filter: 'payment',
      detail: 'Khách chưa thanh toán',
      match: (row) => row.orderStatus === 'AWAITING_PAYMENT',
    },
    {
      label: 'Đang chuẩn bị',
      filter: 'preparing',
      detail: 'Hoàn thiện & nạp hoa',
      match: (row) => row.orderStatus === 'PAID' && !row.ready,
    },
    {
      label: 'Sẵn sàng tại tủ',
      filter: 'ready',
      detail: 'Chờ khách đến nhận',
      match: (row) => row.orderStatus === 'PAID' && row.ready,
    },
  ];
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
  const queueClear =
    orders.isSuccess &&
    actionItems.length === 0 &&
    !orders.data.hasMore &&
    inbox.isSuccess &&
    inbox.data.conversations === 0;

  return (
    <div className={styles.overview}>
      {queries.some((query) => query.isError) && (
        <p role="alert" className={styles.error}>
          Một số dữ liệu chưa tải được. Chọn “Làm mới dữ liệu” để thử lại; các mục còn lại vẫn sử
          dụng được.
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
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="seller-orders-title">
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
            {orders.isPending ? (
              <p className={styles.empty} role="status">
                Đang tải danh sách theo dõi…
              </p>
            ) : orders.isError ? (
              <p className={styles.empty}>
                Chưa tải được đơn đặt hoa. Chọn làm mới dữ liệu để thử lại.
              </p>
            ) : visibleItems.length === 0 ? (
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
            ) : (
              <ul className={styles.orders}>
                {visibleItems.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/seller/orders?page=${row.overviewPage}&requestId=${encodeURIComponent(row.id)}`}
                    >
                      <span className={styles.recordIdentity}>
                        <span className={styles.recordIcon} aria-hidden="true">
                          <Flower2 size={20} />
                        </span>
                        <span className={styles.orderInfo}>
                          <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
                          <small>
                            {row.orderCode || `#${row.id.slice(0, 8)}`} ·{' '}
                            {row.kioskName || 'Tủ nhận'} · Hẹn {pickupTime(row.pickupAt)} ·{' '}
                            <strong>
                              {row.quotedPrice == null ? 'Chưa báo giá' : currency(row.quotedPrice)}
                            </strong>
                          </small>
                        </span>
                      </span>
                      <span
                        className={styles.badge}
                        data-closed={orderClosed(row)}
                        data-status={row.orderStatus || row.state}
                      >
                        {statusName(row)}
                      </span>
                      <span className={styles.openOrder}>
                        {sellerOrderActionLabel(row)} <ArrowRight size={15} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.footnote}>Hiển thị tối đa 5 đơn đặt trước gần nhất.</p>
          </section>

          <section className={styles.card} aria-labelledby="seller-tools-title">
            <div className={styles.heading}>
              <h2 id="seller-tools-title">Thao tác nhanh</h2>
              {products.isSuccess && (
                <span className={styles.metaBadge}>
                  {activeProducts}/{products.data.length} mẫu đang bán
                </span>
              )}
            </div>
            <ul className={styles.shortcuts}>
              {shortcuts.map(({ href, title, icon: Icon }) => (
                <li key={href}>
                  <Link href={href}>
                    <span className={styles.shortcutIcon}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <strong>{title}</strong>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {products.isSuccess && products.data.length === 0 && (
              <p className={styles.firstUse}>
                <Link href="/seller/products">Tạo mẫu hoa đầu tiên</Link>, thêm ảnh rồi bật bán.
              </p>
            )}
          </section>
        </div>

        <aside className={styles.aside} aria-label="Hàng đợi và nguồn lực cửa hàng">
          <section className={styles.workbench} aria-labelledby="seller-workbench-title">
            <div className={styles.workbenchHeader}>
              <h2 id="seller-workbench-title">Việc cần xử lý</h2>
              <button
                type="button"
                className={styles.refreshIconBtn}
                aria-label="Làm mới dữ liệu"
                title="Làm mới dữ liệu"
                disabled={busy}
                onClick={() => queries.forEach((query) => void query.refetch())}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
            {queueClear && (
              <p className={styles.queueClear} role="status">
                <Check size={16} aria-hidden="true" />
                Không có việc đang chờ
              </p>
            )}
            <nav className={styles.metrics} aria-label="Xem đơn theo tiến độ">
              {metrics.map((metric) => {
                const hasItems = orders.isSuccess && items.some(metric.match);
                return (
                  <Link
                    href={`/seller/orders?filter=${metric.filter}`}
                    key={metric.label}
                    className={styles.metric}
                    data-action={metric.filter === 'requested' || metric.filter === 'preparing'}
                    data-has-items={hasItems}
                  >
                    <span>{metric.label}</span>
                    <strong>
                      {orders.isError
                        ? '—'
                        : orders.isPending
                          ? '…'
                          : `${items.filter(metric.match).length}${orders.data?.hasMore ? '+' : ''}`}
                    </strong>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                );
              })}
            </nav>
            <div className={styles.workbenchFooter}>
              <Link href="/seller/chats" className={styles.inboxLink}>
                <MessageSquare size={16} aria-hidden="true" />
                <span>
                  Tin nhắn khách hàng
                  <small>
                    {inbox.isError
                      ? 'Chưa tải được tin nhắn'
                      : inbox.isPending
                        ? 'Đang kiểm tra…'
                        : `${inbox.data.hasMore ? 'Ít nhất ' : ''}${inbox.data.conversations} chưa đọc`}
                  </small>
                </span>
                <strong>
                  {inbox.isError ? '—' : inbox.isPending ? '…' : inbox.data.conversations}
                </strong>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              {(orders.isPending || orders.data?.hasMore) && (
                <p className={styles.queueScope}>
                  {orders.isPending
                    ? 'Đang tải đơn đặt hoa…'
                    : `Đã tải ${orders.data?.loadedPages} trang; mở danh sách đơn để xem tiếp.`}
                </p>
              )}
            </div>
          </section>

          <section className={styles.resourcesCard} aria-labelledby="seller-team-title">
            <h2 id="seller-team-title">Nguồn lực &amp; vận hành</h2>
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
          </section>

          <section className={styles.resourcesCard} aria-labelledby="seller-payments-title">
            <div className={styles.resourceHead}>
              <h2 id="seller-payments-title">Doanh số PayOS</h2>
              <Banknote size={17} aria-hidden="true" />
            </div>
            <dl className={styles.balances}>
              <div>
                <dt>Đã thanh toán</dt>
                <dd>
                  {sales.isPending ? '…' : sales.isError ? '—' : currency(sales.data?.grossPaid)}
                </dd>
              </div>
              <div>
                <dt>Thực nhận</dt>
                <dd>
                  {sales.isPending ? '…' : sales.isError ? '—' : currency(sales.data?.netReceipts)}
                </dd>
              </div>
            </dl>
            <p className={styles.channelStatus} role="status">
              {channel.isPending
                ? 'Đang kiểm tra kênh nhận tiền…'
                : channel.isError
                  ? 'Chưa kiểm tra được kênh nhận tiền. Thử làm mới dữ liệu.'
                  : channel.data?.state === 'ACTIVE'
                    ? 'Kênh nhận tiền đang hoạt động'
                    : 'Kênh nhận tiền chưa sẵn sàng'}
            </p>
            <Link className={styles.resourceRow} href="/seller/commerce">
              <span>Chi tiết giao dịch &amp; kênh thu</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
