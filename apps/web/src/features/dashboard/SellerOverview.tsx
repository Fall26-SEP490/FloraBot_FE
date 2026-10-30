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
  Store,
  Users,
  Wallet,
} from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { request, type Session } from '@/shared/lib/api';
import type { OrderFilter, OrderPage, WebOrder } from '../orders/orders.types';
import { needsOrderAction, orderClosed, statusName } from '../orders/orders.utils';
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
type OverviewOrder = WebOrder & { overviewPage: number };
async function readOrders(base: string) {
  const items: OverviewOrder[] = [];
  let hasMore = true;
  let page = 1;
  while (hasMore && page <= 50) {
    const result = await request<OrderPage>(`${base}/preorders?page=${page}`);
    if (!Array.isArray(result.items) || (result.hasMore && result.items.length === 0)) {
      throw new Error('Invalid order page');
    }
    items.push(...result.items.map((row) => ({ ...row, overviewPage: page })));
    hasMore = result.hasMore;
    page += 1;
  }
  return { items, hasMore };
}
const shortcuts = [
  { href: '/seller/products', title: 'Mẫu hoa', detail: 'Chăm chút danh mục', icon: Flower2 },
  { href: '/seller/stock', title: 'Hoa tại tủ', detail: 'Theo dõi & nạp hoa', icon: Boxes },
  {
    href: '/seller/tasks',
    title: 'Giao công việc',
    detail: 'Điều phối nhân viên',
    icon: ClipboardList,
  },
  { href: '/seller/kiosks', title: 'Vị trí kiosk', detail: 'Quản lý điểm bán', icon: Store },
];

