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
import { needsOrderAction, orderClosed, orderNextStep, statusName } from '../orders/orders.utils';
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
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="seller-orders-title">
            <div className={styles.heading}>
              <div>
                <h2 id="seller-orders-title">Đơn đặt hoa</h2>
                <p>Bắt đầu từ đơn cần báo giá hoặc chuẩn bị hoa.</p>
              </div>
              <Link href="/seller/orders">
                Tất cả đơn <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <nav className={styles.metrics} aria-label="Xem đơn theo tiến độ">
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
                </Link>
              ))}
            </nav>
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
                Đang tải đơn đặt hoa…
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
                          <p className={styles.nextAction}>{orderNextStep(row, 'seller')}</p>
                        )}
                      </div>
                      <span className={styles.openOrder}>
                        Mở đơn <ArrowRight size={16} aria-hidden="true" />
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
