import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Boxes,
  Check,
  ClipboardList,
  Flower2,
  RefreshCw,
  MessageSquare,
  Store,
  Users,
  Wallet,
} from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '@/shared/lib/api';
import type { OrderFilter, OrderPage, WebOrder } from '../orders/orders.types';
import {
  needsOrderAction,
  orderClosed,
  sellerOrderHint,
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
  const wallet = useQuery({
    ...options,
    queryKey: ['dashboard-wallet', session.id, base],
    queryFn: () => request<components['schemas']['WalletResponse']>(`${base}/wallet`),
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
  const queries = [orders, products, wallet, staff, inbox];
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
  return (
    <div className={styles.overview}>
      <div className={styles.toolbar}>
        <span className={styles.status} data-active={session.sellerStatus === 'ACTIVE'}>
          <span aria-hidden="true" />
          {shopStatus}
        </span>
        <button
          className={styles.refresh}
          disabled={busy}
          onClick={() => queries.forEach((query) => void query.refetch())}
        >
          <RefreshCw size={17} aria-hidden="true" />
          {busy ? 'Đang cập nhật…' : 'Làm mới dữ liệu'}
        </button>
      </div>
      {queries.some((query) => query.isError) && (
        <p role="alert" className={styles.error}>
          Một số dữ liệu chưa tải được. Chọn “Làm mới dữ liệu” để thử lại; các mục còn lại vẫn sử
          dụng được.
        </p>
      )}
      <section className={styles.workbench} aria-labelledby="seller-workbench-title">
        <div className={styles.heading}>
          <div>
            <h2 id="seller-workbench-title">Việc cần làm</h2>
            <p>Chọn một nhóm để xem đơn và bước xử lý tiếp theo.</p>
          </div>
          <Link href="/seller/orders">
            Tất cả đơn <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <nav className={styles.metrics} aria-label="Xem đơn theo tiến độ">
          {metrics.map((metric) => (
            <Link
              href={`/seller/orders?filter=${metric.filter}`}
              key={metric.label}
              className={styles.metric}
              data-action={metric.filter === 'requested' || metric.filter === 'preparing'}
              data-has-items={orders.isSuccess && items.some(metric.match)}
            >
              <strong>
                {orders.isError ? '—' : orders.isPending ? '…' : items.filter(metric.match).length}
              </strong>
              <span>
                {metric.label}
                <small>{metric.detail}</small>
              </span>
            </Link>
          ))}
        </nav>
        <Link href="/seller/chats" className={styles.inboxLink}>
          <MessageSquare size={18} aria-hidden="true" />
          <span>
            Tin nhắn khách hàng{' '}
            <small>
              {inbox.isError
                ? 'Chưa tải được tin nhắn'
                : inbox.isPending
                  ? 'Đang kiểm tra…'
                  : `${inbox.data.hasMore ? 'Ít nhất ' : ''}${inbox.data.conversations} cuộc trò chuyện chưa đọc`}
            </small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <p className={styles.queueScope}>
          {orders.isPending
            ? 'Đang tải đơn đặt hoa…'
            : orders.isError
              ? 'Chưa tải được số lượng đơn. Các mục khác vẫn sử dụng được.'
              : orders.data.hasMore
                ? `Đã tải ${orders.data.loadedPages} trang; còn đơn chưa được tính. Mở danh sách đơn để tải tiếp.`
                : `Đã đối chiếu ${items.length} yêu cầu của shop.`}
        </p>
      </section>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="seller-orders-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-orders-title">Đơn cần theo dõi</h2>
                <p>Ưu tiên báo giá và chuẩn bị những đơn đã thanh toán.</p>
              </div>
              <Link href="/seller/orders">
                Xem danh sách <ArrowRight size={16} aria-hidden="true" />
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
                <Check size={24} aria-hidden="true" />
                <strong>
                  {view === 'attention'
                    ? orders.data?.hasMore
                      ? 'Không có đơn cần xử lý trong các trang đã tải'
                      : 'Không có đơn cần xử lý'
                    : 'Chưa có yêu cầu đặt hoa'}
                </strong>
                <p>
                  Yêu cầu mới sẽ xuất hiện khi khách đặt hoa. Bạn có thể kiểm tra mẫu hoa hoặc tủ
                  trong lúc chờ.
                </p>
              </div>
            ) : (
              <ul className={styles.orders}>
                {visibleItems.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/seller/orders?page=${row.overviewPage}&requestId=${encodeURIComponent(row.id)}`}
                    >
                      <div className={styles.orderInfo}>
                        <div className={styles.orderTop}>
                          <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
                          <span
                            className={styles.badge}
                            data-closed={orderClosed(row)}
                            data-status={row.orderStatus || row.state}
                          >
                            {statusName(row)}
                          </span>
                        </div>
                        <small>
                          {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`} ·{' '}
                          {row.kioskName || 'Tủ nhận'}
                        </small>
                        <small>
                          Hẹn nhận {pickupTime(row.pickupAt)} ·{' '}
                          {row.quotedPrice == null ? 'Chưa báo giá' : currency(row.quotedPrice)}
                        </small>
                        {view === 'attention' && (
                          <p className={styles.nextAction}>{sellerOrderHint(row)}</p>
                        )}
                      </div>
                      <span className={styles.openOrder}>
                        {sellerOrderActionLabel(row)} <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.footnote}>
              {orders.isSuccess
                ? orders.data.hasMore
                  ? `Đã tải ${items.length} yêu cầu từ 50 trang đầu; còn đơn chưa được tính.`
                  : `Thống kê trên tất cả ${items.length} yêu cầu. Hiển thị tối đa 5 yêu cầu bên trên.`
                : 'Số lượng theo dữ liệu đơn đặt trước đã tải.'}
            </p>
          </section>
          <section className={styles.card} aria-labelledby="seller-tools-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-tools-title">Quản lý hoa và tủ</h2>
                <p>Danh mục giới thiệu mẫu; hoa tại tủ là những bó đã được nạp thực tế.</p>
              </div>
            </div>
            <ul className={styles.shortcuts}>
              {shortcuts.map(({ href, title, detail, icon: Icon }) => (
                <li key={href}>
                  <Link href={href}>
                    <Icon size={20} aria-hidden="true" />
                    <span>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className={styles.footnote}>
              {products.isSuccess
                ? `${activeProducts} mẫu đang hoạt động · ${products.data.length} mẫu trong danh mục`
                : products.isError
                  ? 'Chưa tải được số lượng mẫu hoa.'
                  : 'Đang tải danh mục mẫu hoa…'}
            </p>
            {products.isSuccess && products.data.length === 0 && (
              <p className={styles.firstUse}>
                <Link href="/seller/products">Tạo mẫu hoa đầu tiên</Link> để khách xem danh mục và
                gửi yêu cầu đặt hoa.
              </p>
            )}
          </section>
        </div>
        <aside className={styles.aside} aria-label="Thông tin vận hành cửa hàng">
          <section className={styles.card} aria-labelledby="seller-wallet-title">
            <div className={styles.heading}>
              <h2 id="seller-wallet-title">Tiền bán hoa</h2>
              <Wallet size={20} aria-hidden="true" />
            </div>
            <dl className={styles.balances}>
              <div>
                <dt>Có thể rút</dt>
                <dd>
                  {wallet.isPending
                    ? '…'
                    : wallet.isError
                      ? '—'
                      : currency(wallet.data?.balance?.availableBalance)}
                </dd>
              </div>
              <div>
                <dt>Đang chờ</dt>
                <dd>
                  {wallet.isPending
                    ? '…'
                    : wallet.isError
                      ? '—'
                      : currency(wallet.data?.balance?.pendingBalance)}
                </dd>
              </div>
            </dl>
            {wallet.isSuccess && !wallet.data.balance && (
              <p className={styles.footnote}>Chưa ghi nhận số dư ví.</p>
            )}
            <Link className={styles.textLink} href="/seller/wallet">
              Xem ví và yêu cầu rút <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          <section className={styles.card} aria-labelledby="seller-team-title">
            <div className={styles.heading}>
              <h2 id="seller-team-title">Nhân viên shop</h2>
              <Users size={20} aria-hidden="true" />
            </div>
            <p className={styles.team}>
              {staff.isError
                ? 'Chưa tải được nhân viên.'
                : staff.isPending
                  ? 'Đang tải nhân viên…'
                  : `${staff.data.filter((item) => item.status === 'ACTIVE').length} tài khoản đang hoạt động / ${staff.data.length} nhân viên`}
            </p>
            <Link className={styles.textLink} href="/seller/tasks">
              Phân công giao hoa <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className={styles.textLink} href="/seller/staff">
              Quản lý tài khoản nhân viên <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          <Link className={styles.subscription} href="/seller/subscriptions">
            <Store size={20} aria-hidden="true" />
            <span>
              <strong>Gói thuê của shop</strong>
              <small>Xem gói, kỳ thuê và trạng thái thanh toán</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