export default function SellerOverview({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const options = { enabled: !!session.sellerId, refetchInterval: 60_000 };
  const orders = useQuery({
    ...options,
    queryKey: ['dashboard-seller-orders-all', session.id, base],
    queryFn: () => readOrders(base),
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
  const [view, setView] = useState<'attention' | 'all'>('attention');
  const queries = [orders, products, wallet, staff];
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

  return (
    <div className={styles.overview}>
      <div className={styles.toolbar}>
        <span className={styles.status} data-active={session.sellerStatus === 'ACTIVE'}>
          <span />
          {shopStatus}
        </span>
        <button
          className={styles.refresh}
          disabled={busy}
          onClick={() => queries.forEach((query) => void query.refetch())}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {busy ? 'Đang cập nhật…' : 'Làm mới dữ liệu'}
        </button>
      </div>
      {queries.some((query) => query.isError) && (
        <p role="alert" className={styles.error}>
          Một số dữ liệu chưa tải được. Chọn “Làm mới dữ liệu” để thử lại.
        </p>
      )}
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="seller-todo-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-todo-title">Việc cần theo dõi</h2>
                <p>Chăm sóc từng đơn hoa, từ báo giá đến lúc nhận.</p>
              </div>
              <Link href="/seller/orders">
                Xem đơn hàng <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.metrics}>
              {metrics.map((metric) => (
                <Link
                  href={`/seller/orders?filter=${metric.filter}&page=${items.find(metric.match)?.overviewPage ?? 1}`}
                  key={metric.label}
                  className={styles.metric}
                >
                  <strong>
                    {orders.isError
                      ? '—'
                      : orders.isPending
                        ? '…'
                        : items.filter(metric.match).length}
                  </strong>
                  <span>{metric.label}</span>
                  <small>{metric.detail}</small>
                </Link>
              ))}
            </div>
            <p className={styles.footnote}>
              {orders.isSuccess
                ? orders.data.hasMore
                  ? `Đã thống kê ${items.length} yêu cầu từ 50 trang đầu; còn đơn chưa được tính.`
                  : `Thống kê trên tất cả ${items.length} yêu cầu.`
                : 'Thống kê theo danh sách đơn đặt trước.'}
            </p>
          </section>

          <section className={styles.card} aria-labelledby="seller-orders-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-orders-title">Đơn đặt hoa</h2>
                <p>Ưu tiên những yêu cầu đang cần bạn xử lý.</p>
              </div>
              <Link href="/seller/orders">
                Tất cả đơn <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.tabs} aria-label="Lọc đơn đặt hoa">
              <button aria-pressed={view === 'attention'} onClick={() => setView('attention')}>
                Cần xử lý <span>{orders.isSuccess ? actionItems.length : '—'}</span>
              </button>
              <button aria-pressed={view === 'all'} onClick={() => setView('all')}>
                Gần đây
              </button>
            </div>
            {orders.isPending ? (
              <p className={styles.empty} role="status">
                Đang tải đơn đặt hoa…
              </p>
            ) : orders.isError ? (
              <p className={styles.empty}>Không tải được đơn đặt hoa. Hãy thử làm mới dữ liệu.</p>
            ) : visibleItems.length === 0 ? (
              <div className={styles.empty}>
                <Check size={30} aria-hidden="true" />
                <strong>
                  {view === 'attention'
                    ? orders.data?.hasMore
                      ? 'Không có đơn cần xử lý trong các trang đã tải'
                      : 'Không có đơn cần xử lý'
                    : 'Chưa có yêu cầu đặt hoa'}
                </strong>
                <p>Yêu cầu mới sẽ xuất hiện tại đây khi khách đặt hoa.</p>
              </div>
            ) : (
              <ul className={styles.orders}>
                {visibleItems.map((row) => (
                  <li key={row.id}>
                    <Link href={`/seller/orders?page=${row.overviewPage}`}>
                      <span className={styles.orderIcon}>
                        <Flower2 size={21} aria-hidden="true" />
                      </span>
                      <div className={styles.orderInfo}>
                        <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
                        <small>
                          {row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`} ·{' '}
                          {row.kioskName || 'Tủ nhận'}
                        </small>
                        <small>Hẹn nhận {pickupTime(row.pickupAt)}</small>
                      </div>
                      <div className={styles.orderMeta}>
                        <span
                          className={styles.badge}
                          data-closed={orderClosed(row)}
                          data-status={row.orderStatus || row.state}
                        >
                          {statusName(row)}
                        </span>
                        <strong>
                          {row.quotedPrice == null ? 'Chưa báo giá' : currency(row.quotedPrice)}
                        </strong>
                      </div>
                      <ArrowRight className={styles.orderArrow} size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.cardFooter}>
              <span>
                {orders.data?.hasMore
                  ? 'Tối đa 5 yêu cầu từ 50 trang đã tải'
                  : 'Hiển thị tối đa 5 yêu cầu'}
              </span>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="seller-tools-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-tools-title">Công cụ cửa hàng</h2>
                <p>Các thao tác thường dùng, ngay trong tầm tay.</p>
              </div>
            </div>
            <div className={styles.shortcuts}>
              {shortcuts.map(({ href, title, detail, icon: Icon }) => (
                <Link key={href} href={href}>
                  <span>
                    <Icon size={23} aria-hidden="true" />
                  </span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="seller-catalog-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-catalog-title">Danh mục hoa</h2>
                <p>Giữ những mẫu hoa của bạn luôn sẵn sàng đón khách.</p>
              </div>
              <Link href="/seller/products">
                Quản lý <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.catalog}>
              <div className={styles.catalogIcon}>
                <Flower2 size={32} aria-hidden="true" />
              </div>
              <div className={styles.catalogContent}>
                <strong>
                  {products.isSuccess
                    ? `${activeProducts} mẫu đang hoạt động`
                    : products.isError
                      ? 'Chưa tải được mẫu hoa'
                      : 'Đang tải mẫu hoa…'}
                </strong>
                <p>
                  {products.isSuccess
                    ? `${products.data.length - activeProducts} mẫu chưa hoạt động · ${products.data.length} mẫu trong danh mục`
                    : 'Thông tin danh mục của cửa hàng'}
                </p>
                <div className={styles.progress} aria-hidden="true">
                  <span
                    style={{
                      width: `${products.data?.length ? (activeProducts / products.data.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className={styles.aside} aria-label="Thông tin vận hành cửa hàng">
          <section
            className={`${styles.card} ${styles.wallet}`}
            aria-labelledby="seller-wallet-title"
          >
            <div className={styles.heading}>
              <h2 id="seller-wallet-title">
                <Wallet size={19} aria-hidden="true" /> Ví cửa hàng
              </h2>
            </div>
            <span className={styles.balanceLabel}>Số dư có thể rút</span>
            <strong className={styles.balance}>
              {wallet.isPending
                ? '…'
                : wallet.isError
                  ? '—'
                  : currency(wallet.data?.balance?.availableBalance)}
            </strong>
            <p>
              Đang chờ:{' '}
              {wallet.isPending
                ? '…'
                : wallet.isError
                  ? '—'
                  : currency(wallet.data?.balance?.pendingBalance)}
            </p>
            {wallet.isSuccess && !wallet.data.balance && <p>Chưa ghi nhận số dư ví.</p>}
            <Link className={styles.walletLink} href="/seller/wallet">
              Xem ví & giao dịch <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          <section className={styles.card} aria-labelledby="seller-team-title">
            <div className={styles.heading}>
              <h2 id="seller-team-title">Đội ngũ cửa hàng</h2>
              <Users size={19} aria-hidden="true" />
            </div>
            <div className={styles.team}>
              <strong>
                {staff.isError
                  ? '—'
                  : staff.isPending
                    ? '…'
                    : staff.data.filter((item) => item.status === 'ACTIVE').length}
              </strong>
              <span>
                Tài khoản đang hoạt động
                <small>
                  {staff.isSuccess
                    ? `Trên tổng số ${staff.data.length} nhân viên`
                    : staff.isError
                      ? 'Chưa tải được nhân viên'
                      : 'Đang tải thông tin…'}
                </small>
              </span>
            </div>
            <Link className={styles.textLink} href="/seller/staff">
              Quản lý nhân viên <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
          <details className={`${styles.card} ${styles.guideDetails}`}>
            <summary className={styles.heading}>Hướng dẫn xử lý đơn hoa</summary>
            <ol className={styles.guide}>
              <li>
                <strong>Phản hồi yêu cầu</strong>
                <p>Chốt mẫu hoa, báo giá và lịch nhận cùng khách.</p>
              </li>
              <li>
                <strong>Chuẩn bị & nạp hoa</strong>
                <p>Kiểm tra thanh toán, giao việc và đặt hoa vào đúng tủ.</p>
              </li>
              <li>
                <strong>Theo dõi khách nhận</strong>
                <p>Kiểm tra trạng thái đơn và giao dịch trong ví.</p>
              </li>
            </ol>
            <Link className={styles.textLink} href="/seller/tasks">
              Điều phối công việc <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </details>
          <Link className={styles.subscription} href="/seller/subscriptions">
            <Store size={24} aria-hidden="true" />
            <span>
              <strong>Gói thuê cửa hàng</strong>
              <small>Xem gói dịch vụ & gia hạn</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
